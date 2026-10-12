import { afterAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";

const database = new Database(":memory:");
database.exec("PRAGMA foreign_keys = ON");
database.exec(readFileSync(new URL("../../prisma/migrations/202610110001_baseline/migration.sql", import.meta.url), "utf8"));
afterAll(() => database.close());

describe("schema inicial em SQLite isolado", () => {
  test("cria as vinte tabelas sem erros de integridade", () => {
    const tables = database.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    expect(tables.length).toBe(20);
    expect(database.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  test("não permite usuário vinculado a clínica inexistente", () => {
    expect(() => database.query("INSERT INTO usuario (id,clinica_id,nome,email,senha_hash,papel) VALUES (?,?,?,?,?,?)")
      .run("usuario", "clinica-inexistente", "Nome", "nome@example.com", "hash", "dono")).toThrow();
  });
});
