import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface DespesaUpdateBody {
  nome?: string;
  valor?: number;
}

// PUT /api/despesas/[id]
// Atualiza apenas os campos fornecidos (nome e/ou valor) de uma despesa fixa.
// Requer papel dono ou financeiro. Retorna 404 se a despesa nao existir na clinica.
export async function PUT(
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

    const existente = await db.despesaFixa.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Despesa não encontrada." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as DespesaUpdateBody;
    const data: { nome?: string; valor?: number } = {};
    if (typeof body.nome === "string") data.nome = body.nome;
    if (typeof body.valor === "number" && !Number.isNaN(body.valor)) {
      data.valor = body.valor;
    }

    const atualizada = await db.despesaFixa.update({
      where: { id },
      data,
      select: {
        id: true,
        clinicaId: true,
        nome: true,
        valor: true,
        ordem: true,
      },
    });

    return NextResponse.json(atualizada);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// DELETE /api/despesas/[id]
// Remove uma despesa fixa apenas se pertencer à clinica do usuario autenticado.
// Requer papel dono ou financeiro. Retorna 204 (idempotente) mesmo se nao existir.
export async function DELETE(
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

    await db.despesaFixa.deleteMany({
      where: { id, clinicaId: payload.clinicaId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
