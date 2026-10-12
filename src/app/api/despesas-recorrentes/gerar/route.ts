import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface GerarBody {
  mes?: string;
}

// POST /api/despesas-recorrentes/gerar
// Gera os lancamentos de conta a pagar do mes pedido (formato "YYYY-MM"),
// para cada despesa recorrente ativa da clinica. Idempotente: se ja existe
// uma conta_pagar com recorrenteId = r.id e vencimento LIKE "${mes}%", pula
// aquela despesa. Requer papel dono ou financeiro.
// Retorna 201 { gerados: number } (quantas contas novas foram criadas).
export async function POST(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const check = podeEditar(auth);
    if (!check.ok) {
      return NextResponse.json({ erro: check.erro }, { status: check.status });
    }
    const payload = check.payload;

    const body = (await req.json().catch(() => ({}))) as GerarBody;
    const { mes } = body;

    if (!mes) {
      return NextResponse.json(
        { erro: "mes (AAAA-MM) é obrigatório." },
        { status: 400 }
      );
    }

    const recorrentes = await db.despesaRecorrente.findMany({
      where: { clinicaId: payload.clinicaId, ativa: true },
    });

    let gerados = 0;
    for (const r of recorrentes) {
      const existente = await db.contaPagar.findFirst({
        where: {
          recorrenteId: r.id,
          vencimento: { startsWith: mes },
        },
        select: { id: true },
      });
      if (existente) continue;

      const dia = String(r.diaVencimento).padStart(2, "0");
      const vencimento = `${mes}-${dia}`;
      const id = crypto.randomUUID();

      await db.contaPagar.create({
        data: {
          id,
          clinicaId: payload.clinicaId,
          descricao: r.descricao,
          categoria: r.categoria,
          fornecedor: r.fornecedor,
          valor: r.valor,
          vencimento,
          recorrenteId: r.id,
        },
      });

      gerados += 1;
    }

    return NextResponse.json({ gerados }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
