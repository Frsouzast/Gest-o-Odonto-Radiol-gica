import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

// GET /api/lotes
// Lista lotes de faturamento da clinica, com join no convenio (nome).
// Requer apenas sessão válida. Ordenacao: fechadoEm DESC (mais recente primeiro).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const rows = await db.loteFaturamento.findMany({
      where: { clinicaId: auth.clinicaId },
      include: { convenio: { select: { nome: true } } },
      orderBy: { fechadoEm: "desc" },
    });

    const result = rows.map(({ convenio, ...l }) => ({
      ...l,
      convenioNome: convenio?.nome ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
