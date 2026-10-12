import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";
import { procedimentoSchema, readBody } from "@/lib/validation";

// GET /api/procedimentos
// Lista todos os procedimentos ativos da clinica do usuario autenticado,
// ordenados por nome. Soft-delete (ativo=false) exclui da listagem.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req, "operacional");
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const procedimentos = await db.procedimento.findMany({
      where: { clinicaId: auth.clinicaId, ativo: true },
      orderBy: { nome: "asc" },
      ...(auth.papel === "recepcao" ? { select: { id: true, nome: true, tempoMinutos: true, precoFinal: true } } : {}),
    });

    return NextResponse.json(procedimentos);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/procedimentos
// Cria um novo procedimento para a clinica. Requer papel dono ou financeiro.
// Defaults: tempoMinutos=0, laudos=0, retrabalhoPct=0.03 (se ausente).
export async function POST(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const check = podeEditar(auth);
    if (!check.ok) {
      return NextResponse.json({ erro: check.erro }, { status: check.status });
    }
    const payload = check.payload;

    const parsed = await readBody(req, procedimentoSchema);
    if (!parsed.ok) return parsed.response;

    const id = crypto.randomUUID();
    const criado = await db.procedimento.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        ...parsed.data,
      },
    });

    return NextResponse.json(criado, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
