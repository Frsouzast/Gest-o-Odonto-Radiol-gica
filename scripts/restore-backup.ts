import { open } from "node:fs/promises";
import { backupKey, maxBackupBytes, restoreToNewFile } from "../src/lib/database-backup";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const [source, target, ...extra] = args;
  if (!source || !target || extra.length) throw new Error("Usage: bun scripts/restore-backup.ts archive.gobak absolute-new-file.db");
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const file = await open(source, "r");
  let archive: Buffer;
  try {
    if ((await file.stat()).size > maxBackupBytes + 36) throw new Error("Backup too large");
    archive = await file.readFile();
  } finally { await file.close(); }
  console.log(JSON.stringify({ event: "backup_restored_verified", ...await restoreToNewFile(archive, key, target) }));
}

if (import.meta.main) void main().catch(() => {
  console.error(JSON.stringify({ event: "restore_failed", message: "Restauração não concluída. Confira chave, arquivo e destino novo. Se foi criado um banco de destino, não o use sem verificação." }));
  process.exitCode = 1;
});
