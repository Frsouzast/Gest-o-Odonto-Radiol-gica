import { createClient } from "@libsql/client";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectMigrationState } from "../src/lib/database-baseline";
import { loadMigrations } from "./migration-manifest";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [target, ...extra] = args;
  // No default .env source. Local explicit paths only in this first rehearsal tool.
  if (!target || extra.length || !isAbsolute(target) || !target.endsWith(".db") || !(await stat(target)).isFile()) throw new Error("Use an existing absolute local .db path");
  const client = createClient({ url: pathToFileURL(target).href, intMode: "bigint" });
  try {
    const report = await inspectMigrationState(client, await loadMigrations());
    console.log(JSON.stringify({ event: "database_baseline_inspected", ...report }));
    if (!report.compatible) process.exitCode = 2;
  } finally { client.close(); }
}

if (import.meta.main) void main().catch(() => {
  console.error(JSON.stringify({ event: "database_inspection_failed", message: "Não foi possível verificar a estrutura e a integridade. Nenhuma atualização foi aplicada." }));
  process.exitCode = 1;
});
