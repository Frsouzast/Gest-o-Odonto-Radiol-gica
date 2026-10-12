import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface AtivoUpdateBody {
  nome?: string;
  dataAquisicao?: string;
  valorAquisicao?: number;
  vidaUtilAnos?: number;
}

// PUT /api/ativos/[id]
// Atualiza apenas os campos fornecidos entre nome, dataAquisicao, valorAquisicao, vidaUtilAnos.
// Requer papel dono ou financeiro. Retorna 404 se o ativo nao existir na clinica.
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

    const existente = await db.ativo.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Ativo não encontrado." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as AtivoUpdateBody;
    const data: {
      nome?: string;
      dataAquisicao?: string | null;
      valorAquisicao?: number;
      vidaUtilAnos?: number;
    } = {};
    if (typeof body.nome === "string") data.nome = body.nome;
    if (typeof body.dataAquisicao === "string") {
      data.dataAquisicao = body.dataAquisicao;
    }
    if (
      typeof body.valorAquisicao === "number" &&
      !Number.isNaN(body.valorAquisicao)
    ) {
      data.valorAquisicao = body.valorAquisicao;
    }
    if (
      typeof body.vidaUtilAnos === "number" &&
      !Number.isNaN(body.vidaUtilAnos)
    ) {
      data.vidaUtilAnos = body.vidaUtilAnos;
    }

    const atualizado = await db.ativo.update({
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

// DELETE /api/ativos/[id]
// Remove um ativo apenas se pertencer à clinica do usuario autenticado.
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

    await db.ativo.deleteMany({
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
