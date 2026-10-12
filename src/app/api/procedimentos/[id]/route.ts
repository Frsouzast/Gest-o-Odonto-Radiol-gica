import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";
import { pricingPercentagesSchema, procedimentoUpdateSchema, readBody } from "@/lib/validation";

// PUT /api/procedimentos/[id]
// Atualiza apenas os campos fornecidos entre os parametros de precificacao do
// procedimento. Requer papel dono ou financeiro. Retorna 404 se o procedimento
// nao existir na clinica do usuario autenticado.
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

    const existente = await db.procedimento.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Procedimento não encontrado." },
        { status: 404 }
      );
    }

    const parsed = await readBody(req, procedimentoUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;
    const pricing = pricingPercentagesSchema.safeParse({ ...existente, ...data });
    if (!pricing.success) {
      return NextResponse.json({ erro: pricing.error.issues[0].message }, { status: 400 });
    }
    if (data.equipamentoId !== undefined) {
      const equipamento = await db.ativo.findFirst({
        where: { id: data.equipamentoId, clinicaId: payload.clinicaId },
        select: { id: true },
      });
      if (!equipamento) {
        return NextResponse.json({ erro: "Equipamento não encontrado nesta clínica." }, { status: 404 });
      }
    }

    const atualizado = await db.procedimento.update({
      where: { id, clinicaId: payload.clinicaId },
      data,
    });

    return NextResponse.json(atualizado);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// DELETE /api/procedimentos/[id]
// Soft-delete: marca ativo=false em vez de remover a linha fisicamente,
// preservando o historico de precos e os itens vinculados.
// Requer papel dono ou financeiro. Retorna 204 (idempotente).
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

    await db.procedimento.updateMany({
      where: { id, clinicaId: payload.clinicaId },
      data: { ativo: false },
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
