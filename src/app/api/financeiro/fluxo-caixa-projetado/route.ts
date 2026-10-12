import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { saldoReceber, somarDinheiro, valorRecebido } from "@/lib/money";

interface JanelaFluxo {
  dias: number;
  label: string; // "30 dias", "60 dias", "90 dias"
  recebimentosPrevistos: number;
  pagamentosPrevistos: number;
  saldoProjetado: number;
  quantidadeReceber: number;
  quantidadePagar: number;
}

interface FluxoCaixaResponse {
  janelas: JanelaFluxo[];
  saldoAtualContas: number; // recebido - pago (todas as contas já liquidadas)
}

// GET /api/financeiro/fluxo-caixa-projetado
// Retorna projeção de fluxo de caixa em 3 janelas (30/60/90 dias) baseada
// nas contas a receber/pagar com status "aberto" ou "vencido" e com data de
// vencimento dentro da janela. Útil para o dashboard inicial.
//
// Cálculo:
// - Para cada janela (30/60/90 dias), soma o valor das contas a receber e a
//   pagar cujo vencimento cai dentro da janela.
// - saldoProjetado = recebimentos - pagamentos.
// - saldoAtualContas = soma de todas as contas já recebidas - soma de todas
//   as contas já pagas (snapshot do resultado realizado até hoje).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const clinicaId = auth.clinicaId;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().slice(0, 10);

    // Janelas
    const janelasDias = [30, 60, 90];
    const janelas: JanelaFluxo[] = [];

    // Snapshot do saldo atual (todas as contas liquidadas)
    const [recebidas, pagas] = await Promise.all([
      db.contaReceber.findMany({
        where: { clinicaId, status: { in: ["recebido", "parcial"] } },
        select: { valorPago: true, valorFaturado: true, status: true },
      }),
      db.contaPagar.findMany({
        where: { clinicaId, status: "pago" },
        select: { valor: true },
      }),
    ]);
    const saldoAtualContas =
      somarDinheiro([...recebidas.map(valorRecebido), ...pagas.map((p) => -p.valor)]);

    // Contas a receber e a pagar em aberto (status aberto/vencido/parcial)
    const [receberAberto, pagarAberto] = await Promise.all([
      db.contaReceber.findMany({
        where: {
          clinicaId,
          status: { in: ["aberto", "vencido", "parcial"] },
        },
        select: { valorFaturado: true, valorPago: true, status: true, vencimento: true },
      }),
      db.contaPagar.findMany({
        where: {
          clinicaId,
          status: { in: ["aberto", "vencido"] },
        },
        select: { valor: true, vencimento: true },
      }),
    ]);

    for (const dias of janelasDias) {
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + dias);
      const limiteStr = limite.toISOString().slice(0, 10);

      // Contas a receber com vencimento entre hoje e limite (ou sem vencimento)
      // — contas sem vencimento (vencimento null) entram no saldo de 30 dias
      // como "a receber a qualquer momento"
      const receberNaJanela = receberAberto.filter((r) => {
        if (!r.vencimento) return dias === 30; // sem data = entra na primeira janela
        return r.vencimento >= hojeStr && r.vencimento <= limiteStr;
      });
      const pagarNaJanela = pagarAberto.filter((p) => {
        if (!p.vencimento) return dias === 30;
        return p.vencimento >= hojeStr && p.vencimento <= limiteStr;
      });

      const recebimentosPrevistos = somarDinheiro(receberNaJanela.map(saldoReceber));
      const pagamentosPrevistos = somarDinheiro(pagarNaJanela.map((p) => p.valor));

      janelas.push({
        dias,
        label: `${dias} dias`,
        recebimentosPrevistos,
        pagamentosPrevistos,
        saldoProjetado: somarDinheiro([recebimentosPrevistos, -pagamentosPrevistos]),
        quantidadeReceber: receberNaJanela.length,
        quantidadePagar: pagarNaJanela.length,
      });
    }

    const response: FluxoCaixaResponse = {
      janelas,
      saldoAtualContas,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
