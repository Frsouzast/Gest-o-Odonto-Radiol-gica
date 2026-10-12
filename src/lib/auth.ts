import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "./db";
import { ServerSessions, validMutationOrigin, validSessionOrigin } from "./server-sessions";
import { canAccessScope, type AccessScope } from "./permissions";

export type Papel = "dono" | "financeiro" | "recepcao";
export interface AuthPayload { usuarioId: string; clinicaId: string; papel: Papel; sessaoId: string }
export async function hashSenha(senha: string) { return bcrypt.hash(senha, 10); }
export async function conferirSenha(senha: string, hash: string) { return bcrypt.compare(senha, hash); }
export function appOrigin() {
  return process.env.APP_ORIGIN || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
}
export function checkAuthOrigin(req: Request): NextResponse | null {
  const origin = appOrigin();
  if (!validSessionOrigin(origin, process.env.NODE_ENV === "production")) return NextResponse.json({ erro: "O acesso está temporariamente indisponível." }, { status: 503 });
  if (!validMutationOrigin(req, origin)) return NextResponse.json({ erro: "Origem da requisição não autorizada." }, { status: 403 });
  return null;
}
export async function authRequired(req: Request, scope: AccessScope = "financeiro"): Promise<AuthPayload | { erro: string; status: number }> {
  // No JWT/Bearer fallback: every credential must still exist and be valid in the database.
  const result = await new ServerSessions(db).authorize(req, appOrigin());
  if (!result.ok) return { erro: result.erro, status: result.status };
  // Least privilege: new routes are financial unless explicitly operational.
  if (!canAccessScope(result.session.papel, scope)) return { erro: "Seu perfil não tem permissão para esta consulta ou ação.", status: 403 };
  return { usuarioId: result.session.usuarioId, clinicaId: result.session.clinicaId, papel: result.session.papel, sessaoId: result.session.id };
}
export type AuthPapelResult = { ok: true; payload: AuthPayload } | { ok: false; erro: string; status: number };
export function authPapel(...papeis: Papel[]) {
  return (payload: AuthPayload): AuthPapelResult => papeis.includes(payload.papel)
    ? { ok: true, payload }
    : { ok: false, erro: "Seu perfil não tem permissão para esta ação.", status: 403 };
}
export const podeEditar = authPapel("dono", "financeiro");
