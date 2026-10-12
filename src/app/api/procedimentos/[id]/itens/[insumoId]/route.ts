import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

// DELETE /api/procedimentos/[id]/itens/[insumoId]
// Remove o vinculo de um insumo com o procedimento pela chave composta.
// Requer papel dono ou financeiro. Retorna 204 (idempotente via deleteMany —
// Prisma `delete` por chave composta lancaria P2025 se o vinculo nao existisse).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; insumoId: string }> }
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

    const { id, insumoId } = await params;

    await db.procedimentoInsumo.deleteMany({
      where: {
        procedimentoId: id,
        insumoId,
        procedimento: { clinicaId: payload.clinicaId },
        insumo: { clinicaId: payload.clinicaId },
      },
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
