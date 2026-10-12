import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { sessionHash } from "../../src/lib/server-sessions";

const directory = await mkdtemp(join(tmpdir(), "odonto-http-test-"));
const file = join(directory, "isolated.db");
const databaseUrl = `file:${file.replaceAll("\\", "/")}`;
const orm = new PrismaClient({ datasourceUrl: databaseUrl });
let child: ReturnType<typeof Bun.spawn> | undefined;
let origin = "";
const password = "Ficticia-Segura-123!";
type Identity = { usuario: { id: string; papel: string }; clinica: { id: string; nome: string }; token?: string };
type Access = { cookie: string; csrf: string; token: string; identity: Identity };
let owner: Access;

async function request(path: string, access?: Access, method = "GET", body?: unknown, overrides: Record<string, string> = {}) {
  return fetch(`${origin}${path}`, {
    method, headers: { "Content-Type": "application/json", origin,
      ...(access ? { cookie: access.cookie, "x-csrf-token": access.csrf } : {}), ...overrides },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
}
async function accessFrom(response: Response): Promise<Access> {
  if (!response.ok) throw new Error(`Synthetic authentication failed: HTTP ${response.status}, ${await response.text()}`);
  expect(response.ok).toBe(true);
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((item) => item.startsWith("odonto_session="))!;
  expect(session).toContain("HttpOnly");
  expect(session).toContain("SameSite=lax");
  expect(session).toContain("Path=/");
  const cookie = cookies.map((item) => item.split(";")[0]).join("; ");
  const csrf = cookies.find((item) => item.startsWith("odonto_csrf="))!.split(";")[0].slice("odonto_csrf=".length);
  const identity = await response.json() as Identity;
  expect(identity.token).toBeUndefined();
  return { cookie, csrf, token: session.split(";")[0].slice("odonto_session=".length), identity };
}
const login = async () => accessFrom(await request("/api/auth/login", undefined, "POST", { email: "owner@example.test", senha: password }));

test("precificação exige configuração válida e mantém preço e margem coerentes", async () => {
  const access = await accessFrom(await request("/api/auth/registrar", undefined, "POST", { clinicaNome: "Precificação FICTÍCIA", usuarioNome: "Responsável fictício", email: "pricing@example.test", senha: password }));
  const clinicaId = access.identity.clinica.id;
  const procId = "pricing-fixture-procedure";
  await orm.procedimento.create({ data: { id: procId, clinicaId, nome: "Procedimento fictício de conferência", tempoMinutos: 20, laudos: 10, retrabalhoPct: 0.1, comissaoPct: 0.05, lucroDesejadoPct: 0.3, inadimplenciaPct: 0.02, impostosPct: 0.08, taxaCartaoPct: 0.03, outrosPct: 0, precoFinal: 150 } });
  const paths = ["/api/resumo", "/api/procedimentos/health-check", `/api/procedimentos/${procId}/calculo`];
  for (const path of paths) expect((await request(path, access)).status).toBe(400);
  await orm.capacidadeProdutiva.create({ data: { clinicaId, diasTrabalhados: 20, horasPorDia: 8, unidadesRenda: 1, percentOcupacao: 0.75 } });
  for (const path of paths) {
    const response = await request(path, access);
    expect(response.status).toBe(400);
    expect((await response.json()).erro).toContain("Custos não cadastrados");
  }
  await orm.despesaFixa.create({ data: { id: "pricing-fixture-cost", clinicaId, nome: "Custo fictício", valor: 7200 } });
  await orm.capacidadeProdutiva.update({ where: { clinicaId }, data: { percentOcupacao: 0 } });
  for (const path of paths) {
    const response = await request(path, access);
    expect(response.status).toBe(400);
    expect((await response.json()).erro).toContain("acima de 0%");
  }
  await orm.capacidadeProdutiva.update({ where: { clinicaId }, data: { percentOcupacao: 0.75 } });
  await orm.insumo.create({ data: { id: "pricing-fixture-material", clinicaId, nome: "Material fictício", valorTotal: 250, quantidade: 100 } });
  await orm.procedimentoInsumo.create({ data: { procedimentoId: procId, insumoId: "pricing-fixture-material", quantidade: 2 } });
  const response = await request(paths[2], access);
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ custoDireto: 37.5, retrabalhoValor: 2.5, precoSugerido: 72.12, pontoEquilibrio: 45.74 });
  // Sugestões não sobrescrevem o preço escolhido pela clínica.
  expect((await orm.procedimento.findUniqueOrThrow({ where: { id: procId } })).precoFinal).toBe(150);
  await orm.procedimento.update({ where: { id: procId }, data: { precoFinal: result.precoSugerido } });
  expect((await (await request(paths[2], access)).json()).lucratividadeFinal).toBeGreaterThanOrEqual(0.3);
  expect((await (await request(paths[0], access)).json()).custoFixoPorMinuto).toBe(1);
  expect((await (await request(paths[1], access)).json()).procedimentos[0].precoSugerido).toBe(72.12);
  await orm.insumo.update({ where: { id: "pricing-fixture-material" }, data: { quantidade: 0 } });
  expect((await request(paths[2], access)).status).toBe(400);
  expect((await request(paths[1], access)).status).toBe(400);
  await orm.insumo.update({ where: { id: "pricing-fixture-material" }, data: { quantidade: 100 } });
  await orm.procedimento.update({ where: { id: procId }, data: { tempoMinutos: 0 } });
  expect((await request(paths[2], access)).status).toBe(400);
  await orm.procedimento.update({ where: { id: procId }, data: { tempoMinutos: 20, lucroDesejadoPct: 0.9 } });
  expect((await request(paths[2], access)).status).toBe(400);
  expect((await request(paths[1], access)).status).toBe(400);
}, 90_000);

beforeAll(async () => {
  const client = createClient({ url: pathToFileURL(file).href });
  try {
    for (const name of ["202610110001_baseline", "202610110002_sessions", "202610110003_user_access"]) {
      await client.executeMultiple(await readFile(resolve("prisma/migrations", name, "migration.sql"), "utf8"));
    }
  } finally { client.close(); }
  const port = await new Promise<number>((accept, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No test port"));
      server.close((error) => error ? reject(error) : accept(address.port));
    });
  });
  origin = `http://127.0.0.1:${port}`;
  child = Bun.spawn([process.execPath, "node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "", APP_ORIGIN: origin,
      APP_RUNTIME_TEST: "1", NODE_ENV: "development", AUTH_SECRET: "isolated-http-test-only-secret-32chars",
      AUTH_RATE_LIMIT_REDIS_URL: "", AUTH_RATE_LIMIT_REDIS_TOKEN: "", AUTH_RATE_LIMIT_TRUST_PROXY: "false",
      NEXT_TELEMETRY_DISABLED: "1" },
    stdout: process.env.APP_HTTP_TEST_LOGS === "1" ? "inherit" : "ignore",
    stderr: process.env.APP_HTTP_TEST_LOGS === "1" ? "inherit" : "ignore",
  });
  const deadline = Date.now() + 45_000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try { ready = (await fetch(`${origin}/api`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise((accept) => setTimeout(accept, 250));
  }
  if (!ready) throw new Error("Isolated app did not become ready; real database was not used.");
  owner = await accessFrom(await request("/api/auth/registrar", undefined, "POST", {
    clinicaNome: "Clínica fictícia A", usuarioNome: "Pessoa fictícia", email: "owner@example.test", senha: password,
  }));
}, 90_000);

afterAll(async () => {
  if (child) { child.kill(); await child.exited; }
  await orm.$disconnect();
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("odonto-http-test-")) throw new Error("Unsafe test cleanup");
  Bun.gc(true);
  try { await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch (error) {
    if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EBUSY") throw error;
    console.warn("Synthetic HTTP fixtures retained until Windows handles close.");
  }
});

test("cadastro real retorna identidade, guarda hashes e restaura sessão no servidor", async () => {
  const stored = await orm.sessao.findUniqueOrThrow({ where: { tokenHash: sessionHash(owner.token) } });
  expect(stored.csrfHash).toBe(sessionHash(owner.csrf));
  expect(JSON.stringify(stored)).not.toContain(owner.token);
  const me = await request("/api/auth/me", owner);
  expect(me.status).toBe(200);
  expect((await me.json()).usuario.id).toBe(owner.identity.usuario.id);
  expect(me.headers.get("cache-control")).toContain("no-store");
  expect((await request("/api/clinica")).status).toBe(401);
  expect((await request("/api/clinica", undefined, "GET", undefined, { authorization: `Bearer ${owner.token}` })).status).toBe(401);
});

test("alterações exigem origem e proteção CSRF; uma clínica não lê outra", async () => {
  const payload = { diasTrabalhados: 20, horasPorDia: 8, unidadesRenda: 2, percentOcupacao: 0.8 };
  expect((await request("/api/capacidade", owner, "PUT", payload, { "x-csrf-token": "" })).status).toBe(403);
  expect((await request("/api/capacidade", owner, "PUT", payload, { origin: "https://untrusted.example" })).status).toBe(403);
  expect(await orm.capacidadeProdutiva.count({ where: { clinicaId: owner.identity.clinica.id } })).toBe(0);
  expect((await request("/api/capacidade", owner, "PUT", payload)).status).toBe(200);
  const other = await accessFrom(await request("/api/auth/registrar", undefined, "POST", {
    clinicaNome: "Clínica fictícia B", usuarioNome: "Outra pessoa", email: "other@example.test", senha: password,
  }));
  expect((await (await request("/api/capacidade", other)).json())).toBeNull();
  expect((await (await request("/api/clinica", other)).json()).id).toBe(other.identity.clinica.id);
  expect(other.identity.clinica.id).not.toBe(owner.identity.clinica.id);
});

test("cadastro duplicado e origem indevida não deixam clínica órfã", async () => {
  const count = await orm.clinica.count();
  const payload = { clinicaNome: "Não deve existir", usuarioNome: "Fictício", email: "owner@example.test", senha: password };
  expect((await request("/api/auth/registrar", undefined, "POST", payload)).status).toBe(409);
  expect((await request("/api/auth/registrar", undefined, "POST", payload, { origin: "https://untrusted.example" })).status).toBe(403);
  expect(await orm.clinica.count()).toBe(count);
});

test("sair revoga acesso antigo; novo login cria sessão independente", async () => {
  const access = await login();
  expect((await request("/api/auth/logout", access, "POST", undefined, { "x-csrf-token": "" })).status).toBe(403);
  expect((await request("/api/auth/me", access)).status).toBe(200);
  const logout = await request("/api/auth/logout", access, "POST");
  expect(logout.status).toBe(204);
  expect(logout.headers.getSetCookie().every((item) => item.includes("Max-Age=0"))).toBe(true);
  expect((await request("/api/auth/me", access)).status).toBe(401);
  expect((await request("/api/clinica", access)).status).toBe(401);
  expect((await orm.sessao.findUniqueOrThrow({ where: { tokenHash: sessionHash(access.token) } })).revogadaEm).not.toBeNull();
  const fresh = await login();
  expect(fresh.token).not.toBe(access.token);
  expect((await request("/api/auth/me", fresh)).status).toBe(200);
});

test("expiração e mudança de função valem na próxima requisição", async () => {
  const access = await login();
  try {
    await orm.usuario.update({ where: { id: owner.identity.usuario.id }, data: { papel: "recepcao" } });
    expect((await (await request("/api/auth/me", access)).json()).usuario.papel).toBe("recepcao");
    expect((await request("/api/capacidade", access, "PUT", { diasTrabalhados: 10, horasPorDia: 8, unidadesRenda: 1, percentOcupacao: 0.5 })).status).toBe(403);
    await orm.sessao.update({ where: { tokenHash: sessionHash(access.token) }, data: { expiraEm: new Date(0) } });
    expect((await request("/api/auth/me", access)).status).toBe(401);
  } finally {
    await orm.usuario.update({ where: { id: owner.identity.usuario.id }, data: { papel: "dono" } });
  }
});

test("dono altera função, desativa e reativa equipe sem reviver acessos antigos", async () => {
  const created = await request("/api/auth/convidar", owner, "POST", { nome: "Equipe fictícia", email: "staff@example.test", senha: password, papel: "recepcao" });
  expect(created.status).toBe(201);
  const staff = await created.json();
  const staffLogin = async () => accessFrom(await request("/api/auth/login", undefined, "POST", { email: "staff@example.test", senha: password }));
  const a = await staffLogin();
  const b = await staffLogin();
  expect((await request("/api/usuarios", a)).status).toBe(403);
  expect((await request(`/api/usuarios/${staff.id}`, a, "PATCH", { ativo: false })).status).toBe(403);
  expect((await request(`/api/usuarios/${staff.id}`, owner, "PATCH", { papel: "financeiro" })).status).toBe(200);
  expect((await request("/api/auth/me", a)).status).toBe(401);
  expect((await request("/api/auth/me", b)).status).toBe(401);
  const financial = await staffLogin();
  expect(financial.identity.usuario.papel).toBe("financeiro");
  expect((await request(`/api/usuarios/${staff.id}`, financial, "PATCH", { papel: "recepcao" })).status).toBe(403);
  expect((await request(`/api/usuarios/${staff.id}`, owner, "PATCH", { ativo: false })).status).toBe(200);
  expect((await request("/api/clinica", financial)).status).toBe(401);
  expect((await request("/api/auth/login", undefined, "POST", { email: "staff@example.test", senha: password })).status).toBe(401);
  expect(await orm.usuario.count({ where: { id: staff.id } })).toBe(1);
  const list = await (await request("/api/usuarios", owner)).json();
  expect(list.find((item: { id: string }) => item.id === staff.id)).toMatchObject({ ativo: false, papel: "financeiro" });
  expect(JSON.stringify(list)).not.toContain("senhaHash");
  expect(JSON.stringify(list)).not.toContain(password);
  expect((await request(`/api/usuarios/${staff.id}`, owner, "PATCH", { ativo: true })).status).toBe(200);
  expect((await request("/api/auth/me", financial)).status).toBe(401);
  const fresh = await staffLogin();
  expect((await request("/api/auth/me", fresh)).status).toBe(200);
  expect(await orm.sessao.count({ where: { usuarioId: staff.id, revogadaEm: null } })).toBe(1);
}, 30_000);

test("gerência protege dono, valida conteúdo e não alcança usuário de outra clínica", async () => {
  const other = await accessFrom(await request("/api/auth/registrar", undefined, "POST", {
    clinicaNome: "Clínica fictícia C", usuarioNome: "Outra pessoa", email: "third@example.test", senha: password,
  }));
  const target = `/api/usuarios/${other.identity.usuario.id}`;
  expect((await request(target, owner, "PATCH", { ativo: false })).status).toBe(404);
  expect((await request("/api/usuarios/inexistente", owner, "PATCH", { ativo: false })).status).toBe(404);
  expect((await request(`/api/usuarios/${owner.identity.usuario.id}`, owner, "PATCH", { ativo: false })).status).toBe(409);
  for (const body of [{ papel: "dono" }, { ativo: "false" }, {}, { email: "bad@example.test" }]) {
    expect((await request(target, owner, "PATCH", body)).status).toBe(400);
  }
  expect((await request(target, owner, "PATCH", { ativo: false }, { "x-csrf-token": "" })).status).toBe(403);
  expect(await orm.usuarioAcesso.findUnique({ where: { usuarioId: other.identity.usuario.id } })).toBeNull();
  expect((await request("/api/auth/me", other)).status).toBe(200);
});

test("recepção não alcança métodos financeiros ou de equipe e mantém consulta operacional", async () => {
  const stored = await orm.usuario.findUniqueOrThrow({ where: { id: owner.identity.usuario.id } });
  await orm.usuario.create({ data: { id: "permission-reception", clinicaId: stored.clinicaId, nome: "Recepção fictícia", email: "permissions@example.test", senhaHash: stored.senhaHash, papel: "recepcao" } });
  const reception = await accessFrom(await request("/api/auth/login", undefined, "POST", { email: "permissions@example.test", senha: password }));
  const root = resolve("src/app/api");
  async function routeFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => entry.isDirectory() ? routeFiles(join(directory, entry.name)) : Promise.resolve(entry.name === "route.ts" ? [join(directory, entry.name)] : [])))).flat();
  }
  let denied = 0;
  // Independent contract: only these operational endpoints are allowed.
  const allowed = new Set(["GET /api/clinica", "GET /api/procedimentos", "GET /api/busca"]);
  for (const file of await routeFiles(root)) {
    const pathname = "/api/" + relative(root, dirname(file)).split(sep).join("/");
    if (["/api/", "/api/auth/login", "/api/auth/registrar", "/api/auth/me", "/api/auth/logout"].includes(pathname)) continue;
    const source = await readFile(file, "utf8");
    for (const method of [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1])) {
      if (pathname.startsWith("/api/agendamentos") || allowed.has(`${method} ${pathname}`)) continue;
      const path = pathname.replaceAll("[id]", "permission-proc").replaceAll("[insumoId]", "synthetic-insumo");
      const response = await request(path, reception, method, method === "GET" ? undefined : {});
      expect(response.status, `${method} ${pathname} must deny reception before reading or writing`).toBe(403);
      denied++;
    }
  }
  expect(denied).toBeGreaterThan(50);
  await orm.procedimento.create({ data: { id: "permission-proc", clinicaId: stored.clinicaId, nome: "BuscaQA exame fictício", tempoMinutos: 30, precoFinal: 150,
    laudos: 17, lucroDesejadoPct: 0.31, taxaCartaoPct: 0.15, precoConcorrencia: 99 } });
  const list = await (await request("/api/procedimentos", reception)).json();
  expect(list.find((item: { id: string }) => item.id === "permission-proc")).toEqual({ id: "permission-proc", nome: "BuscaQA exame fictício", tempoMinutos: 30, precoFinal: 150 });
  const managementList = await (await request("/api/procedimentos", owner)).json();
  expect(managementList.find((item: { id: string }) => item.id === "permission-proc")).toMatchObject({ laudos: 17, lucroDesejadoPct: 0.31 });
  await orm.convenio.create({ data: { id: "permission-convenio", clinicaId: stored.clinicaId, nome: "BuscaQA convênio reservado" } });
  await orm.contaReceber.create({ data: { id: "permission-conta", clinicaId: stored.clinicaId, pacienteNome: "BuscaQA paciente fictício", dataExame: "2026-10-11", valorFaturado: 9876 } });
  const appointment = await request("/api/agendamentos", reception, "POST", { nome: "BuscaQA agendamento fictício", data: "2026-10-11", hora: "10:00" });
  expect(appointment.status).toBe(201);
  const booking = await appointment.json();
  expect((await request("/api/agendamentos?data=2026-10-11", reception)).status).toBe(200);
  expect((await request(`/api/agendamentos/${booking.id}`, reception, "PUT", { telefone: "(00) 00000-0000" })).status).toBe(200);
  const search = await (await request("/api/busca?q=BuscaQA", reception)).json();
  expect(search.convenios).toEqual([]);
  expect(search.contasReceber).toEqual([]);
  expect(search.procedimentos).toHaveLength(1);
  expect(search.agendamentos).toHaveLength(1);
  const managementSearch = await (await request("/api/busca?q=BuscaQA", owner)).json();
  expect(managementSearch.convenios).toHaveLength(1);
  expect(managementSearch.contasReceber).toHaveLength(1);
  expect((await request("/api/agendamentos/resumo-status", reception)).status).toBe(200);
  expect((await request("/api/agendamentos/historico-8-semanas", reception)).status).toBe(200);
  expect((await request("/api/clinica", reception)).status).toBe(200);
  const moved = await request(`/api/agendamentos/${booking.id}/remarcar`, reception, "PUT", { novaData: "2026-10-12", novaHora: "11:00" });
  expect(moved.status).toBe(201);
  const replacement = await moved.json();
  expect((await request(`/api/agendamentos/${replacement.id}`, reception, "DELETE")).status).toBe(204);
}, 90_000);
