import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import type { Papel } from "./auth";

const durationSeconds = 7 * 24 * 60 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export function sessionHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function sessionCookieNames(production = process.env.NODE_ENV === "production") {
  return { session: production ? "__Host-odonto_session" : "odonto_session", csrf: production ? "__Host-odonto_csrf" : "odonto_csrf" };
}
export function readCookie(req: Request, name: string): string | null {
  const values = (req.headers.get("cookie") || "").split(";").map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${name}=`)).map((cookie) => cookie.slice(name.length + 1));
  return values.length === 1 && tokenPattern.test(values[0]) ? values[0] : null;
}
export function validMutationOrigin(req: Request, expectedOrigin: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return true;
  try {
    const configured = new URL(expectedOrigin);
    if (configured.origin !== expectedOrigin || !["https:", "http:"].includes(configured.protocol)) return false;
    // Require the browser's exact Origin; do not derive trust from Host/X-Forwarded-Host.
    return req.headers.get("origin") === expectedOrigin;
  } catch { return false; }
}
export function validSessionOrigin(origin: string, production: boolean): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && (parsed.protocol === "https:" || (!production && parsed.protocol === "http:"));
  } catch { return false; }
}

export type ResolvedSession = {
  id: string;
  usuarioId: string;
  clinicaId: string;
  papel: Papel;
  csrfHash: string;
  usuario: { id: string; nome: string; email: string; papel: Papel };
  clinica: { id: string; nome: string };
};
type SessionStore = Pick<PrismaClient, "sessao">;
export class ServerSessions {
  constructor(private store: SessionStore, private now = () => new Date()) {}
  async create(usuarioId: string) {
    const token = randomBytes(32).toString("base64url");
    const csrf = randomBytes(32).toString("base64url");
    const created = this.now();
    const expires = new Date(created.getTime() + durationSeconds * 1_000);
    const session = await this.store.sessao.create({ data: {
      id: randomUUID(), usuarioId, tokenHash: sessionHash(token), csrfHash: sessionHash(csrf), expiraEm: expires, criadoEm: created,
    } });
    return { id: session.id, token, csrf, expires };
  }
  async resolve(token: string | null): Promise<ResolvedSession | null> {
    if (!token || !tokenPattern.test(token)) return null;
    const row = await this.store.sessao.findUnique({ where: { tokenHash: sessionHash(token) }, include: {
      usuario: { select: { id: true, nome: true, email: true, papel: true, clinicaId: true, acesso: { select: { ativo: true } }, clinica: { select: { id: true, nome: true } } } },
    } });
    if (!row || row.revogadaEm || row.expiraEm.getTime() <= this.now().getTime() || row.usuario.acesso?.ativo === false ||
        !["dono", "financeiro", "recepcao"].includes(row.usuario.papel)) return null;
    const user = row.usuario;
    const papel = user.papel as Papel;
    return { id: row.id, usuarioId: user.id, clinicaId: user.clinicaId, papel, csrfHash: row.csrfHash,
      usuario: { id: user.id, nome: user.nome, email: user.email, papel }, clinica: user.clinica };
  }
  async revoke(id: string, usuarioId: string) {
    return this.store.sessao.updateMany({ where: { id, usuarioId, revogadaEm: null }, data: { revogadaEm: this.now() } });
  }
  async revokeAll(usuarioId: string) {
    return this.store.sessao.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: this.now() } });
  }
  async authorize(req: Request, expectedOrigin: string, production = process.env.NODE_ENV === "production") {
    if (!validSessionOrigin(expectedOrigin, production)) return { ok: false as const, status: 503, erro: "O acesso está temporariamente indisponível." };
    if (!validMutationOrigin(req, expectedOrigin)) return { ok: false as const, status: 403, erro: "Origem da requisição não autorizada." };
    const session = await this.resolve(readCookie(req, sessionCookieNames(production).session));
    if (!session) return { ok: false as const, status: 401, erro: "Sua sessão terminou. Entre novamente." };
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) {
      const csrf = req.headers.get("x-csrf-token");
      if (!csrf || !tokenPattern.test(csrf) || !/^[a-f0-9]{64}$/.test(session.csrfHash) ||
          !timingSafeEqual(Buffer.from(sessionHash(csrf), "hex"), Buffer.from(session.csrfHash, "hex"))) {
        return { ok: false as const, status: 403, erro: "Proteção de acesso inválida. Recarregue a página e tente novamente." };
      }
    }
    return { ok: true as const, session };
  }
}

export function attachSessionCookies(response: NextResponse, credentials: { token: string; csrf: string }, production = process.env.NODE_ENV === "production") {
  const names = sessionCookieNames(production);
  const options = { secure: production, sameSite: "lax" as const, path: "/", maxAge: durationSeconds };
  response.cookies.set(names.session, credentials.token, { ...options, httpOnly: true });
  response.cookies.set(names.csrf, credentials.csrf, { ...options, httpOnly: false });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export function clearSessionCookies(response: NextResponse, production = process.env.NODE_ENV === "production") {
  const names = sessionCookieNames(production);
  for (const name of [names.session, names.csrf]) response.cookies.set(name, "", {
    secure: production, sameSite: "lax", path: "/", maxAge: 0, httpOnly: name === names.session,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
