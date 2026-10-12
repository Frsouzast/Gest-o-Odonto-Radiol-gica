import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";
import { contaPagarSchema, readBody } from "@/lib/validation";

interface ContaPagarCreateBody {
  descricao?: string;
  categoria?: string;
  fornecedor?: string;
  valor?: number;
  vencimento?: string;
}

// GET /api/contas-pagar
// Lista as contas a pagar da clinica com filtros opcionais via query string:
//   ?status=...      — filtra por status exato (aberto|pago|vencido|cancelado)
//   ?mes=YYYY-MM     — filtra vencimento comecando com "YYYY-MM-" (startsWith)
//   ?limit=N&offset=N — paginacao (default: sem limite; max 200)
// Ordenacao: vencimento ASC. Requer apenas sessão válida.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const status = req.nextUrl.searchParams.get("status") || undefined;
    const mes = req.nextUrl.searchParams.get("mes") || undefined;
    const limitParam = req.nextUrl.searchParams.get("limit");
    const offsetParam = req.nextUrl.searchParams.get("offset");

    const where: {
      clinicaId: string;
      status?: string;
      vencimento?: { startsWith: string };
    } = { clinicaId: auth.clinicaId };
    if (status) where.status = status;
    if (mes) where.vencimento = { startsWith: mes };

    // Paginação opcional — se `limit` vier, retorna {rows, total, hasMore}
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam) || 20, 1), 200) : null;
    const offset = offsetParam ? Math.max(parseInt(offsetParam) || 0, 0) : 0;

    if (limit !== null) {
      const [rows, total] = await Promise.all([
        db.contaPagar.findMany({
          where,
          orderBy: { vencimento: "asc" },
          take: limit,
          skip: offset,
        }),
        db.contaPagar.count({ where }),
      ]);
      return NextResponse.json({
        rows,
        total,
        hasMore: offset + limit < total,
      });
    }

    const rows = await db.contaPagar.findMany({
      where,
      orderBy: { vencimento: "asc" },
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

// POST /api/contas-pagar
// Cria uma conta a pagar avulsa (sem vinculo com despesa recorrente). Requer
// papel dono ou financeiro. Campos categoria/fornecedor viram null quando
// ausentes/vazios (fiel ao api.js L672).
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

    const parsed = await readBody(req, contaPagarSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { descricao, categoria, fornecedor, valor, vencimento } = body;

    const id = crypto.randomUUID();
    const criado = await db.contaPagar.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        descricao: descricao ?? "",
        categoria: categoria || null,
        fornecedor: fornecedor || null,
        valor: valor ?? 0,
        vencimento: vencimento ?? "",
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
