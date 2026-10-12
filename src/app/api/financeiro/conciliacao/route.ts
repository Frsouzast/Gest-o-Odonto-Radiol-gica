import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { calcularConciliacao } from "@/lib/financeiro";

// GET /api/financeiro/conciliacao?mes=YYYY-MM
// Conciliacao bancaria mensal. Requer sessão válida. `mes` obrigatorio.
//
// 3 queries em paralelo:
//   - recebidos: conta_receber onde clinicaId, status='recebido' e
//     dataRecebimento comeca com mes (select valorPago, valorFaturado).
//   - pagos: conta_pagar onde clinicaId, status='pago' e dataPagamento
//     comeca com mes (select valor).
//   - movimentos: movimento_bancario onde clinicaId e data comeca com mes
//     (select valor).
//
// Calculos:
//   - recebidoSistema = somatorio de (valorPago ?? valorFaturado) em recebidos
//   - pagoSistema = somatorio de valor em pagos
//   - entradasBanco = somatorio de valor em movimentos onde Number(valor) > 0
//   - saidasBanco = somatorio de Math.abs(Number(valor)) em movimentos onde
//     Number(valor) < 0
//
// Retorna calcularConciliacao(...) de @/lib/financeiro.
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

    const [recebidos, pagos, movimentos] = await Promise.all([
      db.contaReceber.findMany({
        where: {
          clinicaId: auth.clinicaId,
          status: "recebido",
          dataRecebimento: { startsWith: mes },
        },
        select: { valorPago: true, valorFaturado: true },
      }),
      db.contaPagar.findMany({
        where: {
          clinicaId: auth.clinicaId,
          status: "pago",
          dataPagamento: { startsWith: mes },
        },
        select: { valor: true },
      }),
      db.movimentoBancario.findMany({
        where: {
          clinicaId: auth.clinicaId,
          data: { startsWith: mes },
        },
        select: { valor: true },
      }),
    ]);

    const recebidoSistema = recebidos.reduce(
      (s, r) => s + Number(r.valorPago ?? r.valorFaturado),
      0
    );
    const pagoSistema = pagos.reduce((s, p) => s + Number(p.valor), 0);
    const entradasBanco = movimentos
      .filter((m) => Number(m.valor) > 0)
      .reduce((s, m) => s + Number(m.valor), 0);
    const saidasBanco = movimentos
      .filter((m) => Number(m.valor) < 0)
      .reduce((s, m) => s + Math.abs(Number(m.valor)), 0);

    const result = calcularConciliacao({
      recebidoSistema,
      pagoSistema,
      entradasBanco,
      saidasBanco,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
