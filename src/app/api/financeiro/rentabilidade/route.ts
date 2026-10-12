import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { agruparRentabilidade } from "@/lib/financeiro";

// Helper: custo variavel de um procedimento = somatorio de
//   pi.quantidade * (insumo.quantidade > 0 ? insumo.valorTotal / insumo.quantidade : 0)
// (mesma formula usada em /financeiro/dre — ver custoVariavelProcedimento la).
async function custoVariavelProcedimento(procedimentoId: string): Promise<number> {
  const itens = await db.procedimentoInsumo.findMany({
    where: { procedimentoId },
    select: {
      quantidade: true,
      insumo: { select: { valorTotal: true, quantidade: true } },
    },
  });
  return itens.reduce((s, it) => {
    const insumoQtd = Number(it.insumo?.quantidade);
    const insumoValor = Number(it.insumo?.valorTotal);
    const unit = insumoQtd ? insumoValor / insumoQtd : 0;
    return s + Number(it.quantidade) * unit;
  }, 0);
}

// GET /api/financeiro/rentabilidade?mes=YYYY-MM&agrupar=procedimento|convenio|dentista
// Rentabilidade agrupada por chave. Requer sessão válida. `mes` obrigatorio.
//
// Query contas a receber do mes (dataExame comeca com "YYYY-MM-"), include
// procedimento (nome) e convenio (nome). Para cada row:
//   - custo = lookup procedimento_insumo se procedimentoId existir (0 caso contrario).
//   - chave:
//       agrupar === "convenio"   -> convenioNome || "Particular"
//       agrupar === "dentista"   -> dentistaSolicitante || "(não informado)"
//       (default "procedimento") -> procedimentoNome || "(sem procedimento)"
//   - push { chave, receita: Number(valorFaturado), custo }
//
// Retorna agruparRentabilidade(lancamentos) de @/lib/financeiro.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const mes = req.nextUrl.searchParams.get("mes");
    if (!mes) {
      return NextResponse.json(
        { erro: "mes (AAAA-MM) é obrigatório." },
        { status: 400 }
      );
    }
    const agrupar = req.nextUrl.searchParams.get("agrupar") || "procedimento";

    const receber = await db.contaReceber.findMany({
      where: {
        clinicaId: auth.clinicaId,
        dataExame: { startsWith: mes },
      },
      include: {
        procedimento: { select: { nome: true } },
        convenio: { select: { nome: true } },
      },
    });

    const lancamentos: { chave: string; receita: number; custo: number }[] = [];
    for (const r of receber) {
      let custo = 0;
      if (r.procedimentoId) {
        custo = await custoVariavelProcedimento(r.procedimentoId);
      }
      const chave =
        agrupar === "convenio"
          ? r.convenio?.nome || "Particular"
          : agrupar === "dentista"
            ? r.dentistaSolicitante || "(não informado)"
            : r.procedimento?.nome || "(sem procedimento)";
      lancamentos.push({
        chave,
        receita: Number(r.valorFaturado),
        custo,
      });
    }

    return NextResponse.json(agruparRentabilidade(lancamentos));
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
