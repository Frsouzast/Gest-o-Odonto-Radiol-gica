import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

// GET /api/lotes/[id]/contas
// Lista as contas a receber que compoem um lote. Requer apenas sessão válida.
//
// Nota: o briefing nao pede checagem multi-tenant por `clinicaId` no lote
// (a SQL original filtra so por `lote_id`). Mas como isolamento multi-tenant
// eh um pilar da app, filtramos via relation `clinicaId` para garantir que
// um usuario de outra clinica nao consiga ver contas de um lote alheio
// (mesmo que adivinhe o id). Custo zero em queries (Prisma faz o join).
//
// Inclui procedimento (nome). Ordenacao: dataExame ASC.
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

    const rows = await db.contaReceber.findMany({
      where: {
        loteId: id,
        clinicaId: auth.clinicaId,
      },
      include: { procedimento: { select: { nome: true } } },
      orderBy: { dataExame: "asc" },
    });

    const result = rows.map(({ procedimento, ...cr }) => ({
      ...cr,
      procedimentoNome: procedimento?.nome ?? null,
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
