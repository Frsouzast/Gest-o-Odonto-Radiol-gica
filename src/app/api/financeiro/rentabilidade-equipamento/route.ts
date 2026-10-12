import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { calcularPorHora } from "@/lib/financeiro";

// Helper: custo variavel de um procedimento = somatorio de
//   pi.quantidade * (insumo.quantidade > 0 ? insumo.valorTotal / insumo.quantidade : 0)
// (mesma formula de /financeiro/dre e /financeiro/rentabilidade).
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

// GET /api/financeiro/rentabilidade-equipamento?mes=YYYY-MM
// Rentabilidade por hora de cada equipamento (ativo). Requer sessão válida.
// `mes` obrigatorio.
//
// Logica (fiel ao api.js L916-944):
//   - Para cada ativo da clinica:
//       - buscar contas a receber do mes (dataExame comeca com mes) cujo
//         procedimento.equipamentoId = ativo.id, include procedimento
//         (select id, tempoMinutos)
//       - se vazio, pular (continue)
//       - receitaTotal = somatorio valorFaturado
//       - minutosTotais = somatorio procedimento.tempoMinutos
//       - custoTotal = somatorio, para cada conta, do custoVariavel do
//         procedimento
//       - porHora = calcularPorHora(receitaTotal, custoTotal, minutosTotais)
//       - push { equipamento: ativo.nome, quantidade: contas.length,
//                receitaTotal, custoTotal, ...porHora }
//   - retornar o array
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

    const ativos = await db.ativo.findMany({
      where: { clinicaId: auth.clinicaId },
      select: { id: true, nome: true },
    });

    const resultado: {
      equipamento: string;
      quantidade: number;
      receitaTotal: number;
      custoTotal: number;
      receitaPorHora: number;
      lucroPorHora: number;
      horas: number;
    }[] = [];
    for (const ativo of ativos) {
      const receber = await db.contaReceber.findMany({
        where: {
          clinicaId: auth.clinicaId,
          dataExame: { startsWith: mes },
          procedimento: { equipamentoId: ativo.id },
        },
        include: {
          procedimento: { select: { id: true, tempoMinutos: true } },
        },
      });

      if (receber.length === 0) continue;

      let receitaTotal = 0;
      let custoTotal = 0;
      let minutosTotais = 0;
      for (const r of receber) {
        receitaTotal += Number(r.valorFaturado);
        minutosTotais += Number(r.procedimento?.tempoMinutos ?? 0);
        if (r.procedimentoId) {
          custoTotal += await custoVariavelProcedimento(r.procedimentoId);
        }
      }

      const porHora = calcularPorHora(receitaTotal, custoTotal, minutosTotais);
      resultado.push({
        equipamento: ativo.nome,
        quantidade: receber.length,
        receitaTotal,
        custoTotal,
        ...porHora,
      });
    }

    return NextResponse.json(resultado);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
