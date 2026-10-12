import { createClient } from "@libsql/client";
import { open } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { baselineName, inspectMigrationState } from "../src/lib/database-baseline";
import { loadMigrations } from "./migration-manifest";
import { backupKey, maxBackupBytes, restoreToNewFile } from "../src/lib/database-backup";

export async function baselineBackupCopy(source: string, target: string) {
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const file = await open(source, "r");
  let archive: Buffer;
  try {
    if ((await file.stat()).size > maxBackupBytes + 36) throw new Error("Backup too large");
    archive = await file.readFile();
  } finally { await file.close(); }
  // This guarantees that the only mutation target is a fresh local restored copy.
  const restore = await restoreToNewFile(archive, key, target);
  const migrations = await loadMigrations();
  const url = pathToFileURL(target).href;
  let client = createClient({ url, intMode: "bigint" });
  try {
    const before = await inspectMigrationState(client, migrations);
    if (!before.compatible) throw new Error("Copy schema or migration history differs from baseline");
    if (before.state === "legacy") {
      client.close();
      // Use the installed Prisma CLI, not a manually invented migration ledger.
      const result = Bun.spawnSync([process.execPath, "node_modules/prisma/build/index.js", "migrate", "resolve", "--applied", baselineName], {
        env: { ...process.env, DATABASE_URL: `file:${target.replaceAll("\\", "/")}`, TURSO_AUTH_TOKEN: "", CHECKPOINT_DISABLE: "1", PRISMA_HIDE_UPDATE_MESSAGE: "true" },
      });
      if (result.exitCode !== 0) throw new Error("Prisma baseline marking failed");
      client = createClient({ url, intMode: "bigint" });
    }
    const after = await inspectMigrationState(client, migrations);
    if (!after.compatible || after.state !== "baselined" || after.fingerprint !== before.fingerprint) throw new Error("Baseline verification failed");
    return { event: "baseline_copy_verified", backupSha256: restore.sha256, schemaFingerprint: after.fingerprint, tables: restore.tables, rows: restore.rows, pending: after.pending };
  } finally { client.close(); }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [source, target, ...extra] = args;
  if (!source || !target || extra.length) {
    console.error("Uso: bun run db:baseline-copy -- arquivo.gobak CAMINHO_ABSOLUTO_NOVO.db");
    process.exitCode = 1;
  } else void baselineBackupCopy(source, target).then((result) => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ event: "baseline_copy_failed", message: "Ensaio não concluído. A origem e o backup não foram alterados. Não promover a cópia de destino sem revisão." }));
    process.exitCode = 1;
  });
}
