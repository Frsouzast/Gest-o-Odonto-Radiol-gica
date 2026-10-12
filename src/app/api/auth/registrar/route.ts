import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { checkAuthOrigin, hashSenha, type Papel } from "@/lib/auth";
import { attachSessionCookies, ServerSessions } from "@/lib/server-sessions";
import { registerSchema, readBody } from "@/lib/validation";
import { enforceAuthLimit } from "@/lib/auth-rate-limit";

// POST /api/auth/registrar
// Cria clínica, dono e sessão na mesma transação.
export async function POST(req: NextRequest) {
  try {
    const originError = checkAuthOrigin(req);
    if (originError) return originError;
    const ipLimit = await enforceAuthLimit(req, "registrar");
    if (ipLimit) return ipLimit;
    const parsed = await readBody(req, registerSchema);
    if (!parsed.ok) return parsed.response;
    const { clinicaNome, usuarioNome, email, senha } = parsed.data;
    const accountLimit = await enforceAuthLimit(req, "registrar", email);
    if (accountLimit) return accountLimit;

    const clinicaId = crypto.randomUUID();
    const usuarioId = crypto.randomUUID();
    const emailNormalizado = email.toLowerCase();
    const papel: Papel = "dono";

    let credentials;
    try {
      // Hash antes da transacao para minimizar o tempo de lock.
      const senhaHash = await hashSenha(senha);
      // Transacao: se o usuario (email unico) falhar, a clinica nao fica orfa.
      credentials = await db.$transaction(async (tx) => {
        await tx.clinica.create({
          data: { id: clinicaId, nome: clinicaNome },
        });
        await tx.usuario.create({
          data: {
            id: usuarioId,
            clinicaId,
            nome: usuarioNome,
            email: emailNormalizado,
            senhaHash,
            papel,
          },
        });
        return new ServerSessions(tx).create(usuarioId);
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          { erro: "Já existe uma conta com esse e-mail." },
          { status: 409 }
        );
      }
      throw err;
    }

    return attachSessionCookies(NextResponse.json(
      {
        usuario: {
          id: usuarioId,
          nome: usuarioNome,
          email: emailNormalizado,
          papel,
        },
        clinica: { id: clinicaId, nome: clinicaNome },
      },
      { status: 201 }
    ), credentials);
  } catch (err) {
    void err;
    console.error(JSON.stringify({ event: "auth_register_failed_internal" }));
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
