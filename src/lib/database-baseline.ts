import { createHash } from "node:crypto";
import { createClient, type Client } from "@libsql/client";

export const baselineName = "202610110001_baseline";
type SchemaObject = { type: string; name: string; table: string; sql: string };
export type BaselineReport = {
  compatible: boolean;
  state: "legacy" | "baselined" | "drift";
  fingerprint: string;
  tables: number;
  issues: string[];
  pending: string[];
};
export type MigrationDefinition = { name: string; sql: string };
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function quote(name: string) { return `"${name.replaceAll('"', '""')}"`; }

async function readSchema(client: Client) {
  const tx = await client.transaction("read");
  try {
    const objects = await tx.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND tbl_name <> '_prisma_migrations' ORDER BY type,name");
    const schema: SchemaObject[] = objects.rows.map((row) => ({ type: String(row.type), name: String(row.name), table: String(row.tbl_name), sql: String(row.sql) }));
    const metadata: Record<string, unknown> = {};
    for (const table of schema.filter((object) => object.type === "table")) {
      const columns = await tx.execute(`PRAGMA table_xinfo(${quote(table.name)})`);
      const foreignKeys = await tx.execute(`PRAGMA foreign_key_list(${quote(table.name)})`);
      const indices = await tx.execute(`PRAGMA index_list(${quote(table.name)})`);
      const indexedColumns: Record<string, unknown> = {};
      for (const row of indices.rows) indexedColumns[String(row.name)] = (await tx.execute(`PRAGMA index_xinfo(${quote(String(row.name))})`)).rows;
      // The driver may return bigint identifiers; serialize exactly, without rounding.
      metadata[table.name] = { columns: columns.rows, foreignKeys: foreignKeys.rows, indices: indices.rows, indexedColumns };
    }
    const integrity = await tx.execute("PRAGMA integrity_check");
    const foreignKeys = await tx.execute("PRAGMA foreign_key_check");
    const hasHistory = (await tx.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'")).rows.length > 0;
    const history = hasHistory ? (await tx.execute("SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name")).rows : [];
    await tx.commit();
    return { schema, metadata, history, hasHistory,
      integrity: integrity.rows.length === 1 && integrity.rows[0].integrity_check === "ok",
      foreignKeys: foreignKeys.rows.length === 0 };
  } finally { tx.close(); }
}

const stable = (value: unknown) => JSON.stringify(value, (_key, item) =>
  typeof item === "bigint" || (typeof item === "number" && Number.isSafeInteger(item)) ? item.toString() : item);

/** Conservative comparison, including SQL text (CHECKs/triggers), columns, FKs and indexes. */
export async function inspectBaseline(client: Client, baselineSql: string): Promise<BaselineReport> {
  return inspectMigrationState(client, [{ name: baselineName, sql: baselineSql }]);
}

export async function inspectMigrationState(client: Client, migrations: MigrationDefinition[]): Promise<BaselineReport> {
  if (migrations[0]?.name !== baselineName || new Set(migrations.map((migration) => migration.name)).size !== migrations.length) throw new Error("Invalid migration manifest");
  const expected = createClient({ url: "file::memory:", intMode: "bigint" });
  try {
    const actual = await readSchema(client);
    const issues: string[] = [];
    const applied = actual.hasHistory ? actual.history.length : 1;
    const prefix = migrations.slice(0, Math.max(1, applied));
    for (const migration of prefix) await expected.executeMultiple(migration.sql);
    const reference = await readSchema(expected);
    if (!actual.integrity) issues.push("integrity_failed");
    if (!actual.foreignKeys) issues.push("foreign_keys_failed");
    if (stable(actual.schema) !== stable(reference.schema)) issues.push("schema_objects_differ");
    if (stable(actual.metadata) !== stable(reference.metadata)) issues.push("columns_or_constraints_differ");
    if (actual.hasHistory) {
      if (!actual.history.length || actual.history.length > migrations.length || actual.history.some((entry, index) =>
          entry.migration_name !== migrations[index]?.name || entry.checksum !== digest(migrations[index]?.sql || "") ||
          !entry.finished_at || entry.rolled_back_at)) {
        issues.push("migration_history_differ");
      }
    }
    return { compatible: issues.length === 0, state: issues.length ? "drift" : actual.hasHistory ? "baselined" : "legacy",
      fingerprint: digest(stable({ schema: actual.schema, metadata: actual.metadata })),
      tables: actual.schema.filter((object) => object.type === "table").length, issues,
      pending: issues.length ? [] : migrations.slice(actual.hasHistory ? applied : 1).map((migration) => migration.name) };
  } finally { expected.close(); }
}
