import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NextResponse } from "next/server";
import { attachSessionCookies, clearSessionCookies, readCookie, ServerSessions, sessionCookieNames, sessionHash, validMutationOrigin } from "../../src/lib/server-sessions";

const directory = await mkdtemp(join(tmpdir(), "odonto-session-test-"));
const file = join(directory, "sessions.db");
const orm = new PrismaClient({ datasourceUrl: `file:${file.replaceAll("\\", "/")}` });
let clock = new Date("2026-10-11T12:00:00Z");
const sessions = new ServerSessions(orm, () => clock);
const origin = "https://clinic.example.com";
beforeAll(async () => {
  const client = createClient({ url: pathToFileURL(file).href });
  try {
    await client.executeMultiple(await readFile(new URL("../../prisma/migrations/202610110001_baseline/migration.sql", import.meta.url), "utf8"));
    await client.executeMultiple(await readFile(new URL("../../prisma/migrations/202610110002_sessions/migration.sql", import.meta.url), "utf8"));
    await client.executeMultiple(await readFile(new URL("../../prisma/migrations/202610110003_user_access/migration.sql", import.meta.url), "utf8"));
  } finally { client.close(); }
  await orm.clinica.create({ data: { id: "c", nome: "Clínica fictícia" } });
  await orm.usuario.createMany({ data: [
    { id: "u", clinicaId: "c", nome: "Nome", email: "fake@example.com", senhaHash: "synthetic", papel: "dono" },
    { id: "u2", clinicaId: "c", nome: "Outro", email: "other@example.com", senhaHash: "synthetic", papel: "recepcao" },
  ] });
});
afterAll(async () => {
  await orm.$disconnect();
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("odonto-session-test-")) throw new Error("Unsafe test cleanup path");
  Bun.gc(true);
  try { await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch (error) {
    if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EBUSY") throw error;
    console.warn("Synthetic session fixtures retained until native Windows handles close.");
  }
});
const request = (token: string, csrf?: string, requestOrigin = origin) => new Request(`${origin}/api/test`, {
  method: "POST", headers: { cookie: `__Host-odonto_session=${token}`, origin: requestOrigin, ...(csrf ? { "x-csrf-token": csrf } : {}) },
});

describe("sessões revogáveis no banco isolado", () => {
  test("banco guarda somente hashes e credenciais distintas por sessão", async () => {
    const a = await sessions.create("u");
    const b = await sessions.create("u");
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    const stored = await orm.sessao.findUniqueOrThrow({ where: { id: a.id } });
    expect(stored.tokenHash).toBe(sessionHash(a.token));
    expect(stored.csrfHash).toBe(sessionHash(a.csrf));
    expect(JSON.stringify(stored)).not.toContain(a.token);
    expect(JSON.stringify(stored)).not.toContain(a.csrf);
    expect((await sessions.resolve(a.token))?.clinicaId).toBe("c");
  });
  test("revogação é imediata para novas requisições e idempotente", async () => {
    const a = await sessions.create("u");
    const b = await sessions.create("u2");
    expect((await sessions.revoke(a.id, "u2")).count).toBe(0);
    expect((await sessions.revoke(a.id, "u")).count).toBe(1);
    expect((await sessions.revoke(a.id, "u")).count).toBe(0);
    expect(await sessions.resolve(a.token)).toBeNull();
    expect(await sessions.resolve(b.token)).not.toBeNull();
  });
  test("expiração ocorre no limite e não renova silenciosamente", async () => {
    const a = await sessions.create("u");
    const previous = clock;
    try {
      clock = new Date(a.expires.getTime() - 1);
      expect(await sessions.resolve(a.token)).not.toBeNull();
      clock = a.expires;
      expect(await sessions.resolve(a.token)).toBeNull();
    } finally { clock = previous; }
  });
  test("permissões são lidas de novo e papel desconhecido não autentica", async () => {
    const a = await sessions.create("u2");
    await orm.usuario.update({ where: { id: "u2" }, data: { papel: "financeiro" } });
    expect((await sessions.resolve(a.token))?.papel).toBe("financeiro");
    await orm.usuario.update({ where: { id: "u2" }, data: { papel: "inventado" } });
    expect(await sessions.resolve(a.token)).toBeNull();
    await orm.usuario.update({ where: { id: "u2" }, data: { papel: "recepcao" } });
  });
  test("alteração exige origem exata e CSRF próprio da sessão", async () => {
    const a = await sessions.create("u");
    const b = await sessions.create("u");
    expect(await sessions.authorize(request(a.token, a.csrf), origin, true)).toMatchObject({ ok: true });
    for (const req of [request(a.token), request(a.token, b.csrf), request(a.token, a.csrf, "https://attacker.example.com")]) {
      expect(await sessions.authorize(req, origin, true)).toMatchObject({ ok: false, status: 403 });
    }
    const get = new Request(`${origin}/api/test`, { headers: { cookie: `__Host-odonto_session=${a.token}` } });
    expect(await sessions.authorize(get, origin, true)).toMatchObject({ ok: true });
  });
  test("cookies adulterados, duplicados e Bearer antigo não autenticam", async () => {
    const a = await sessions.create("u");
    expect(readCookie(new Request(origin, { headers: { cookie: `__Host-odonto_session=${a.token}; __Host-odonto_session=${a.token}` } }), "__Host-odonto_session")).toBeNull();
    expect(await sessions.resolve(`${a.token}extra`)).toBeNull();
    expect(await sessions.resolve("x".repeat(43))).toBeNull();
    expect(await sessions.authorize(new Request(origin, { headers: { authorization: `Bearer ${a.token}` } }), origin, true)).toMatchObject({ ok: false, status: 401 });
  });
  test("revogar todas as sessões não afeta outro usuário", async () => {
    const a = await sessions.create("u");
    const b = await sessions.create("u");
    const other = await sessions.create("u2");
    await sessions.revokeAll("u");
    expect(await sessions.resolve(a.token)).toBeNull();
    expect(await sessions.resolve(b.token)).toBeNull();
    expect(await sessions.resolve(other.token)).not.toBeNull();
  });
  test("cookies de produção restringem leitura da credencial e são limpos com os mesmos atributos", async () => {
    const credentials = await sessions.create("u2");
    const response = attachSessionCookies(NextResponse.json({ ok: true }), credentials, true);
    const auth = response.cookies.get("__Host-odonto_session")!;
    const csrf = response.cookies.get("__Host-odonto_csrf")!;
    expect(auth).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 604800 });
    expect(auth.domain).toBeUndefined();
    expect(csrf.httpOnly).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const cleared = clearSessionCookies(new NextResponse(null, { status: 204 }), true);
    expect(cleared.cookies.get("__Host-odonto_session")).toMatchObject({ value: "", maxAge: 0, secure: true, httpOnly: true });
    expect(sessionCookieNames(false).session).toBe("odonto_session");
  });
  test("não confia em Host forjado, Origin ausente ou URL de configuração com caminho", () => {
    expect(validMutationOrigin(new Request(origin, { method: "POST", headers: { host: "clinic.example.com" } }), origin)).toBe(false);
    expect(validMutationOrigin(new Request(origin, { method: "POST", headers: { origin } }), `${origin}/path`)).toBe(false);
    expect(validMutationOrigin(new Request(origin, { method: "POST", headers: { origin: "null" } }), origin)).toBe(false);
  });
  test("configuração de produção exige HTTPS mesmo para leitura", async () => {
    const a = await sessions.create("u");
    const get = new Request(origin, { headers: { cookie: `__Host-odonto_session=${a.token}` } });
    for (const invalid of ["http://clinic.example.com", "", `${origin}/path`]) {
      expect(await sessions.authorize(get, invalid, true)).toMatchObject({ ok: false, status: 503 });
    }
  });
  test("remoção do usuário elimina suas sessões por chave estrangeira", async () => {
    await orm.usuario.create({ data: { id: "temporary-user", clinicaId: "c", nome: "Temporário", email: "temporary@example.com", senhaHash: "fake", papel: "recepcao" } });
    const a = await sessions.create("temporary-user");
    await orm.usuario.delete({ where: { id: "temporary-user" } });
    expect(await sessions.resolve(a.token)).toBeNull();
    expect(await orm.sessao.count({ where: { usuarioId: "temporary-user" } })).toBe(0);
  });
});
