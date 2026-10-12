import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface InsumoBody {
  nome?: string;
  unidade?: string;
  valorTotal?: number;
  quantidade?: number;
}

// GET /api/insumos
// Lista todos os insumos da clinica do usuario autenticado, ordenados por nome.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const insumos = await db.insumo.findMany({
      where: { clinicaId: auth.clinicaId },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(insumos);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/insumos
// Cria um novo insumo para a clinica. Requer papel dono ou financeiro.
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

    const body = (await req.json().catch(() => ({}))) as InsumoBody;
    const { nome, unidade, valorTotal, quantidade } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json(
        { erro: "nome é obrigatório." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const insumo = await db.insumo.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        nome,
        unidade: typeof unidade === "string" ? unidade : "un",
        valorTotal: typeof valorTotal === "number" ? valorTotal : 0,
        quantidade: typeof quantidade === "number" ? quantidade : 1,
      },
    });

    return NextResponse.json(insumo, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
