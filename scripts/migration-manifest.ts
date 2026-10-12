import { readdir, readFile } from "node:fs/promises";
import type { MigrationDefinition } from "../src/lib/database-baseline";

export async function loadMigrations(): Promise<MigrationDefinition[]> {
  const directory = new URL("../prisma/migrations/", import.meta.url);
  const names = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (names.some((name) => !/^\d{12,14}_[a-z0-9_]+$/.test(name))) throw new Error("Unsupported migration directory name");
  return Promise.all(names.map(async (name) => ({ name, sql: await readFile(new URL(`${name}/migration.sql`, directory), "utf8") })));
}
