import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { calcularFluxoProjetado } from "@/lib/financeiro";

// GET /api/financeiro/fluxo-projetado?dias=30
// Projecao de fluxo de caixa dos proximos N dias. Requer sessão válida.
// `dias` opcional (default 30).
//
// Logica:
//   - hoje = data atual (YYYY-MM-DD)
//   - limite = hoje + dias (YYYY-MM-DD)
//   - 2 queries em paralelo: conta_receber e conta_pagar onde
//     clinicaId, status='aberto', vencimento between hoje e limite
//   - retorna { dias, ...calcularFluxoProjetado(receber, pagar) }
//
// Nota: `vencimento` e String no schema (YYYY-MM-DD). Usamos
// `gte`/`lte` para o range — Prisma traduz para BETWEEN em strings
// lexicograficamente (igual ao `between $2 and $3` do SQL original,
// pois o formato YYYY-MM-DD eh lexicograficamente ordenavel).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const diasParam = req.nextUrl.searchParams.get("dias");
    const dias = diasParam === null ? 30 : Number(diasParam);
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      return NextResponse.json({ erro: "Informe um prazo de 1 a 365 dias." }, { status: 400 });
    }

    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + dias);
    const hojeStr = hoje.toISOString().slice(0, 10);
    const limiteStr = limite.toISOString().slice(0, 10);

    const [receber, pagar] = await Promise.all([
      db.contaReceber.findMany({
        where: {
          clinicaId: auth.clinicaId,
          status: { in: ["aberto", "vencido", "parcial"] },
          vencimento: { gte: hojeStr, lte: limiteStr },
        },
      }),
      db.contaPagar.findMany({
        where: {
          clinicaId: auth.clinicaId,
          status: { in: ["aberto", "vencido"] },
          vencimento: { gte: hojeStr, lte: limiteStr },
        },
      }),
    ]);

    const result = calcularFluxoProjetado(receber, pagar);
    return NextResponse.json({ dias, ...result });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
