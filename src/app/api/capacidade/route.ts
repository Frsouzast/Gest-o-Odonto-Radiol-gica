import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";
import { capacidadeSchema, readBody } from "@/lib/validation";

// GET /api/capacidade
// Retorna a única linha de capacidade produtiva da clinica, ou null se nao configurada.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const capacidade = await db.capacidadeProdutiva.findUnique({
      where: { clinicaId: auth.clinicaId },
    });

    return NextResponse.json(capacidade);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// PUT /api/capacidade
// Upsert: cria ou atualiza a única linha de capacidade produtiva da clinica
// (clinicaId é a PK de capacidade_produtiva). Requer papel dono ou financeiro.
export async function PUT(req: NextRequest) {
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

    const parsed = await readBody(req, capacidadeSchema);
    if (!parsed.ok) return parsed.response;
    const { diasTrabalhados, horasPorDia, unidadesRenda, percentOcupacao } =
      parsed.data;

    const capacidade = await db.capacidadeProdutiva.upsert({
      where: { clinicaId: payload.clinicaId },
      create: {
        clinicaId: payload.clinicaId,
        diasTrabalhados,
        horasPorDia,
        unidadesRenda,
        percentOcupacao,
      },
      update: {
        diasTrabalhados,
        horasPorDia,
        unidadesRenda,
        percentOcupacao,
      },
    });

    return NextResponse.json(capacidade);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
