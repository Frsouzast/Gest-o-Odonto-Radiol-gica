import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

export type RateLimitResult = { allowed: boolean; retryAfter: number };
export interface RateLimitStore {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/** Development/test only. Never evict active counters to make room for an attack. */
export class MemoryRateLimitStore implements RateLimitStore {
  private counters = new Map<string, { count: number; expires: number }>();
  constructor(private now = Date.now, private maxKeys = 10_000) {}
  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = this.now();
    let counter = this.counters.get(key);
    if (!counter || counter.expires <= now) {
      for (const [name, value] of this.counters) {
        if (value.expires <= now) this.counters.delete(name);
      }
      if (this.counters.size >= this.maxKeys) throw new Error("Rate limit capacity exhausted");
      counter = { count: 0, expires: now + windowSeconds * 1_000 };
      this.counters.set(key, counter);
    }
    counter.count = Math.min(counter.count + 1, limit + 1);
    return { allowed: counter.count <= limit, retryAfter: Math.max(1, Math.ceil((counter.expires - now) / 1_000)) };
  }
}

// Atomic increment + expiry: no counter can be left permanently without TTL.
export const rateLimitScript = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private url: string, private token: string, private send: typeof fetch = fetch) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash ||
        !token || (parsed.pathname !== "/" && parsed.pathname !== "")) {
      throw new Error("Invalid rate limit configuration");
    }
  }
  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const response = await this.send(this.url, {
      method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(["EVAL", rateLimitScript, "1", key, String(windowSeconds)]),
      signal: AbortSignal.timeout(3_000), cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new Error("Rate limit service unavailable");
    const body = await response.json() as { result?: unknown; error?: unknown };
    const result = body.result;
    if (body.error || !Array.isArray(result) || result.length !== 2 ||
        !result.every((value) => typeof value === "number" && Number.isSafeInteger(value)) ||
        result[0] < 1 || result[1] < 0 || result[1] > windowSeconds) {
      throw new Error("Invalid rate limit service response");
    }
    return { allowed: result[0] <= limit, retryAfter: Math.max(1, result[1]) };
  }
}

const localStore = new MemoryRateLimitStore();
const localKey = randomBytes(32).toString("hex");
function configuredStore(): RateLimitStore {
  const url = process.env.AUTH_RATE_LIMIT_REDIS_URL;
  const token = process.env.AUTH_RATE_LIMIT_REDIS_TOKEN;
  if (url && token) return new RedisRateLimitStore(url, token);
  if (process.env.NODE_ENV === "production" || url || token) throw new Error("Configure shared rate limit storage");
  return localStore;
}

export function rateLimitFingerprint(value: string): string {
  const configured = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) throw new Error("Configure AUTH_SECRET for shared rate limit fingerprints");
  const secret = configured || localKey;
  return createHmac("sha256", secret).update(`auth-rate-limit:${value}`).digest("hex");
}

/** Trust only a header overwritten by a proxy that prevents direct app access. */
export function rateLimitClient(req: Request): string {
  if (process.env.AUTH_RATE_LIMIT_TRUST_PROXY !== "true") return "shared-untrusted";
  const address = req.headers.get("x-real-ip")?.trim();
  return address && isIP(address) ? address : "shared-untrusted";
}

export async function enforceAuthLimit(
  req: Request, action: "login" | "registrar", email?: string,
  store?: RateLimitStore,
): Promise<NextResponse | null> {
  try {
    const backend = store ?? configuredStore();
    const identity = email === undefined ? `ip:${rateLimitClient(req)}` : `email:${email.trim().toLowerCase()}`;
    const limit = email === undefined ? (action === "login" ? 60 : 10) : (action === "login" ? 10 : 3);
    const result = await backend.consume(`auth:${action}:${rateLimitFingerprint(identity)}`, limit, 15 * 60);
    if (result.allowed) return null;
    // Intentionally no email, IP, password, token or raw exception in security logs.
    console.warn(JSON.stringify({ event: "auth_rate_limited", action }));
    return NextResponse.json({ erro: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." }, {
      status: 429, headers: { "Retry-After": String(result.retryAfter), "Cache-Control": "no-store" },
    });
  } catch {
    console.error(JSON.stringify({ event: "auth_rate_limit_unavailable", action }));
    return NextResponse.json({ erro: "O acesso está temporariamente indisponível. Tente novamente em alguns minutos." }, {
      status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }
}
