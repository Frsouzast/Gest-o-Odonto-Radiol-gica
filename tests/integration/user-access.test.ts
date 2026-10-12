import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadMigrations } from "../../scripts/migration-manifest";
import { changeUserAccess } from "../../src/lib/user-access";
import { ServerSessions } from "../../src/lib/server-sessions";
import type { AuthPayload } from "../../src/lib/auth";

const directory = await mkdtemp(join(tmpdir(), "odonto-access-test-"));
const file = join(directory, "access.db");
const orm = new PrismaClient({ datasourceUrl: `file:${file.replaceAll("\\", "/")}` });
const sessions = new ServerSessions(orm);
let actor: AuthPayload;
beforeAll(async () => {
  const client = createClient({ url: pathToFileURL(file).href });
  try { for (const migration of await loadMigrations()) await client.executeMultiple(migration.sql); }
  finally { client.close(); }
  await orm.clinica.create({ data: { id: "clinic", nome: "Fictícia" } });
  await orm.usuario.createMany({ data: [
    { id: "owner", clinicaId: "clinic", nome: "Dono fictício", email: "owner@example.test", senhaHash: "fake", papel: "dono" },
    { id: "staff", clinicaId: "clinic", nome: "Equipe fictícia", email: "staff@example.test", senhaHash: "fake", papel: "recepcao" },
  ] });
  actor = { usuarioId: "owner", clinicaId: "clinic", papel: "dono", sessaoId: (await sessions.create("owner")).id };
});
afterAll(async () => {
  await orm.$disconnect();
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("odonto-access-test-")) throw new Error("Unsafe test cleanup path");
  Bun.gc(true);
  try { await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch (error) {
    if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EBUSY") throw error;
    console.warn("Synthetic access fixtures retained until Windows handles close.");
  }
});

test("falha ao revogar desfaz alteração de função e de acesso na mesma transação", async () => {
  const access = await sessions.create("staff");
  const failing = orm.$extends({ query: { sessao: { updateMany: async () => { throw new Error("Synthetic revocation failure"); } } } });
  await expect(changeUserAccess(failing as unknown as PrismaClient, actor, "staff", { papel: "financeiro", ativo: false })).rejects.toThrow("Synthetic revocation failure");
  expect((await orm.usuario.findUniqueOrThrow({ where: { id: "staff" } })).papel).toBe("recepcao");
  expect(await orm.usuarioAcesso.findUnique({ where: { usuarioId: "staff" } })).toBeNull();
  expect((await sessions.resolve(access.token))?.usuarioId).toBe("staff");
});
test("transação recusa papel antigo do dono quando função atual mudou", async () => {
  try {
    await orm.usuario.update({ where: { id: actor.usuarioId }, data: { papel: "financeiro" } });
    await expect(changeUserAccess(orm, actor, "staff", { ativo: false })).rejects.toMatchObject({ status: 403 });
    expect(await orm.usuarioAcesso.findUnique({ where: { usuarioId: "staff" } })).toBeNull();
  } finally { await orm.usuario.update({ where: { id: actor.usuarioId }, data: { papel: "dono" } }); }
});
test("sessão revogada antes da transação não autoriza gerência", async () => {
  const temporary: AuthPayload = { ...actor, sessaoId: (await sessions.create("owner")).id };
  await sessions.revoke(temporary.sessaoId, temporary.usuarioId);
  await expect(changeUserAccess(orm, temporary, "staff", { ativo: false })).rejects.toMatchObject({ status: 401 });
});
test("nenhuma alteração é idempotente e não encerra acesso válido", async () => {
  const access = await sessions.create("staff");
  expect(await changeUserAccess(orm, actor, "staff", { papel: "recepcao", ativo: true })).toMatchObject({ ativo: true, papel: "recepcao" });
  expect((await sessions.resolve(access.token))?.usuarioId).toBe("staff");
});
test("estado desativado impede resolução mesmo com credencial não revogada", async () => {
  const access = await sessions.create("staff");
  await orm.usuarioAcesso.upsert({ where: { usuarioId: "staff" }, create: { usuarioId: "staff", ativo: false }, update: { ativo: false } });
  try { expect(await sessions.resolve(access.token)).toBeNull(); }
  finally { await orm.usuarioAcesso.update({ where: { usuarioId: "staff" }, data: { ativo: true } }); }
});
