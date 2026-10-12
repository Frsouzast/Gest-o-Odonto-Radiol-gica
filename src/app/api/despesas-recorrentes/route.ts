import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface DespesaRecorrenteCreateBody {
  descricao?: string;
  categoria?: string;
  fornecedor?: string;
  valor?: number;
  diaVencimento?: number;
}

// GET /api/despesas-recorrentes
// Lista as despesas recorrentes cadastradas para a clinica, ordenadas por
// descricao. Requer apenas sessão válida (qualquer papel pode listar).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const rows = await db.despesaRecorrente.findMany({
      where: { clinicaId: auth.clinicaId },
      orderBy: { descricao: "asc" },
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/despesas-recorrentes
// Cria uma nova despesa recorrente. Requer papel dono ou financeiro.
// Default: diaVencimento=5 quando ausente (fiel ao api.js L620). Categoria e
// fornecedor viram null quando ausentes/vazios. `valor` aceita 0 (validacao
// por typeof number — nao usa truthy).
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

    const body =
      (await req.json().catch(() => ({}))) as DespesaRecorrenteCreateBody;
    const { descricao, categoria, fornecedor, valor, diaVencimento } = body;

    const id = crypto.randomUUID();
    const criado = await db.despesaRecorrente.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        descricao: descricao ?? "",
        categoria: categoria || null,
        fornecedor: fornecedor || null,
        valor: valor ?? 0,
        diaVencimento: diaVencimento ?? 5,
      },
    });

    return NextResponse.json(criado, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
