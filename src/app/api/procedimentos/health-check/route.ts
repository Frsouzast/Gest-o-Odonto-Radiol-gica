import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import {
  pricingSetupIssue,
  PricingError,
  calcProcedimento,
  custoFixoPorMinuto,
  insumoUnitCost,
  type Despesa,
  type Capacidade,
  type ProcedimentoInput,
} from "@/lib/engine";

interface ProcedimentoHealth {
  id: string;
  nome: string;
  precoFinal: number | null;
  custoDireto: number;
  precoSugerido: number;
  pontoEquilibrio: number;
  lucratividadeFinal: number;
  // Status flags para o dashboard inicial
  abaixoEquilibrio: boolean; // precoFinal < pontoEquilibrio
  abaixoSugerido: boolean; // precoFinal < precoSugerido
  semPreco: boolean; // precoFinal == null/0
}

interface HealthCheckResponse {
  total: number;
  abaixoEquilibrio: number;
  abaixoSugerido: number;
  semPreco: number;
  procedimentos: ProcedimentoHealth[];
}

// GET /api/procedimentos/health-check
// Retorna todos os procedimentos ativos da clínica com seu cálculo de
// precificação (precoSugerido, pontoEquilibrio, lucratividadeFinal) e flags
// de saúde (abaixo do equilíbrio, abaixo do sugerido, sem preço definido).
// Útil para mostrar um "resumo de saúde" no dashboard Início.
//
// Se a capacidade produtiva não estiver configurada, retorna 400 (igual ao
// /api/procedimentos/[id]/calculo).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const clinicaId = auth.clinicaId;

    // 1. Resumo de custo por minuto
    const [despesasRows, ativosRows, capacidadeRow] = await Promise.all([
      db.despesaFixa.findMany({
        where: { clinicaId },
        select: { valor: true },
      }),
      db.ativo.findMany({
        where: { clinicaId },
        select: { valorAquisicao: true, vidaUtilAnos: true },
      }),
      db.capacidadeProdutiva.findUnique({
        where: { clinicaId },
      }),
    ]);

    if (!capacidadeRow) {
      return NextResponse.json(
        { erro: "Capacidade produtiva não configurada para esta clínica." },
        { status: 400 }
      );
    }

    const despesas: Despesa[] = despesasRows.map((d) => ({
      valor: Number(d.valor),
    }));
    const depreciacoes: Despesa[] = ativosRows.map((a) => ({
      valor:
        Number(a.vidaUtilAnos) > 0
          ? Number(a.valorAquisicao) / Number(a.vidaUtilAnos) / 12
          : 0,
    }));
    const todosOsCustos: Despesa[] = [...despesas, ...depreciacoes];
    const capacidade: Capacidade = {
      diasTrabalhados: Number(capacidadeRow.diasTrabalhados),
      horasPorDia: Number(capacidadeRow.horasPorDia),
      unidadesRenda: Number(capacidadeRow.unidadesRenda),
      percentOcupacao: Number(capacidadeRow.percentOcupacao),
    };
    const setupIssue = pricingSetupIssue(todosOsCustos, capacidade);
    if (setupIssue) return NextResponse.json({ erro: setupIssue }, { status: 400 });
    const custoPorMinuto = custoFixoPorMinuto(todosOsCustos, capacidade);

    // 2. Todos os procedimentos ativos
    const procedimentos = await db.procedimento.findMany({
      where: { clinicaId, ativo: true },
      orderBy: { nome: "asc" },
    });

    // 3. Carrega itens de todos de uma vez (uma query só, agrupa em JS)
    const todosItens = await db.procedimentoInsumo.findMany({
      where: { procedimentoId: { in: procedimentos.map((p) => p.id) } },
      include: {
        insumo: { select: { valorTotal: true, quantidade: true } },
      },
    });
    const itensPorProc = new Map<
      string,
      typeof todosItens
    >();
    for (const it of todosItens) {
      const arr = itensPorProc.get(it.procedimentoId) ?? [];
      arr.push(it);
      itensPorProc.set(it.procedimentoId, arr);
    }

    // 4. Calcula cada procedimento
    const resultado: ProcedimentoHealth[] = procedimentos.map((p) => {
      const itens = itensPorProc.get(p.id) ?? [];
      const custoUnitario: Record<string, number> = {};
      for (const row of itens) {
        custoUnitario[row.insumoId] = insumoUnitCost({
          valorTotal: Number(row.insumo?.valorTotal ?? 0),
          quantidade: Number(row.insumo?.quantidade ?? 0),
        });
      }
      const lookup = (insumoId: string): number => custoUnitario[insumoId] || 0;

      const proc: ProcedimentoInput = {
        tempoMinutos: Number(p.tempoMinutos),
        laudos: Number(p.laudos),
        retrabalho: Number(p.retrabalhoPct),
        itens: itens.map((r) => ({
          insumoId: r.insumoId,
          quantidade: Number(r.quantidade),
        })),
        comissao: Number(p.comissaoPct),
        lucroDesejado: Number(p.lucroDesejadoPct),
        inadimplencia: Number(p.inadimplenciaPct),
        impostos: Number(p.impostosPct),
        taxaCartao: Number(p.taxaCartaoPct),
        outrosPct: Number(p.outrosPct),
        precoFinal: p.precoFinal ? Number(p.precoFinal) : 0,
      };

      const r = calcProcedimento(proc, custoPorMinuto, lookup);
      const precoFinal = p.precoFinal ? Number(p.precoFinal) : null;
      const semPreco = precoFinal === null || precoFinal === 0;
      const abaixoEquilibrio = !semPreco && !isNaN(r.pontoEquilibrio) && precoFinal! < r.pontoEquilibrio;
      const abaixoSugerido = !semPreco && !isNaN(r.precoSugerido) && precoFinal! < r.precoSugerido;

      return {
        id: p.id,
        nome: p.nome,
        precoFinal,
        custoDireto: r.custoDireto,
        precoSugerido: r.precoSugerido,
        pontoEquilibrio: r.pontoEquilibrio,
        lucratividadeFinal: r.lucratividadeFinal,
        abaixoEquilibrio,
        abaixoSugerido,
        semPreco,
      };
    });

    const response: HealthCheckResponse = {
      total: resultado.length,
      abaixoEquilibrio: resultado.filter((r) => r.abaixoEquilibrio).length,
      abaixoSugerido: resultado.filter((r) => r.abaixoSugerido).length,
      semPreco: resultado.filter((r) => r.semPreco).length,
      procedimentos: resultado,
    };

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof PricingError) return NextResponse.json({ erro: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
