import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { agendamentoUpdateSchema, readBody } from "@/lib/validation";

// PUT /api/agendamentos/[id]
// Atualiza apenas os campos fornecidos entre nome, telefone, exame, plano,
// particular, data, hora e status. Datas, horários e booleanos são validados.
// Retorna 404 se o agendamento nao existir na clinica do usuario autenticado.
// Aberto a qualquer papel autenticado (agendar nao e acao financeira).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authRequired(req, "operacional");
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const { id } = await params;

    const existente = await db.agendamento.findFirst({
      where: { id, clinicaId: auth.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    const parsed = await readBody(req, agendamentoUpdateSchema);
    if (!parsed.ok) return parsed.response;

    const atualizado = await db.agendamento.update({
      where: { id, clinicaId: auth.clinicaId },
      data: parsed.data,
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

// DELETE /api/agendamentos/[id]
// Remove o agendamento se pertencer a clinica do usuario autenticado.
// Retorna 204 (idempotente via `deleteMany` por {id, clinicaId}).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authRequired(req, "operacional");
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const { id } = await params;

    await db.agendamento.deleteMany({
      where: { id, clinicaId: auth.clinicaId },
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
