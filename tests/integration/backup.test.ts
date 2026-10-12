import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { backupKey, captureSnapshot, decryptSnapshot, encryptSnapshot, restoreToNewFile, type DatabaseSnapshot } from "../../src/lib/database-backup";

const directory = await mkdtemp(join(tmpdir(), "odonto-backup-test-"));
const key = randomBytes(32);
let source: Client;
let snapshot: DatabaseSnapshot;
let archive: Buffer;

beforeAll(async () => {
  source = createClient({ url: pathToFileURL(join(directory, "source.db")).href, intMode: "bigint" });
  await source.executeMultiple(await readFile(new URL("../../prisma/migrations/202610110001_baseline/migration.sql", import.meta.url), "utf8"));
  await source.executeMultiple(`
    INSERT INTO clinica(id,nome) VALUES ('c','Clínica fictícia'),('c2','Segunda clínica fictícia');
    INSERT INTO usuario(id,clinica_id,nome,email,senha_hash,papel) VALUES ('u','c','Usuário teste','fake@example.com','synthetic-hash','dono');
    INSERT INTO capacidade_produtiva(clinica_id) VALUES ('c');
    INSERT INTO despesa_fixa(id,clinica_id,nome,valor) VALUES ('d','c','Aluguel',100.25);
    INSERT INTO ativo(id,clinica_id,nome) VALUES ('a','c','Equipamento');
    INSERT INTO funcionario(id,clinica_id,cargo) VALUES ('f','c','Recepção');
    INSERT INTO insumo(id,clinica_id,nome) VALUES ('i','c','Insumo');
    INSERT INTO procedimento(id,clinica_id,nome,equipamento_id,preco_final) VALUES ('p','c','Exame','a',123.45);
    INSERT INTO procedimento_insumo(procedimento_id,insumo_id) VALUES ('p','i');
    INSERT INTO historico_preco(id,procedimento_id,usuario_id,preco_novo) VALUES ('h','p','u',123.45);
    INSERT INTO agendamento(id,clinica_id,nome,data) VALUES ('ag2','c','Paciente fictício','2026-10-12');
    INSERT INTO agendamento(id,clinica_id,nome,data,status,remarcado_para_id) VALUES ('ag','c','Paciente fictício','2026-10-11','remarcado','ag2');
    INSERT INTO convenio(id,clinica_id,nome) VALUES ('cv','c','Convênio');
    INSERT INTO convenio_tabela_preco(id,convenio_id,procedimento_id,valor,vigencia_inicio) VALUES ('ct','cv','p',100.25,'2026-10-01');
    INSERT INTO despesa_recorrente(id,clinica_id,descricao,valor) VALUES ('dr','c','Despesa',25.50);
    INSERT INTO conta_pagar(id,clinica_id,descricao,valor,vencimento,recorrente_id) VALUES ('cp','c','Conta',25.50,'2026-10-11','dr');
    INSERT INTO lote_faturamento(id,clinica_id,convenio_id,periodo_inicio,periodo_fim,quantidade,valor) VALUES ('l','c','cv','2026-10-01','2026-10-31',1,100.25);
    INSERT INTO conta_receber(id,clinica_id,paciente_nome,procedimento_id,convenio_id,data_exame,valor_faturado,valor_pago,status,lote_id) VALUES ('cr','c','Paciente fictício','p','cv','2026-10-11',100.25,40.10,'parcial','l');
    INSERT INTO glosa(id,conta_receber_id,valor) VALUES ('g','cr',10.15);
    INSERT INTO financeiro_config(clinica_id,saldo_inicial_caixa) VALUES ('c',10.01);
    INSERT INTO movimento_bancario(id,clinica_id,data,valor) VALUES ('m','c','2026-10-11',40.10);
  `);
  snapshot = await captureSnapshot(source);
  archive = encryptSnapshot(snapshot, key);
});

afterAll(async () => {
  source?.close();
  // Remove only this test's freshly allocated directory, never a configured database.
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("odonto-backup-test-")) throw new Error("Unsafe test cleanup path");
  Bun.gc(true);
  try { await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch (error) {
    // libSQL native Windows handles may retain the directory until process exit.
    // Keep only synthetic fixtures; other cleanup failures remain failures.
    if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EBUSY") throw error;
    console.warn("Synthetic backup test directory retained until native Windows handles close.");
  }
});

describe("backup criptografado e restauração isolada", () => {
  test("captura as vinte tabelas com dados e não revela dados sensíveis no arquivo", () => {
    expect(snapshot.tables).toHaveLength(20);
    expect(snapshot.tables.every((table) => table.rows.length > 0)).toBe(true);
    expect(archive.includes(Buffer.from("Paciente fictício"))).toBe(false);
    expect(archive.includes(Buffer.from("synthetic-hash"))).toBe(false);
    expect(decryptSnapshot(archive, key)).toEqual(snapshot);
    expect(encryptSnapshot(snapshot, key)).not.toEqual(archive);
  });
  test("restaura relações, índices e valores exatamente em um arquivo novo", async () => {
    const target = join(directory, "restored.db");
    const result = await restoreToNewFile(archive, key, target);
    expect(result.tables).toBe(20);
    expect(result.rows).toBe(22);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    const restored = createClient({ url: pathToFileURL(target).href, intMode: "bigint" });
    try {
      const copy = await captureSnapshot(restored);
      expect(copy.tables).toEqual(snapshot.tables);
      expect(copy.schema).toEqual(snapshot.schema);
      expect((await restored.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
      await expect(restored.execute("INSERT INTO usuario(id,clinica_id,nome,email,senha_hash,papel) VALUES ('duplicate','c','Nome','fake@example.com','hash','dono')")).rejects.toThrow();
    } finally { restored.close(); }
  });
  test("chave errada e adulteração falham antes de criar destino", async () => {
    const corrupted = Buffer.from(archive);
    corrupted[corrupted.length - 1] ^= 1;
    for (const [bytes, usedKey] of [[archive, randomBytes(32)], [corrupted, key], [archive.subarray(0, 30), key]]) {
      const target = join(directory, "must-not-exist.db");
      await expect(restoreToNewFile(bytes, usedKey, target)).rejects.toThrow();
      await expect(stat(target)).rejects.toThrow();
    }
    expect(() => backupKey(undefined)).toThrow();
    expect(() => backupKey("weak")).toThrow();
    expect(backupKey(key.toString("hex"))).toEqual(key);
  });
  test("não sobrescreve banco existente nem aceita destino remoto ou relativo", async () => {
    const original = await readFile(join(directory, "source.db"));
    await expect(restoreToNewFile(archive, key, join(directory, "source.db"))).rejects.toThrow();
    expect(await readFile(join(directory, "source.db"))).toEqual(original);
    await expect(restoreToNewFile(archive, key, "relative.db")).rejects.toThrow();
    await expect(restoreToNewFile(archive, key, "libsql://production.example")).rejects.toThrow();
  });
  test("restauração com referência quebrada faz rollback completo", async () => {
    const invalid = structuredClone(snapshot);
    const user = invalid.tables.find((table) => table.name === "usuario")!;
    user.rows[0][user.columns.indexOf("clinica_id")] = "missing-clinic";
    const target = join(directory, "failed.db");
    await expect(restoreToNewFile(encryptSnapshot(invalid, key), key, target)).rejects.toThrow();
    const failed = createClient({ url: pathToFileURL(target).href });
    try { expect((await failed.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows).toEqual([]); }
    finally { failed.close(); }
  });
  test("preserva blobs, inteiros de 64 bits, sequência e gatilhos sem duplicar efeitos", async () => {
    const special = createClient({ url: pathToFileURL(join(directory, "special.db")).href, intMode: "bigint" });
    try {
      await special.executeMultiple(`
        CREATE TABLE sample(id INTEGER PRIMARY KEY AUTOINCREMENT, big INTEGER, data BLOB, optional TEXT);
        CREATE TABLE audit(id INTEGER PRIMARY KEY, sample_id INTEGER);
        CREATE TRIGGER sample_insert AFTER INSERT ON sample BEGIN INSERT INTO audit(sample_id) VALUES (NEW.id); END;
        CREATE VIEW sample_view AS SELECT id,big FROM sample;
        CREATE TRIGGER sample_view_insert INSTEAD OF INSERT ON sample_view BEGIN INSERT INTO sample(big) VALUES (NEW.big); END;
      `);
      await special.execute({ sql: "INSERT INTO sample(id,big,data) VALUES (?,?,?)", args: [4, BigInt("9223372036854775000"), Buffer.from([0, 255, 127])] });
      await special.execute("INSERT INTO sample(id) VALUES (20)");
      await special.execute("DELETE FROM sample WHERE id=20");
      const captured = await captureSnapshot(special);
      const target = join(directory, "special-restored.db");
      await restoreToNewFile(encryptSnapshot(captured, key), key, target);
      const restored = createClient({ url: pathToFileURL(target).href, intMode: "bigint" });
      try {
        const copy = await captureSnapshot(restored);
        expect(copy.tables).toEqual(captured.tables);
        expect(copy.sequences).toEqual(captured.sequences);
        expect((await restored.execute("SELECT big FROM sample_view")).rows[0].big).toBe(BigInt("9223372036854775000"));
        expect((await restored.execute("INSERT INTO sample(optional) VALUES ('new') RETURNING id")).rows[0].id).toBe(BigInt(21));
      } finally { restored.close(); }
    } finally { special.close(); }
  });
  test("recusa backup de origem com relações quebradas em vez de fingir sucesso", async () => {
    const invalid = createClient({ url: pathToFileURL(join(directory, "invalid-source.db")).href });
    try {
      await invalid.execute("PRAGMA foreign_keys = OFF");
      await invalid.executeMultiple("CREATE TABLE parent(id TEXT PRIMARY KEY); CREATE TABLE child(id TEXT, parent_id TEXT REFERENCES parent(id)); INSERT INTO child VALUES ('x','missing');");
      await expect(captureSnapshot(invalid)).rejects.toThrow();
    } finally { invalid.close(); }
  });
  test("comandos reais geram só backup criptografado e restauram em banco novo", async () => {
    const env = { ...process.env, DATABASE_URL: pathToFileURL(join(directory, "source.db")).href,
      BACKUP_ENCRYPTION_KEY: key.toString("hex"), BACKUP_DIRECTORY: join(directory, "archives") };
    const backup = Bun.spawnSync([process.execPath, "scripts/backup-turso.ts"], { env });
    expect(backup.exitCode).toBe(0);
    const files = await readdir(env.BACKUP_DIRECTORY);
    expect(files).toHaveLength(1);
    expect(files[0]).toEndWith(".gobak");
    const sourcePath = join(env.BACKUP_DIRECTORY, files[0]);
    const restore = Bun.spawnSync([process.execPath, "run", "backup:restore", "--", sourcePath, join(directory, "cli-restored.db")], { env });
    expect(restore.exitCode).toBe(0);
    expect(JSON.parse(restore.stdout.toString())).toMatchObject({ event: "backup_restored_verified", tables: 20, rows: 22 });
    const failed = Bun.spawnSync([process.execPath, "scripts/backup-turso.ts"], { env: { ...env, BACKUP_ENCRYPTION_KEY: "" } });
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr.toString()).not.toContain(key.toString("hex"));
    expect(await readdir(env.BACKUP_DIRECTORY)).toHaveLength(1);
    const wrongSource = Bun.spawnSync([process.execPath, "scripts/backup-turso.ts"], {
      env: { ...env, DATABASE_URL: pathToFileURL(join(directory, "special.db")).href },
    });
    expect(wrongSource.exitCode).toBe(1);
    expect(await readdir(env.BACKUP_DIRECTORY)).toHaveLength(1);
    const missingPath = join(directory, "missing-source.db");
    const missingSource = Bun.spawnSync([process.execPath, "scripts/backup-turso.ts"], { env: { ...env, DATABASE_URL: pathToFileURL(missingPath).href } });
    expect(missingSource.exitCode).toBe(1);
    await expect(stat(missingPath)).rejects.toThrow();
  });
  test("paginação lê um snapshot coerente mesmo com escrita concorrente", async () => {
    const url = pathToFileURL(join(directory, "paged.db")).href;
    const reader = createClient({ url, intMode: "bigint" });
    const writer = createClient({ url, intMode: "bigint" });
    try {
      await reader.execute("PRAGMA journal_mode=WAL");
      await reader.execute("CREATE TABLE paged(id INTEGER PRIMARY KEY, value INTEGER)");
      await reader.batch(Array.from({ length: 1_001 }, (_, id) => ({ sql: "INSERT INTO paged VALUES (?,?)", args: [id, 1] })), "write");
      let wrote = false;
      const wrapped = new Proxy(reader, { get(target, property) {
        if (property === "transaction") return async () => {
          const transaction = await target.transaction("read");
          return new Proxy(transaction, { get(tx, name) {
            if (name === "execute") return async (statement: InStatement) => {
              if (!wrote && typeof statement === "string" && statement.startsWith("SELECT \"id\"")) {
                wrote = true;
                await writer.execute("UPDATE paged SET value=2 WHERE id=1000");
              }
              return tx.execute(statement);
            };
            const value = Reflect.get(tx, name);
            return typeof value === "function" ? value.bind(tx) : value;
          } });
        };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      } });
      const captured = await captureSnapshot(wrapped);
      expect(wrote).toBe(true);
      expect(captured.tables[0].rows).toHaveLength(1_001);
      expect(captured.tables[0].rows[1_000]).toEqual([{ integer: "1000" }, { integer: "1" }]);
      expect((await writer.execute("SELECT value FROM paged WHERE id=1000")).rows[0].value).toBe(BigInt(2));
    } finally { reader.close(); writer.close(); }
  });
});
