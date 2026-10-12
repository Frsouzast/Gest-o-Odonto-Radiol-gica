import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

// GET /api/usuarios
// Lista os usuarios da clinica do usuario autenticado.
// Nunca expoe senhaHash (uso de `select`).
export async function GET(req: NextRequest) {
  try {
    const payload = await authRequired(req, "usuarios");
    if ("erro" in payload) {
      return NextResponse.json(
        { erro: payload.erro },
        { status: payload.status }
      );
    }

    if (payload.papel !== "dono") return NextResponse.json({ erro: "Só o dono da clínica pode gerenciar usuários." }, { status: 403 });

    const usuarios = await db.usuario.findMany({
      where: { clinicaId: payload.clinicaId },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        criadoEm: true,
        acesso: { select: { ativo: true } },
      },
    });

    return NextResponse.json(usuarios.map(({ acesso, ...usuario }) => ({ ...usuario, ativo: acesso?.ativo ?? true })));
  } catch (err) {
    void err;
    console.error(JSON.stringify({ event: "users_list_failed_internal" }));
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
