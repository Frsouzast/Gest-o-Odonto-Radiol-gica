import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { readBody, remarcarSchema } from "@/lib/validation";

// PUT /api/agendamentos/[id]/remarcar
// Cria um NOVO agendamento na nova data/hora com os mesmos dados do paciente
// (nome, telefone, exame, plano, particular), marca o original como
// `status='remarcado'` e liga via `remarcadoParaId = novoId` — e assim que o
// "link para o dia remarcado" funciona no app original. Requer `novaData`
// (400 se ausente). Retorna 404 se o original nao existir na clinica.
// Retorna 201 com o novo agendamento. Aberto a qualquer papel autenticado.
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

    const parsed = await readBody(req, remarcarSchema);
    if (!parsed.ok) return parsed.response;
    const { novaData, novaHora } = parsed.data;

    const original = await db.agendamento.findFirst({
      where: { id, clinicaId: auth.clinicaId },
    });
    if (!original) {
      return NextResponse.json(
        { erro: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    const novoId = crypto.randomUUID();

    // Operacao atomica: cria o novo agendamento e marca o original como
    // remarcado numa transacao — evita cenario em que o INSERT funciona mas
    // o UPDATE falha e deixa um novo agendamento orfao sem link de volta.
    // Mesmo padrao adotado em T2-a no `/api/auth/registrar`.
    const [novo] = await db.$transaction([
      db.agendamento.create({
        data: {
          id: novoId,
          clinicaId: auth.clinicaId,
          nome: original.nome,
          telefone: original.telefone,
          exame: original.exame,
          plano: original.plano,
          particular: original.particular,
          data: novaData,
          hora: novaHora ?? null,
          status: "aguardando",
        },
      }),
      db.agendamento.update({
        where: { id, clinicaId: auth.clinicaId },
        data: { status: "remarcado", remarcadoParaId: novoId },
      }),
    ]);

    return NextResponse.json(novo, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
