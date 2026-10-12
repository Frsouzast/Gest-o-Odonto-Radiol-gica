import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

// DELETE /api/movimentos-bancarios/[id]
// Exclui um movimento bancario. Requer papel dono|financeiro.
// Idempotente via `deleteMany` por { id, clinicaId } (nao estoura P2025
// se o movimento nao existir ou nao pertencer a clinica). Retorna 204.
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

    const { id } = await params;

    await db.movimentoBancario.deleteMany({
      where: { id, clinicaId: auth.clinicaId },
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
