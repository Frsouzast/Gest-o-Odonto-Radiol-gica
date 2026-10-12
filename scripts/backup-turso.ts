import { createClient } from "@libsql/client";
import { mkdir, open, link, unlink, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { backupKey, captureSnapshot, encryptSnapshot } from "../src/lib/database-backup";

async function main() {
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  let url = process.env.DATABASE_URL;
  if (!url) throw new Error("Configure DATABASE_URL");
  if (url.startsWith("file:")) {
    // Prisma resolves relative SQLite paths from the schema directory.
    // Do not silently create an empty source database at a different location.
    if (url.includes("?") || url.includes("#") || url === "file::memory:") throw new Error("Use an explicit SQLite file source");
    const localPath = url.startsWith("file://") ? fileURLToPath(url) : resolve("prisma", url.slice(5));
    if (!(await stat(localPath)).isFile()) throw new Error("Backup source is not a database file");
    url = pathToFileURL(localPath).href;
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN, intMode: "bigint" });
  try {
    const snapshot = await captureSnapshot(client);
    const requiredTables = ["clinica", "usuario", "capacidade_produtiva", "despesa_fixa", "ativo", "funcionario", "insumo",
      "procedimento", "procedimento_insumo", "historico_preco", "agendamento", "convenio", "convenio_tabela_preco",
      "despesa_recorrente", "conta_pagar", "conta_receber", "glosa", "financeiro_config", "lote_faturamento", "movimento_bancario"];
    const names = new Set(snapshot.tables.map((table) => table.name));
    if (requiredTables.some((table) => !names.has(table))) throw new Error("Source is missing required app tables");
    const archive = encryptSnapshot(snapshot, key);
    const directory = resolve(process.env.BACKUP_DIRECTORY || "backup");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `odonto-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.gobak`);
    const partial = `${path}.partial`;
    const file = await open(partial, "wx", 0o600);
    try { await file.writeFile(archive); await file.sync(); }
    finally { await file.close(); }
    // Exclusive publication only after flush; never expose an unfinished .gobak.
    await link(partial, path);
    await unlink(partial);
    console.log(JSON.stringify({ event: "backup_created", path }));
  } finally { client.close(); }
}

if (import.meta.main) void main().catch(() => {
  console.error(JSON.stringify({ event: "backup_failed", message: "Backup não concluído. Confira configuração, conexão e integridade. Nenhum backup parcial deve ser usado." }));
  process.exitCode = 1;
});
