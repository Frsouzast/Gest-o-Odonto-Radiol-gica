import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface DespesaBody {
  nome?: string;
  valor?: number;
}

// GET /api/despesas
// Lista todas as despesas fixas da clinica do usuario autenticado, ordenadas por `ordem`.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const despesas = await db.despesaFixa.findMany({
      where: { clinicaId: auth.clinicaId },
      orderBy: { ordem: "asc" },
      select: {
        id: true,
        clinicaId: true,
        nome: true,
        valor: true,
        ordem: true,
      },
    });

    return NextResponse.json(despesas);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/despesas
// Cria uma nova despesa fixa para a clinica. Requer papel dono ou financeiro.
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

    const body = (await req.json().catch(() => ({}))) as DespesaBody;
    const { nome, valor } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json(
        { erro: "nome é obrigatório." },
        { status: 400 }
      );
    }
    if (typeof valor !== "number" || Number.isNaN(valor)) {
      return NextResponse.json(
        { erro: "valor é obrigatório e deve ser numérico." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.despesaFixa.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        nome,
        valor,
        ordem: 0,
      },
    });

    return NextResponse.json(
      {
        id,
        clinicaId: payload.clinicaId,
        nome,
        valor,
        ordem: 0,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
