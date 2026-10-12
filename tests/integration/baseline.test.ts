import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { baselineName, inspectBaseline, inspectMigrationState } from "../../src/lib/database-baseline";
import { loadMigrations } from "../../scripts/migration-manifest";
import { captureSnapshot, decryptSnapshot, encryptSnapshot } from "../../src/lib/database-backup";
import { baselineBackupCopy } from "../../scripts/baseline-backup-copy";

const directory = await mkdtemp(join(tmpdir(), "odonto-baseline-test-"));
const sql = await readFile(new URL("../../prisma/migrations/202610110001_baseline/migration.sql", import.meta.url), "utf8");
const key = randomBytes(32);
const originalPath = join(directory, "original.db");
const archivePath = join(directory, "original.gobak");
let source: Client;
let archive: Buffer;
const env = { ...process.env, BACKUP_ENCRYPTION_KEY: key.toString("hex"), DATABASE_URL: "libsql://must-never-be-used.invalid", TURSO_AUTH_TOKEN: "must-never-be-sent" };

beforeAll(async () => {
  source = createClient({ url: pathToFileURL(originalPath).href, intMode: "bigint" });
  await source.executeMultiple(sql);
  await source.executeMultiple("INSERT INTO clinica(id,nome) VALUES ('c','Clínica fictícia'); INSERT INTO usuario(id,clinica_id,nome,email,senha_hash,papel) VALUES ('u','c','Teste','fake@example.com','fake-hash','dono');");
  archive = encryptSnapshot(await captureSnapshot(source), key);
  await writeFile(archivePath, archive, { flag: "wx", mode: 0o600 });
});
afterAll(async () => {
  source?.close();
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("odonto-baseline-test-")) throw new Error("Unsafe test cleanup path");
  Bun.gc(true);
  try { await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch (error) {
    if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EBUSY") throw error;
    console.warn("Synthetic baseline fixtures retained until native Windows handles close.");
  }
});

describe("baseline segura em cópia", () => {
  test("inspeção reconhece banco legado e não modifica schema nem dados", async () => {
    const before = await captureSnapshot(source);
    const report = await inspectBaseline(source, sql);
    expect(report).toMatchObject({ compatible: true, state: "legacy", tables: 20, issues: [] });
    expect(report.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    const after = await captureSnapshot(source);
    expect(after.tables).toEqual(before.tables);
    expect(after.schema).toEqual(before.schema);
  });
  test("CLI registra baseline sem executar CREATE das tabelas do app e preserva origem", async () => {
    const originalKey = process.env.BACKUP_ENCRYPTION_KEY;
    try {
      process.env.BACKUP_ENCRYPTION_KEY = key.toString("hex");
      await baselineBackupCopy(archivePath, join(directory, "direct-helper.db"));
    } finally {
      if (originalKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
      else process.env.BACKUP_ENCRYPTION_KEY = originalKey;
    }
    const target = join(directory, "baselined.db");
    const before = await captureSnapshot(source);
    const result = Bun.spawnSync([process.execPath, "run", "db:baseline-copy", "--", archivePath, target], { env });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({ event: "baseline_copy_verified", tables: 20, rows: 2 });
    const copy = createClient({ url: pathToFileURL(target).href, intMode: "bigint" });
    try {
      expect(await inspectBaseline(copy, sql)).toMatchObject({ compatible: true, state: "baselined", issues: [] });
      const restored = await captureSnapshot(copy);
      expect(restored.tables.filter((table) => table.name !== "_prisma_migrations")).toEqual(before.tables);
      expect(restored.schema.filter((entry) => entry.name !== "_prisma_migrations")).toEqual(before.schema);
      const history = await copy.execute("SELECT migration_name,finished_at FROM _prisma_migrations");
      expect(history.rows).toHaveLength(1);
      expect(history.rows[0].migration_name).toBe(baselineName);
      expect(history.rows[0].finished_at).not.toBeNull();
    } finally { copy.close(); }
    const after = await captureSnapshot(source);
    expect(after.tables).toEqual(before.tables);
    expect(after.schema).toEqual(before.schema);
    expect((await readFile(archivePath)).equals(archive)).toBe(true);
  }, 30_000);
  test("inspeção CLI ignora DATABASE_URL remoto e rejeita destino remoto", () => {
    const result = Bun.spawnSync([process.execPath, "run", "db:inspect-copy", "--", originalPath], { env });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({ compatible: true, state: "legacy" });
    const remote = Bun.spawnSync([process.execPath, "scripts/inspect-database.ts", env.DATABASE_URL], { env });
    expect(remote.exitCode).toBe(1);
    expect(remote.stderr.toString()).not.toContain(env.TURSO_AUTH_TOKEN);
  });
  test("diferença de coluna ou índice impede a baseline", async () => {
    const altered = createClient({ url: pathToFileURL(join(directory, "altered.db")).href, intMode: "bigint" });
    try {
      await altered.executeMultiple(sql);
      await altered.execute("ALTER TABLE usuario ADD COLUMN extra TEXT");
      await altered.execute("DROP INDEX usuario_email_key");
      const report = await inspectBaseline(altered, sql);
      expect(report.compatible).toBe(false);
      expect(report.issues).toContain("columns_or_constraints_differ");
      const alteredArchive = join(directory, "altered.gobak");
      await writeFile(alteredArchive, encryptSnapshot(await captureSnapshot(altered), key), { flag: "wx" });
      const target = join(directory, "must-not-baseline.db");
      const result = Bun.spawnSync([process.execPath, "scripts/baseline-backup-copy.ts", alteredArchive, target], { env });
      expect(result.exitCode).toBe(1);
      const copy = createClient({ url: pathToFileURL(target).href });
      try { expect((await copy.execute("SELECT name FROM sqlite_master WHERE name='_prisma_migrations'")).rows).toEqual([]); }
      finally { copy.close(); }
    } finally { altered.close(); }
  });
  test("verifica CHECKs e objetos SQL mesmo quando as colunas não mudam", async () => {
    const changed = createClient({ url: pathToFileURL(join(directory, "check-drift.db")).href, intMode: "bigint" });
    try {
      await changed.executeMultiple(sql.replace('"nome" TEXT NOT NULL,', '"nome" TEXT NOT NULL CHECK(length("nome") > 1),'));
      const report = await inspectBaseline(changed, sql);
      expect(report.compatible).toBe(false);
      expect(report.issues).toContain("schema_objects_differ");
      expect(report.issues).not.toContain("columns_or_constraints_differ");
    } finally { changed.close(); }
  });
  test("Prisma deploy não recria tabelas e o ORM consegue ler a cópia recuperada", async () => {
    const target = join(directory, "baselined.db");
    const result = Bun.spawnSync([process.execPath, "node_modules/prisma/build/index.js", "migrate", "deploy"], {
      env: { ...env, DATABASE_URL: `file:${target.replaceAll("\\", "/")}`, TURSO_AUTH_TOKEN: "", CHECKPOINT_DISABLE: "1", PRISMA_HIDE_UPDATE_MESSAGE: "true" },
    });
    expect(result.exitCode).toBe(0);
    const orm = new PrismaClient({ datasourceUrl: `file:${target.replaceAll("\\", "/")}` });
    try {
      const clinic = await orm.clinica.findUnique({ where: { id: "c" }, include: { usuarios: true } });
      expect(clinic?.nome).toBe("Clínica fictícia");
      expect(clinic?.usuarios).toHaveLength(1);
      expect(clinic?.usuarios[0].email).toBe("fake@example.com");
    } finally { await orm.$disconnect(); }
    const numeric = createClient({ url: pathToFileURL(target).href });
    try { expect(await inspectMigrationState(numeric, await loadMigrations())).toMatchObject({ compatible: true, state: "baselined", tables: 22, pending: [] }); }
    finally { numeric.close(); }
  }, 30_000);
  test("histórico com checksum adulterado é recusado", async () => {
    const copy = createClient({ url: pathToFileURL(join(directory, "baselined.db")).href, intMode: "bigint" });
    try {
      await copy.execute("UPDATE _prisma_migrations SET checksum='wrong-checksum'");
      expect(await inspectMigrationState(copy, await loadMigrations())).toMatchObject({ compatible: false, issues: ["migration_history_differ"] });
    } finally { copy.close(); }
  });
  test("ensaio não sobrescreve arquivo existente nem aceita chave errada", () => {
    const exists = Bun.spawnSync([process.execPath, "scripts/baseline-backup-copy.ts", archivePath, originalPath], { env });
    expect(exists.exitCode).toBe(1);
    const invalid = Bun.spawnSync([process.execPath, "scripts/baseline-backup-copy.ts", archivePath, join(directory, "wrong-key.db")], {
      env: { ...env, BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("hex") },
    });
    expect(invalid.exitCode).toBe(1);
    expect(decryptSnapshot(archive, key).tables).toHaveLength(20);
  });
  test("ensaio completo aplica sessões e controle de acesso preservando registros legados", async () => {
    const target = join(directory, "updated.db");
    const result = Bun.spawnSync([process.execPath, "run", "db:rehearse-updates", "--", archivePath, target], { env });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({ event: "database_update_rehearsal_verified", appTables: 22, pending: [] });
    const copy = createClient({ url: pathToFileURL(target).href, intMode: "bigint" });
    try {
      const report = await inspectMigrationState(copy, await loadMigrations());
      expect(report).toMatchObject({ compatible: true, tables: 22, pending: [] });
      const after = await captureSnapshot(copy);
      expect(after.tables.filter((table) => !["sessao", "usuario_acesso", "_prisma_migrations"].includes(table.name))).toEqual(decryptSnapshot(archive, key).tables);
      expect((await copy.execute("SELECT migration_name FROM _prisma_migrations ORDER BY migration_name")).rows.map((row) => row.migration_name))
        .toEqual([baselineName, "202610110002_sessions", "202610110003_user_access"]);
    } finally { copy.close(); }
    expect((await readFile(archivePath)).equals(archive)).toBe(true);
  }, 30_000);
});
