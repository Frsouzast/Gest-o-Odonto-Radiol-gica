import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface MovimentoCreateBody {
  data?: string;
  descricao?: string;
  valor?: number;
}

// GET /api/movimentos-bancarios?mes=YYYY-MM
// Lista movimentos bancarios da clinica. Requer apenas sessão válida.
// Filtro opcional `mes` (data comeca com "YYYY-MM-").
// Ordenacao: data DESC (mais recente primeiro).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const mes = req.nextUrl.searchParams.get("mes") || undefined;

    const where: { clinicaId: string; data?: { startsWith: string } } = {
      clinicaId: auth.clinicaId,
    };
    if (mes) where.data = { startsWith: mes };

    const rows = await db.movimentoBancario.findMany({
      where,
      orderBy: { data: "desc" },
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

// POST /api/movimentos-bancarios
// Cria um movimento bancario. Requer papel dono|financeiro.
// Body: { data, descricao?, valor }. `descricao` vira null se ausente/vazio.
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

    const body = (await req.json().catch(() => ({}))) as MovimentoCreateBody;
    const { data, descricao, valor } = body;

    const id = crypto.randomUUID();
    const criado = await db.movimentoBancario.create({
      data: {
        id,
        clinicaId: auth.clinicaId,
        data: data ?? "",
        descricao: descricao || null,
        valor: valor ?? 0,
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
