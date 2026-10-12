import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

interface StatusCount {
  status: string;
  total: number;
}

// GET /api/agendamentos/resumo-status?periodoInicio=YYYY-MM-DD&periodoFim=YYYY-MM-DD
// Retorna contagem de agendamentos por status num período (default: próximos 30 dias a partir de hoje).
// Útil para pie chart de distribuição no dashboard inicial.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req, "operacional");
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const params = req.nextUrl.searchParams;
    let periodoInicio = params.get("periodoInicio");
    let periodoFim = params.get("periodoFim");

    // Default: próximos 30 dias a partir de hoje
    if (!periodoInicio || !periodoFim) {
      const hoje = new Date();
      const fim = new Date();
      fim.setDate(fim.getDate() + 30);
      periodoInicio = hoje.toISOString().slice(0, 10);
      periodoFim = fim.toISOString().slice(0, 10);
    }

    const rows = await db.agendamento.findMany({
      where: {
        clinicaId: auth.clinicaId,
        data: { gte: periodoInicio, lte: periodoFim },
      },
      select: { status: true },
    });

    const contagem = new Map<string, number>();
    for (const r of rows) {
      contagem.set(r.status, (contagem.get(r.status) ?? 0) + 1);
    }

    // Garante que todos os 5 status apareçam (mesmo com zero) — facilita o frontend
    const todosStatus: StatusCount[] = [
      "aguardando",
      "atendido",
      "faltou",
      "desmarcou",
      "remarcado",
    ].map((status) => ({
      status,
      total: contagem.get(status) ?? 0,
    }));

    const total = rows.length;

    return NextResponse.json({
      periodoInicio,
      periodoFim,
      total,
      porStatus: todosStatus,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
