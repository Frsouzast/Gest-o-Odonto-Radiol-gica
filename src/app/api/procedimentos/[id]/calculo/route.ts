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

// GET /api/procedimentos/[id]/calculo
// Roda o motor de precificacao para um procedimento especifico.
//
// 1. Carrega o custo fixo por minuto da clinica (mesma logica do /api/resumo).
//    Se a capacidade produtiva nao estiver configurada, retorna 400.
// 2. Carrega o procedimento por id+clinicaId (404 se nao existir).
// 3. Carrega os itens do procedimento com valorTotal/quantidade do insumo para
//    montar o lookup de custo unitario.
// 4. Monta ProcedimentoInput mapeando os campos camelCase do Prisma para o shape
//    esperado pelo engine.
// 5. Executa calcProcedimento e retorna { procedimento: nome, ...resultado }.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const clinicaId = auth.clinicaId;
    const { id } = await params;

    // --- 1. Resumo de custo por minuto (duplicado de /api/resumo) ---
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

    // --- 2. Procedimento ---
    const procedimento = await db.procedimento.findFirst({
      where: { id, clinicaId },
    });
    if (!procedimento) {
      return NextResponse.json(
        { erro: "Procedimento não encontrado." },
        { status: 404 }
      );
    }

    // --- 3. Itens + custo unitario lookup ---
    const itensRows = await db.procedimentoInsumo.findMany({
      where: { procedimentoId: procedimento.id },
      include: {
        insumo: { select: { valorTotal: true, quantidade: true } },
      },
    });

    const custoUnitario: Record<string, number> = {};
    for (const row of itensRows) {
      custoUnitario[row.insumoId] = insumoUnitCost({
        valorTotal: Number(row.insumo?.valorTotal ?? 0),
        quantidade: Number(row.insumo?.quantidade ?? 0),
      });
    }
    const lookup = (insumoId: string): number => custoUnitario[insumoId] || 0;

    // --- 4. ProcedimentoInput ---
    const proc: ProcedimentoInput = {
      tempoMinutos: Number(procedimento.tempoMinutos),
      laudos: Number(procedimento.laudos),
      retrabalho: Number(procedimento.retrabalhoPct),
      itens: itensRows.map((r) => ({
        insumoId: r.insumoId,
        quantidade: Number(r.quantidade),
      })),
      comissao: Number(procedimento.comissaoPct),
      lucroDesejado: Number(procedimento.lucroDesejadoPct),
      inadimplencia: Number(procedimento.inadimplenciaPct),
      impostos: Number(procedimento.impostosPct),
      taxaCartao: Number(procedimento.taxaCartaoPct),
      outrosPct: Number(procedimento.outrosPct),
      precoFinal: procedimento.precoFinal
        ? Number(procedimento.precoFinal)
        : 0,
    };

    // --- 5. Calculo ---
    const resultado = calcProcedimento(proc, custoPorMinuto, lookup);

    return NextResponse.json({
      procedimento: procedimento.nome,
      ...resultado,
    });
  } catch (err) {
    if (err instanceof PricingError) return NextResponse.json({ erro: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
