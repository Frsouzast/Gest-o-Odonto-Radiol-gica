import { createClient } from "@libsql/client";
import { pathToFileURL } from "node:url";
import { captureSnapshot } from "../src/lib/database-backup";
import { inspectMigrationState } from "../src/lib/database-baseline";
import { baselineBackupCopy } from "./baseline-backup-copy";
import { loadMigrations } from "./migration-manifest";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [source, target, ...extra] = args;
  if (!source || !target || extra.length) throw new Error("Use backup and fresh absolute local database path");
  const baseline = await baselineBackupCopy(source, target);
  const url = pathToFileURL(target).href;
  const beforeClient = createClient({ url, intMode: "bigint" });
  let before;
  try { before = await captureSnapshot(beforeClient); } finally { beforeClient.close(); }
  const applied = Bun.spawnSync([process.execPath, "node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${target.replaceAll("\\", "/")}`, TURSO_AUTH_TOKEN: "", CHECKPOINT_DISABLE: "1", PRISMA_HIDE_UPDATE_MESSAGE: "true" },
  });
  if (applied.exitCode !== 0) throw new Error("Migration rehearsal failed");
  const afterClient = createClient({ url, intMode: "bigint" });
  try {
    const report = await inspectMigrationState(afterClient, await loadMigrations());
    if (!report.compatible || report.pending.length) throw new Error("Migration state verification failed");
    const after = await captureSnapshot(afterClient);
    // This gate currently supports additive migrations only. Transformations need
    // explicit per-migration data invariants, not silent approval of changed data.
    for (const table of before.tables.filter((table) => table.name !== "_prisma_migrations")) {
      const restored = after.tables.find((entry) => entry.name === table.name);
      const sortedRows = (rows: unknown[][]) => rows.map((row) => JSON.stringify(row)).sort();
      if (!restored || JSON.stringify(restored.columns) !== JSON.stringify(table.columns) ||
          JSON.stringify(sortedRows(restored.rows)) !== JSON.stringify(sortedRows(table.rows))) throw new Error("Existing application data changed");
    }
    console.log(JSON.stringify({ event: "database_update_rehearsal_verified", backupSha256: baseline.backupSha256,
      schemaFingerprint: report.fingerprint, appTables: report.tables, pending: report.pending }));
  } finally { afterClient.close(); }
}

if (import.meta.main) void main().catch(() => {
  console.error(JSON.stringify({ event: "database_update_rehearsal_failed", message: "Ensaio não aprovado. Origem e backup preservados; não promover a cópia de destino." }));
  process.exitCode = 1;
});
