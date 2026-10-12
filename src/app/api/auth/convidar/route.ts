import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashSenha, authRequired } from "@/lib/auth";
import { inviteSchema, readBody } from "@/lib/validation";

// POST /api/auth/convidar
// Cadastro direto legado (não envia convite por e-mail); só dono, mesma clínica.
export async function POST(req: NextRequest) {
  try {
    const payload = await authRequired(req, "usuarios");
    if ("erro" in payload) {
      return NextResponse.json(
        { erro: payload.erro },
        { status: payload.status }
      );
    }

    if (payload.papel !== "dono") {
      return NextResponse.json(
        { erro: "Só o dono da clínica pode convidar novos usuários." },
        { status: 403 }
      );
    }

    const parsed = await readBody(req, inviteSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { nome, email, senha, papel } = body;

    const id = crypto.randomUUID();
    const emailNormalizado = email.toLowerCase();
    const papelValido = papel;

    try {
      const senhaHash = await hashSenha(senha);
      await db.usuario.create({
        data: {
          id,
          clinicaId: payload.clinicaId,
          nome,
          email: emailNormalizado,
          senhaHash,
          papel: papelValido,
        },
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

    return NextResponse.json(
      { id, nome, email: emailNormalizado, papel: papelValido },
      { status: 201 }
    );
  } catch (err) {
    void err;
    console.error(JSON.stringify({ event: "user_create_failed_internal" }));
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
