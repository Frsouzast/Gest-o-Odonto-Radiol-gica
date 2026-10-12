import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface ItemBody {
  insumoId?: string;
  quantidade?: number;
}

// GET /api/procedimentos/[id]/itens
// Lista os insumos vinculados ao procedimento, retornando a forma achatada
// { insumoId, quantidade, insumoNome } esperada pela UI. Nao requer podeEditar
// (qualquer papel autenticado pode ler composicao de procedimento).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const { id } = await params;

    const itens = await db.procedimentoInsumo.findMany({
      where: {
        procedimentoId: id,
        procedimento: { clinicaId: auth.clinicaId },
      },
      include: { insumo: { select: { nome: true } } },
    });

    const result = itens.map((i) => ({
      insumoId: i.insumoId,
      quantidade: i.quantidade,
      insumoNome: i.insumo?.nome ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/procedimentos/[id]/itens
// Vincula um insumo ao procedimento (ou atualiza a quantidade se ja existir).
// Usa upsert pela chave composta [procedimentoId, insumoId].
// Requer papel dono ou financeiro. Defaults: quantidade=1.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const body = (await req.json().catch(() => ({}))) as ItemBody;
    const { insumoId, quantidade } = body;

    if (!insumoId || typeof insumoId !== "string") {
      return NextResponse.json(
        { erro: "insumoId é obrigatório." },
        { status: 400 }
      );
    }

    const qtd =
      typeof quantidade === "number" && Number.isFinite(quantidade)
        ? quantidade
        : 1;

    if (qtd <= 0) {
      return NextResponse.json(
        { erro: "quantidade precisa ser maior que zero." },
        { status: 400 }
      );
    }

    const [procedimento, insumo] = await Promise.all([
      db.procedimento.findFirst({
        where: { id, clinicaId: payload.clinicaId },
        select: { id: true },
      }),
      db.insumo.findFirst({
        where: { id: insumoId, clinicaId: payload.clinicaId },
        select: { id: true },
      }),
    ]);
    if (!procedimento || !insumo) {
      return NextResponse.json(
        { erro: "Procedimento ou insumo não encontrado nesta clínica." },
        { status: 404 }
      );
    }

    await db.procedimentoInsumo.upsert({
      where: { procedimentoId_insumoId: { procedimentoId: id, insumoId } },
      create: { procedimentoId: id, insumoId, quantidade: qtd },
      update: { quantidade: qtd },
    });

    return NextResponse.json(
      { procedimentoId: id, insumoId, quantidade: qtd },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
