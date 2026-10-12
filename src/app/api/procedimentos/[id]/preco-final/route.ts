import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface PrecoFinalBody {
  precoNovo?: number;
}

// PUT /api/procedimentos/[id]/preco-final
// Define um novo preco final para o procedimento, registrando o valor anterior
// no historico_preco com o usuario autenticado responsavel pela alteracao.
// Requer papel dono ou financeiro. Retorna 204.
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

    const body = (await req.json().catch(() => ({}))) as PrecoFinalBody;
    const { precoNovo } = body;

    if (typeof precoNovo !== "number" || !Number.isFinite(precoNovo) || precoNovo < 0) {
      return NextResponse.json(
        { erro: "precoNovo é obrigatório e deve ser um número não negativo." },
        { status: 400 }
      );
    }

    const existente = await db.procedimento.findFirst({
      where: { id, clinicaId: payload.clinicaId },
      select: { id: true, precoFinal: true },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Procedimento não encontrado." },
        { status: 404 }
      );
    }

    const precoAnterior = existente.precoFinal ?? null;

    // Preço e histórico são persistidos juntos: uma falha não deixa alteração sem rastreio.
    await db.$transaction([
      db.procedimento.update({
        where: { id, clinicaId: payload.clinicaId },
        data: { precoFinal: precoNovo },
      }),
      db.historicoPreco.create({
        data: {
          id: crypto.randomUUID(),
          procedimentoId: id,
          usuarioId: payload.usuarioId,
          precoAnterior,
          precoNovo,
        },
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
