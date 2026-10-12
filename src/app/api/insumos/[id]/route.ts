import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface InsumoUpdateBody {
  nome?: string;
  unidade?: string;
  valorTotal?: number;
  quantidade?: number;
}

// PUT /api/insumos/[id]
// Atualiza apenas os campos fornecidos entre nome, unidade, valorTotal, quantidade.
// Requer papel dono ou financeiro. Retorna 404 se o insumo nao existir na clinica.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existente = await db.insumo.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Insumo não encontrado." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as InsumoUpdateBody;
    const data: {
      nome?: string;
      unidade?: string;
      valorTotal?: number;
      quantidade?: number;
    } = {};
    if (typeof body.nome === "string") data.nome = body.nome;
    if (typeof body.unidade === "string") data.unidade = body.unidade;
    if (typeof body.valorTotal === "number" && !Number.isNaN(body.valorTotal)) {
      data.valorTotal = body.valorTotal;
    }
    if (
      typeof body.quantidade === "number" &&
      !Number.isNaN(body.quantidade)
    ) {
      data.quantidade = body.quantidade;
    }

    const atualizado = await db.insumo.update({
      where: { id },
      data,
    });

    return NextResponse.json(atualizado);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// DELETE /api/insumos/[id]
// Remove um insumo apenas se pertencer à clinica do usuario autenticado.
// Requer papel dono ou financeiro. Retorna 204 (idempotente).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    await db.insumo.deleteMany({
      where: { id, clinicaId: payload.clinicaId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
