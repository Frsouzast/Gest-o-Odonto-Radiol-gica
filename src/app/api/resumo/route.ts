import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import {
  pricingSetupIssue,
  PricingError,
  custoFixoTotal,
  horasEfetivas,
  custoFixoPorHora,
  custoFixoPorMinuto,
  type Despesa,
  type Capacidade,
} from "@/lib/engine";

// GET /api/resumo
// Agregado: custo fixo por minuto da clinica — coração do motor de precificação.
// Le despesas fixas + depreciacao mensal de ativos, divide pelas horas efetivas
// (capacidade produtiva configurada). Retorna 400 se a capacidade estiver ausente.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const clinicaId = auth.clinicaId;

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

    // Despesas fixas entram como { valor }.
    const despesas: Despesa[] = despesasRows.map((d) => ({
      valor: Number(d.valor),
    }));

    // Depreciacao mensal de cada ativo = valorAquisicao / vidaUtil (anos) / 12.
    // Ativos com vidaUtilAnos = 0 ou negativo contribuem 0 (evita divisão por zero).
    const depreciacoes: Despesa[] = ativosRows.map((a) => ({
      valor:
        Number(a.vidaUtilAnos) > 0
          ? Number(a.valorAquisicao) / Number(a.vidaUtilAnos) / 12
          : 0,
    }));

    const depreciacaoMensalTotal = custoFixoTotal(depreciacoes);

    const capacidade: Capacidade = {
      diasTrabalhados: Number(capacidadeRow.diasTrabalhados),
      horasPorDia: Number(capacidadeRow.horasPorDia),
      unidadesRenda: Number(capacidadeRow.unidadesRenda),
      percentOcupacao: Number(capacidadeRow.percentOcupacao),
    };
    const todosOsCustos: Despesa[] = [...despesas, ...depreciacoes];
    const setupIssue = pricingSetupIssue(todosOsCustos, capacidade);
    if (setupIssue) return NextResponse.json({ erro: setupIssue }, { status: 400 });

    return NextResponse.json({
      custoFixoTotal: custoFixoTotal(todosOsCustos),
      depreciacaoMensalTotal,
      horasEfetivas: horasEfetivas(capacidade),
      custoFixoPorHora: custoFixoPorHora(todosOsCustos, capacidade),
      custoFixoPorMinuto: custoFixoPorMinuto(todosOsCustos, capacidade),
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
