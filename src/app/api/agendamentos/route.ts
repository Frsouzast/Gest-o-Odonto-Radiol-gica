import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { agendaQuerySchema, agendamentoSchema, readBody } from "@/lib/validation";

// GET /api/agendamentos?data=YYYY-MM-DD
//   OU ?periodoInicio=YYYY-MM-DD&periodoFim=YYYY-MM-DD
// Lista todos os agendamentos da clinica do usuario autenticado.
// Modo data única: usa ?data=AAAA-MM-DD (preserva compat com versão anterior).
// Modo período: usa ?periodoInicio=&periodoFim= (intervalo inclusivo) — útil
// pra ver agenda da semana/mês. Em modo período, ordena por data ASC depois
// hora ASC; em modo data única, mantém a ordenação original (hora NULLs first).
// Inclui os dados do agendamento para o qual este foi remarcado (remarcadoPara)
// achatados em remarcadoParaData/remarcadoParaHora.
// Aberto a qualquer papel autenticado (agendar não é ação financeira).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req, "operacional");
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const params = req.nextUrl.searchParams;
    const query = agendaQuerySchema.safeParse({
      data: params.get("data") ?? undefined,
      periodoInicio: params.get("periodoInicio") ?? undefined,
      periodoFim: params.get("periodoFim") ?? undefined,
    });
    if (!query.success) {
      return NextResponse.json(
        { erro: "Informe uma data válida ou um período com data inicial anterior ou igual à final. Não combine os dois filtros." },
        { status: 400 }
      );
    }
    const { data, periodoInicio, periodoFim } = query.data;

    const where =
      data
        ? { clinicaId: auth.clinicaId, data }
        : {
            clinicaId: auth.clinicaId,
            data: { gte: periodoInicio!, lte: periodoFim! },
          };

    const rows = await db.agendamento.findMany({
      where,
      include: {
        remarcadoPara: { select: { data: true, hora: true } },
      },
    });

    // Ordenação:
    // - Modo data única: hora NULL primeiro, depois hora ASC.
    // - Modo período: data ASC, depois hora NULL primeiro, depois hora ASC.
    rows.sort((a, b) => {
      if (periodoInicio) {
        const cmpData = a.data.localeCompare(b.data);
        if (cmpData !== 0) return cmpData;
      }
      const aNull = !a.hora;
      const bNull = !b.hora;
      if (aNull && bNull) return 0;
      if (aNull) return -1;
      if (bNull) return 1;
      return (a.hora as string).localeCompare(b.hora as string);
    });

    const result = rows.map(({ remarcadoPara, ...agendamento }) => ({
      ...agendamento,
      remarcadoParaData: remarcadoPara?.data ?? null,
      remarcadoParaHora: remarcadoPara?.hora ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/agendamentos
// Cria um novo agendamento. Requer nome e data (400 se ausente). plano e
// particular sao booleanos (default false via schema Prisma). Aberto a
// qualquer papel autenticado. Retorna 201 com a linha criada.
export async function POST(req: NextRequest) {
  try {
    const auth = await authRequired(req, "operacional");
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const parsed = await readBody(req, agendamentoSchema);
    if (!parsed.ok) return parsed.response;
    const { nome, telefone, exame, plano, particular, data, hora } = parsed.data;

    const id = crypto.randomUUID();
    const criado = await db.agendamento.create({
      data: {
        id,
        clinicaId: auth.clinicaId,
        nome,
        telefone: telefone || null,
        exame: exame || null,
        plano: plano ?? false,
        particular: particular ?? false,
        data,
        hora: hora || null,
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
