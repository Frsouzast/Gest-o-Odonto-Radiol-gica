import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type Value, type InValue } from "@libsql/client";
import { z } from "zod";

const magic = Buffer.from("GOBAK001");
export const maxBackupBytes = 100 * 1_024 * 1_024;
const cellSchema = z.union([
  z.null(), z.string(), z.number().finite(),
  z.object({ integer: z.string().regex(/^-?\d+$/) }).strict(),
  z.object({ blob: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) }).strict(),
]);
const snapshotSchema = z.object({
  version: z.literal(1), createdAt: z.iso.datetime(),
  schema: z.array(z.object({ type: z.enum(["table", "index", "view", "trigger"]), name: z.string().min(1), sql: z.string().min(1) }).strict()),
  tables: z.array(z.object({ name: z.string().min(1), columns: z.array(z.string().min(1)), rows: z.array(z.array(cellSchema)) }).strict()),
  sequences: z.array(z.object({ name: z.string(), value: cellSchema }).strict()),
}).strict();
export type DatabaseSnapshot = z.infer<typeof snapshotSchema>;
type Cell = z.infer<typeof cellSchema>;

function quote(name: string) { return `"${name.replaceAll('"', '""')}"`; }
function encodeCell(value: Value): Cell {
  if (typeof value === "bigint") return { integer: value.toString() };
  if (value instanceof ArrayBuffer) return { blob: Buffer.from(value).toString("base64") };
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Unsupported non-finite database value");
  return value;
}
function decodeCell(value: Cell): InValue {
  if (value && typeof value === "object") {
    if ("integer" in value) return BigInt(value.integer);
    return Buffer.from(value.blob, "base64");
  }
  return value;
}

export function backupKey(raw: string | undefined): Buffer {
  if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw)) throw new Error("Configure BACKUP_ENCRYPTION_KEY com 64 caracteres hexadecimais aleatórios.");
  return Buffer.from(raw, "hex");
}

function validateSnapshot(value: unknown): DatabaseSnapshot {
  const data = snapshotSchema.parse(value);
  const schemaTables = data.schema.filter((entry) => entry.type === "table");
  const names = new Set(schemaTables.map((entry) => entry.name));
  if (names.size !== schemaTables.length || data.tables.length !== names.size || new Set(data.tables.map((table) => table.name)).size !== names.size) throw new Error("Invalid backup table manifest");
  for (const entry of data.schema) {
    const prefix = entry.type === "index" ? /^CREATE\s+(UNIQUE\s+)?INDEX\s/i : new RegExp(`^CREATE\\s+${entry.type}\\s`, "i");
    if (!prefix.test(entry.sql) || entry.name.startsWith("sqlite_")) throw new Error("Unsupported backup schema object");
  }
  for (const table of data.tables) {
    if (!names.has(table.name) || !table.columns.length || new Set(table.columns).size !== table.columns.length || table.rows.some((row) => row.length !== table.columns.length)) throw new Error("Invalid backup row manifest");
  }
  for (const sequence of data.sequences) if (!names.has(sequence.name)) throw new Error("Invalid backup sequence");
  return data;
}

/** One read transaction: any error aborts the entire backup, never a partial success. */
export async function captureSnapshot(client: Client): Promise<DatabaseSnapshot> {
  const tx = await client.transaction("read");
  try {
    const objects = await tx.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
    const schema = objects.rows.map((row) => ({ type: row.type, name: row.name, sql: row.sql }));
    const tables: DatabaseSnapshot["tables"] = [];
    let totalRows = 0;
    for (const entry of schema.filter((object) => object.type === "table")) {
      const name = String(entry.name);
      if (!/^CREATE\s+TABLE\s/i.test(String(entry.sql))) throw new Error("Virtual tables require a dedicated backup strategy");
      const metadata = await tx.execute(`PRAGMA table_xinfo(${quote(name)})`);
      const columns = metadata.rows.filter((row) => Number(row.hidden) === 0).map((row) => String(row.name));
      const rows: Cell[][] = [];
      for (let offset = 0; ; offset += 1_000) {
        const page = await tx.execute(`SELECT ${columns.map(quote).join(",")} FROM ${quote(name)} LIMIT 1000 OFFSET ${offset}`);
        for (const row of page.rows) rows.push(columns.map((column) => encodeCell(row[column])));
        totalRows += page.rows.length;
        if (totalRows > 200_000) throw new Error("Backup exceeds the supported row limit");
        if (page.rows.length < 1_000) break;
      }
      tables.push({ name, columns, rows });
    }
    const hasSequences = await tx.execute("SELECT name FROM sqlite_master WHERE name='sqlite_sequence'");
    const sequences = hasSequences.rows.length ? (await tx.execute("SELECT name, seq FROM sqlite_sequence")).rows.map((row) => ({ name: String(row.name), value: encodeCell(row.seq) })) : [];
    if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Source contains broken foreign keys");
    const integrity = await tx.execute("PRAGMA integrity_check");
    if (integrity.rows.length !== 1 || integrity.rows[0].integrity_check !== "ok") throw new Error("Source integrity check failed");
    const snapshot = validateSnapshot({ version: 1, createdAt: new Date().toISOString(), schema, tables, sequences });
    if (Buffer.byteLength(JSON.stringify(snapshot)) > maxBackupBytes) throw new Error("Backup exceeds the supported byte limit");
    await tx.commit();
    return snapshot;
  } finally { tx.close(); }
}

export function encryptSnapshot(snapshot: DatabaseSnapshot, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error("Invalid backup key length");
  const plain = Buffer.from(JSON.stringify(validateSnapshot(snapshot)));
  if (plain.length > maxBackupBytes) throw new Error("Backup too large");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([magic, nonce, cipher.getAuthTag(), encrypted]);
}

export function decryptSnapshot(archive: Buffer, key: Buffer): DatabaseSnapshot {
  if (key.length !== 32 || archive.length < 36 || archive.length > maxBackupBytes + 36 || !archive.subarray(0, 8).equals(magic)) throw new Error("Invalid backup format or size");
  const decipher = createDecipheriv("aes-256-gcm", key, archive.subarray(8, 20));
  decipher.setAAD(magic);
  decipher.setAuthTag(archive.subarray(20, 36));
  const plain = Buffer.concat([decipher.update(archive.subarray(36)), decipher.final()]);
  return validateSnapshot(JSON.parse(plain.toString("utf8")));
}

/** Only a fresh, absolute local file. Never accepts a remote URL or overwrites a database. */
export async function restoreToNewFile(archive: Buffer, key: Buffer, target: string): Promise<{ tables: number; rows: number; sha256: string }> {
  const snapshot = decryptSnapshot(archive, key);
  if (!isAbsolute(target) || !target.endsWith(".db")) throw new Error("Use an absolute path to a new .db file");
  const file = await open(target, "wx", 0o600);
  await file.close();
  const client = createClient({ url: pathToFileURL(target).href, intMode: "bigint" });
  try {
    await client.execute("PRAGMA trusted_schema = OFF");
    await client.execute("PRAGMA foreign_keys = OFF");
    const tx = await client.transaction("write");
    try {
      for (const entry of snapshot.schema.filter((object) => object.type === "table")) await tx.execute(entry.sql);
      for (const table of snapshot.tables) {
        const sql = `INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(",")}) VALUES (${table.columns.map(() => "?").join(",")})`;
        for (const row of table.rows) await tx.execute({ sql, args: row.map(decodeCell) });
      }
      if (snapshot.sequences.length) {
        await tx.execute("DELETE FROM sqlite_sequence");
        for (const sequence of snapshot.sequences) await tx.execute({ sql: "INSERT INTO sqlite_sequence(name,seq) VALUES (?,?)", args: [sequence.name, decodeCell(sequence.value)] });
      }
      // Views must exist before their INSTEAD OF triggers. Triggers follow data
      // so restoring inserts does not duplicate historical side effects.
      for (const type of ["index", "view", "trigger"] as const) {
        for (const entry of snapshot.schema.filter((object) => object.type === type)) await tx.execute(entry.sql);
      }
      if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Restore foreign key check failed");
      const integrity = await tx.execute("PRAGMA integrity_check");
      if (integrity.rows.length !== 1 || integrity.rows[0].integrity_check !== "ok") throw new Error("Restore integrity check failed");
      for (const table of snapshot.tables) {
        const count = await tx.execute(`SELECT COUNT(*) AS total FROM ${quote(table.name)}`);
        if (Number(count.rows[0].total) !== table.rows.length) throw new Error("Restore row count mismatch");
      }
      await tx.commit();
    } finally { tx.close(); }
    await client.execute("PRAGMA foreign_keys = ON");
    return { tables: snapshot.tables.length, rows: snapshot.tables.reduce((total, table) => total + table.rows.length, 0), sha256: createHash("sha256").update(archive).digest("hex") };
  } finally { client.close(); }
}
