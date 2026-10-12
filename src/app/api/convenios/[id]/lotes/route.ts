import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface FecharLoteBody {
  periodoInicio?: string;
  periodoFim?: string;
}

// POST /api/convenios/[id]/lotes
// Fecha um lote de faturamento para o convenio no periodo. Requer papel
// dono|financeiro. Body: { periodoInicio, periodoFim } (ambos obrigatorios).
//
// Logica (fiel ao api.js L968-991):
//   1. Buscar contas a receber ELEGIVEIS para o lote:
//        clinicaId, convenioId=id, loteId=null, dataExame between
//        periodoInicio e periodoFim, status != 'cancelado',
//        pacienteNome != null, procedimentoId != null, valorFaturado > 0
//   2. Se vazio -> 400 { erro: "Nenhum exame elegível nesse período (ou
//        todos têm pendência de conferência)." }
//   3. valor = somatorio de valorFaturado em elegiveis
//   4. Criar lote_faturamento com id randomUUID, clinicaId, convenioId=id,
//        periodoInicio, periodoFim, quantidade, valor, usuarioId
//   5. Para cada conta elegivel, setar loteId = loteId (update em loop)
//   6. Retornar 201 com o lote criado
//
// Nota: usamos `db.$transaction` para criar lote + atualizar todas as contas
// atomicamente (consistente com T2-d /remarkar). Se falhar o update de qualquer
// conta, o lote criado eh rollback automaticamente, evitando lotes "fantasma".
export async function POST(
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

    const { id } = await params;

    const body = (await req.json().catch(() => ({}))) as FecharLoteBody;
    const { periodoInicio, periodoFim } = body;
    if (!periodoInicio || !periodoFim) {
      return NextResponse.json(
        { erro: "periodoInicio e periodoFim são obrigatórios." },
        { status: 400 }
      );
    }

    const elegiveis = await db.contaReceber.findMany({
      where: {
        clinicaId: auth.clinicaId,
        convenioId: id,
        loteId: null,
        dataExame: { gte: periodoInicio, lte: periodoFim },
        status: { not: "cancelado" },
        pacienteNome: { not: null },
        procedimentoId: { not: null },
        valorFaturado: { gt: 0 },
      },
      select: { id: true, valorFaturado: true },
    });

    if (elegiveis.length === 0) {
      return NextResponse.json(
        {
          erro: "Nenhum exame elegível nesse período (ou todos têm pendência de conferência).",
        },
        { status: 400 }
      );
    }

    const valor = elegiveis.reduce(
      (s, c) => s + Number(c.valorFaturado),
      0
    );
    const loteId = crypto.randomUUID();

    const [criado] = await db.$transaction([
      db.loteFaturamento.create({
        data: {
          id: loteId,
          clinicaId: auth.clinicaId,
          convenioId: id,
          periodoInicio,
          periodoFim,
          quantidade: elegiveis.length,
          valor,
          usuarioId: auth.usuarioId,
        },
      }),
      ...elegiveis.map((c) =>
        db.contaReceber.update({
          where: { id: c.id },
          data: { loteId: loteId },
        })
      ),
    ]);

    return NextResponse.json(criado, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
