import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { saldoReceber, somarDinheiro, valorRecebido } from "@/lib/money";

// GET /api/financeiro/resumo?mes=YYYY-MM
// Dashboard financeiro mensal. Requer sessão válida. `mes` obrigatorio (400 se vazio).
//
// 4 queries em paralelo:
//   1. receberMes: contas a receber do mes (dataExame comeca com "YYYY-MM-"),
//      include convenio (nome).
//   2. pagarMes: contas a pagar do mes (vencimento comeca com "YYYY-MM-").
//   3. receberAberto: contas a receber em aberto (status in aberto|vencido|parcial).
//   4. pagarAberto: contas a pagar em aberto (status in aberto|vencido).
//
// Calculos (fiel ao api.js L804-823):
//   - receitas = somatorio de (valorPago ?? valorFaturado) nos rows de
//     receberMes com status 'recebido' OU 'parcial'.
//   - despesas = somatorio de valor nos pagarMes com status 'pago'.
//   - aReceber = somatorio de valorFaturado em receberAberto.
//   - aPagar = somatorio de valor em pagarAberto.
//   - inadimplencia = somatorio de valorFaturado em receberAberto com status
//     'vencido'.
//   - porOrigem = [{ origem: convenioNome || "Particular",
//                    valor: sum(valorPago ?? valorFaturado) em receberMes }]
//
// Retorna { receitas, despesas, resultado: receitas-despesas, aReceber, aPagar,
// inadimplencia, receitaPorOrigem }.
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

    const [receberMes, pagarMes, receberAberto, pagarAberto] = await Promise.all([
      db.contaReceber.findMany({
        where: {
          clinicaId: auth.clinicaId,
          dataExame: { startsWith: mes },
        },
        include: { convenio: { select: { nome: true } } },
      }),
      db.contaPagar.findMany({
        where: {
          clinicaId: auth.clinicaId,
          vencimento: { startsWith: mes },
        },
      }),
      db.contaReceber.findMany({
        where: {
          clinicaId: auth.clinicaId,
          status: { in: ["aberto", "vencido", "parcial"] },
        },
      }),
      db.contaPagar.findMany({
        where: {
          clinicaId: auth.clinicaId,
          status: { in: ["aberto", "vencido"] },
        },
      }),
    ]);

    const receitas = somarDinheiro(receberMes.map(valorRecebido));

    const despesas = somarDinheiro(pagarMes
      .filter((p) => p.status === "pago").map((p) => p.valor));

    const aReceber = somarDinheiro(receberAberto.map(saldoReceber));

    const aPagar = somarDinheiro(pagarAberto.map((p) => p.valor));

    const inadimplencia = somarDinheiro(receberAberto
      .filter((r) => r.status === "vencido").map(saldoReceber));

    const porOrigemMap = new Map<string, number>();
    for (const r of receberMes) {
      if (r.status !== "recebido" && r.status !== "parcial") continue;
      const chave = r.convenio?.nome || "Particular";
      porOrigemMap.set(
        chave,
        somarDinheiro([porOrigemMap.get(chave) || 0, valorRecebido(r)])
      );
    }
    const receitaPorOrigem = [...porOrigemMap.entries()].map(([origem, valor]) => ({
      origem,
      valor,
    }));

    return NextResponse.json({
      receitas,
      despesas,
      resultado: somarDinheiro([receitas, -despesas]),
      aReceber,
      aPagar,
      inadimplencia,
      receitaPorOrigem,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
