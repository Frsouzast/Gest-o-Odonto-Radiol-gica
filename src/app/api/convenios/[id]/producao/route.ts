import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

// GET /api/convenios/[id]/producao?periodoInicio=YYYY-MM-DD&periodoFim=YYYY-MM-DD
// Producao do convenio no periodo (contas a receber ainda sem lote). Requer
// sessão válida. `periodoInicio` e `periodoFim` obrigatorios.
//
// Logica (fiel ao api.js L947-966):
//   - buscar conta_receber onde clinicaId, convenioId=id, loteId=null,
//     dataExame between periodoInicio e periodoFim, status != 'cancelado',
//     include procedimento (select nome). Order by dataExame ASC.
//   - para cada row, adicionar array `pendencias`:
//       if (!pacienteNome) push "paciente não informado"
//       if (!procedimentoId) push "procedimento não informado"
//       if (!valorFaturado || Number(valorFaturado) <= 0) push "valor inválido"
//   - retornar o array.
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

    const periodoInicio = req.nextUrl.searchParams.get("periodoInicio");
    const periodoFim = req.nextUrl.searchParams.get("periodoFim");
    if (!periodoInicio || !periodoFim) {
      return NextResponse.json(
        { erro: "periodoInicio e periodoFim são obrigatórios." },
        { status: 400 }
      );
    }

    const rows = await db.contaReceber.findMany({
      where: {
        clinicaId: auth.clinicaId,
        convenioId: id,
        loteId: null,
        dataExame: { gte: periodoInicio, lte: periodoFim },
        status: { not: "cancelado" },
      },
      include: { procedimento: { select: { nome: true } } },
      orderBy: { dataExame: "asc" },
    });

    const comPendencia = rows.map(({ procedimento, ...r }) => {
      const pendencias: string[] = [];
      if (!r.pacienteNome) pendencias.push("paciente não informado");
      if (!r.procedimentoId) pendencias.push("procedimento não informado");
      if (!r.valorFaturado || Number(r.valorFaturado) <= 0) {
        pendencias.push("valor inválido");
      }
      return {
        ...r,
        procedimentoNome: procedimento?.nome ?? null,
        pendencias,
      };
    });

    return NextResponse.json(comPendencia);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
