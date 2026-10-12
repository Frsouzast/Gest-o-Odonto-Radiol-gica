import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";
import { contaReceberUpdateSchema, readBody } from "@/lib/validation";

interface ContaReceberUpdateBody {
  status?: string;
  valorPago?: number;
  dataRecebimento?: string;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v);

// PUT /api/contas-receber/[id]
// Atualiza status, valorPago e/ou dataRecebimento (marcar como recebido
// parcial/total). Requer papel dono ou financeiro. Retorna 404 se a conta
// nao existir na clinica.
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

    const existente = await db.contaReceber.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Conta a receber não encontrada." },
        { status: 404 }
      );
    }

    const parsed = await readBody(req, contaReceberUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    if (body.valorPago !== undefined && body.valorPago > existente.valorFaturado) {
      return NextResponse.json({ erro: "O valor pago não pode superar o valor faturado." }, { status: 400 });
    }

    const data: {
      status?: string;
      valorPago?: number;
      dataRecebimento?: string;
    } = {};
    if (typeof body.status === "string") data.status = body.status;
    if (isNum(body.valorPago)) data.valorPago = body.valorPago;
    if (typeof body.dataRecebimento === "string")
      data.dataRecebimento = body.dataRecebimento;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { erro: "Nenhum campo reconhecido para atualizar." },
        { status: 400 }
      );
    }

    const atualizado = await db.contaReceber.update({
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

// DELETE /api/contas-receber/[id]
// Remove a conta a receber (glosas vinculadas sao apagadas em cascata pela FK
// onDelete: Cascade no schema Prisma). Requer papel dono ou financeiro.
// Retorna 204 (idempotente via deleteMany por {id, clinicaId}).
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

    await db.contaReceber.deleteMany({
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
