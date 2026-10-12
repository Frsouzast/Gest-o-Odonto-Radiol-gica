import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

interface SemanaData {
  semanaInicio: string; // "YYYY-MM-DD" (segunda-feira)
  semanaFim: string; // "YYYY-MM-DD" (domingo)
  label: string; // "dd/mm - dd/mm"
  total: number;
  porStatus: { status: string; total: number }[];
}

// GET /api/agendamentos/historico-8-semanas
// Retorna 8 semanas (terminando na semana atual) com a contagem de
// agendamentos por semana e por status. Útil para linha do tempo no Início.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req, "operacional");
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    // Semana atual começa na segunda-feira
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segundaAtual = new Date(hoje);
    segundaAtual.setDate(hoje.getDate() + diffSegunda);
    segundaAtual.setHours(12, 0, 0, 0);

    const semanas: SemanaData[] = [];
    for (let i = 7; i >= 0; i--) {
      const inicio = new Date(segundaAtual);
      inicio.setDate(segundaAtual.getDate() - i * 7);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);

      const inicioStr = inicio.toISOString().slice(0, 10);
      const fimStr = fim.toISOString().slice(0, 10);

      const rows = await db.agendamento.findMany({
        where: {
          clinicaId: auth.clinicaId,
          data: { gte: inicioStr, lte: fimStr },
        },
        select: { status: true },
      });

      const porStatusMap = new Map<string, number>();
      for (const r of rows) {
        porStatusMap.set(r.status, (porStatusMap.get(r.status) ?? 0) + 1);
      }
      const todosStatus = ["aguardando", "atendido", "faltou", "desmarcou", "remarcado"];
      const porStatus = todosStatus.map((s) => ({
        status: s,
        total: porStatusMap.get(s) ?? 0,
      }));

      const fmt = (d: Date) =>
        new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);

      semanas.push({
        semanaInicio: inicioStr,
        semanaFim: fimStr,
        label: `${fmt(inicio)} – ${fmt(fim)}`,
        total: rows.length,
        porStatus,
      });
    }

    return NextResponse.json({
      semanas,
      semanaAtualInicio: segundaAtual.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
