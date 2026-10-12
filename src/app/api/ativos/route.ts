import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface AtivoBody {
  nome?: string;
  dataAquisicao?: string;
  valorAquisicao?: number;
  vidaUtilAnos?: number;
}

// GET /api/ativos
// Lista todos os ativos (imobilizado) da clinica do usuario autenticado, ordenados por nome.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const ativos = await db.ativo.findMany({
      where: { clinicaId: auth.clinicaId },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(ativos);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/ativos
// Cria um novo ativo para a clinica. Requer papel dono ou financeiro.
// Defaults: dataAquisicao=null, valorAquisicao=0, vidaUtilAnos=1 (fiel ao api.js L239).
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

    const body = (await req.json().catch(() => ({}))) as AtivoBody;
    const { nome, dataAquisicao, valorAquisicao, vidaUtilAnos } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json(
        { erro: "nome é obrigatório." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const ativo = await db.ativo.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        nome,
        dataAquisicao:
          typeof dataAquisicao === "string" && dataAquisicao.trim() !== ""
            ? dataAquisicao
            : null,
        valorAquisicao:
          typeof valorAquisicao === "number" ? valorAquisicao : 0,
        vidaUtilAnos: typeof vidaUtilAnos === "number" ? vidaUtilAnos : 1,
      },
    });

    return NextResponse.json(ativo, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
