import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { enforceAuthLimit, MemoryRateLimitStore, rateLimitClient, rateLimitFingerprint, rateLimitScript, RedisRateLimitStore } from "../../src/lib/auth-rate-limit";

const originalTrust = process.env.AUTH_RATE_LIMIT_TRUST_PROXY;
afterEach(() => {
  if (originalTrust === undefined) delete process.env.AUTH_RATE_LIMIT_TRUST_PROXY;
  else process.env.AUTH_RATE_LIMIT_TRUST_PROXY = originalTrust;
  mock.restore();
});

describe("limites de autenticação", () => {
  test("bloqueia após o limite e libera no fim da janela, sem estender o bloqueio", async () => {
    let now = 1_000;
    const store = new MemoryRateLimitStore(() => now);
    expect((await store.consume("a", 2, 60)).allowed).toBe(true);
    expect((await store.consume("a", 2, 60)).allowed).toBe(true);
    now += 30_000;
    expect(await store.consume("a", 2, 60)).toEqual({ allowed: false, retryAfter: 30 });
    now += 30_000;
    expect(await store.consume("a", 2, 60)).toEqual({ allowed: true, retryAfter: 60 });
  });
  test("chaves distintas não compartilham contagem e não expulsa contadores ativos", async () => {
    let now = 0;
    const store = new MemoryRateLimitStore(() => now, 2);
    expect((await store.consume("a", 1, 60)).allowed).toBe(true);
    expect((await store.consume("b", 1, 60)).allowed).toBe(true);
    await expect(store.consume("c", 1, 60)).rejects.toThrow();
    expect((await store.consume("a", 1, 60)).allowed).toBe(false);
    now = 60_000;
    expect((await store.consume("c", 1, 60)).allowed).toBe(true);
  });
  test("contagem concorrente local não permite ultrapassar o limite", async () => {
    const store = new MemoryRateLimitStore();
    const results = await Promise.all(Array.from({ length: 50 }, () => store.consume("a", 10, 60)));
    expect(results.filter((result) => result.allowed)).toHaveLength(10);
  });
  test("ignora cabeçalhos de IP até configurar proxy confiável", () => {
    delete process.env.AUTH_RATE_LIMIT_TRUST_PROXY;
    const req = new Request("http://localhost", { headers: { "x-real-ip": "192.0.2.1", "x-forwarded-for": "198.51.100.2" } });
    expect(rateLimitClient(req)).toBe("shared-untrusted");
    process.env.AUTH_RATE_LIMIT_TRUST_PROXY = "true";
    expect(rateLimitClient(req)).toBe("192.0.2.1");
    expect(rateLimitClient(new Request("http://localhost", { headers: { "x-real-ip": "192.0.2.1, 198.51.100.2" } }))).toBe("shared-untrusted");
    expect(rateLimitClient(new Request("http://localhost", { headers: { "x-real-ip": "2001:db8::1" } }))).toBe("2001:db8::1");
  });
  test("identificador é hash autenticado e não contém e-mail", () => {
    const value = rateLimitFingerprint("email:nome@example.com");
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(value).toBe(rateLimitFingerprint("email:nome@example.com"));
    expect(value).not.toContain("nome");
    expect(value).not.toBe(rateLimitFingerprint("email:outro@example.com"));
  });
  test("Redis envia incremento e expiração em um comando atômico", async () => {
    const send = mock(async (_url: unknown, _init: unknown) => Response.json({ result: [11, 450] }));
    const store = new RedisRateLimitStore("https://redis.example.com", "test-only", send as unknown as typeof fetch);
    expect(await store.consume("hashed-key", 10, 900)).toEqual({ allowed: false, retryAfter: 450 });
    const init = send.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual(["EVAL", rateLimitScript, "1", "hashed-key", "900"]);
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-only");
  });
  test("Redis rejeita falha HTTP e respostas malformadas", async () => {
    for (const response of [new Response("", { status: 503 }), Response.json({ error: "failed" }),
      Response.json({ result: [1, -1] }), Response.json({ result: [0, 60] }), Response.json({ result: [1, 901] }),
      Response.json({ result: ["1", 60] })]) {
      const store = new RedisRateLimitStore("https://redis.example.com", "test-only", (async () => response) as unknown as typeof fetch);
      await expect(store.consume("a", 10, 900)).rejects.toThrow();
    }
    for (const url of ["http://redis.example.com", "https://user:password@redis.example.com", "https://redis.example.com/?token=secret"]) {
      expect(() => new RedisRateLimitStore(url, "test-only")).toThrow();
    }
  });
  test("bloqueio por e-mail normalizado retorna 429 e tempo de espera", async () => {
    const req = new Request("http://localhost");
    const store = new MemoryRateLimitStore();
    for (let i = 0; i < 10; i++) expect(await enforceAuthLimit(req, "login", "NOME@EXAMPLE.COM", store)).toBeNull();
    const response = await enforceAuthLimit(req, "login", " nome@example.com ", store);
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });
  test("cadastro é limitado mais cedo e falha do contador não abre acesso", async () => {
    const req = new Request("http://localhost");
    const store = new MemoryRateLimitStore();
    for (let i = 0; i < 3; i++) expect(await enforceAuthLimit(req, "registrar", "a@example.com", store)).toBeNull();
    expect((await enforceAuthLimit(req, "registrar", "a@example.com", store))?.status).toBe(429);
    expect((await enforceAuthLimit(req, "login", undefined, { consume: async () => { throw new Error("secret-must-not-be-logged"); } }))?.status).toBe(503);
  });
  test("produção sem contador configurado recusa acesso, sem usar memória", async () => {
    const original = { node: process.env.NODE_ENV, url: process.env.AUTH_RATE_LIMIT_REDIS_URL, token: process.env.AUTH_RATE_LIMIT_REDIS_TOKEN };
    try {
      Object.assign(process.env, { NODE_ENV: "production" });
      delete process.env.AUTH_RATE_LIMIT_REDIS_URL;
      delete process.env.AUTH_RATE_LIMIT_REDIS_TOKEN;
      expect((await enforceAuthLimit(new Request("http://localhost"), "login"))?.status).toBe(503);
    } finally {
      for (const [key, value] of [["NODE_ENV", original.node], ["AUTH_RATE_LIMIT_REDIS_URL", original.url], ["AUTH_RATE_LIMIT_REDIS_TOKEN", original.token]]) {
        if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
      }
    }
  });
  test("logs de falha não incluem exceção, identificador ou credencial", async () => {
    const log = spyOn(console, "error").mockImplementation(() => {});
    await enforceAuthLimit(new Request("http://localhost"), "login", "private@example.com", {
      consume: async () => { throw new Error("private-secret-token"); },
    });
    expect(log).toHaveBeenCalledWith('{"event":"auth_rate_limit_unavailable","action":"login"}');
    expect(JSON.stringify(log.mock.calls)).not.toContain("private");
  });
});
