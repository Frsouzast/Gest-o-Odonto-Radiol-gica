import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";
import { contaPagarUpdateSchema, readBody } from "@/lib/validation";

interface ContaPagarUpdateBody {
  status?: string;
  dataPagamento?: string;
}

// PUT /api/contas-pagar/[id]
// Atualiza apenas status e/ou dataPagamento (marcar como pago). Requer papel
// dono ou financeiro. Retorna 404 se a conta nao existir na clinica.
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

    const existente = await db.contaPagar.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Conta a pagar não encontrada." },
        { status: 404 }
      );
    }

    const parsed = await readBody(req, contaPagarUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const data: { status?: string; dataPagamento?: string } = {};
    if (typeof body.status === "string") data.status = body.status;
    if (typeof body.dataPagamento === "string")
      data.dataPagamento = body.dataPagamento;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { erro: "Nenhum campo reconhecido para atualizar." },
        { status: 400 }
      );
    }

    const atualizado = await db.contaPagar.update({
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

// DELETE /api/contas-pagar/[id]
// Remove a conta a pagar. Requer papel dono ou financeiro. Retorna 204
// (idempotente via deleteMany por {id, clinicaId}).
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

    await db.contaPagar.deleteMany({
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
