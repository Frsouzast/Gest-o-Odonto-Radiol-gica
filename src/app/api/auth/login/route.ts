import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAuthOrigin, conferirSenha, hashSenha } from "@/lib/auth";
import { attachSessionCookies } from "@/lib/server-sessions";
import { createLoginSession } from "@/lib/login-session";
import { loginSchema, readBody } from "@/lib/validation";
import { enforceAuthLimit } from "@/lib/auth-rate-limit";

// Compare an unknown account too, reducing the obvious timing difference.
let dummyHash: Promise<string> | undefined;

// POST /api/auth/login
// Autentica e cria sessão revogável; nunca retorna a credencial no JSON.
export async function POST(req: NextRequest) {
  try {
    const originError = checkAuthOrigin(req);
    if (originError) return originError;
    const ipLimit = await enforceAuthLimit(req, "login");
    if (ipLimit) return ipLimit;
    const parsed = await readBody(req, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, senha } = parsed.data;
    const accountLimit = await enforceAuthLimit(req, "login", email);
    if (accountLimit) return accountLimit;

    const emailNormalizado = email.toLowerCase();

    const usuario = await db.usuario.findUnique({
      where: { email: emailNormalizado },
      include: { clinica: true, acesso: true },
    });

    const credenciaisInvalidas = () =>
      NextResponse.json(
        { erro: "E-mail ou senha inválidos." },
        { status: 401 }
      );

    const hash = usuario?.senhaHash ?? await (dummyHash ??= hashSenha("non-user-dummy-compare-only"));
    const ok = await conferirSenha(senha, hash);
    if (!usuario || !ok || usuario.acesso?.ativo === false || !["dono", "financeiro", "recepcao"].includes(usuario.papel)) return credenciaisInvalidas();

    const session = await createLoginSession(db, usuario.id, usuario.senhaHash);
    if (!session) return credenciaisInvalidas();

    return attachSessionCookies(NextResponse.json({
      usuario: session.usuario,
      clinica: session.clinica,
    }), session.credentials);
  } catch (err) {
    void err;
    console.error(JSON.stringify({ event: "auth_login_failed_internal" }));
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
