import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { contaReceberSchema, readBody } from "@/lib/validation";

interface ContaReceberCreateBody {
  pacienteNome?: string;
  procedimentoId?: string;
  convenioId?: string;
  dentistaSolicitante?: string;
  dataExame?: string;
  valorFaturado?: number;
  vencimento?: string;
}

// Helper: busca o preco vigente de um procedimento para um convenio numa data
// (regra de "congelar a tabela"). Retorna Number(row.valor) ou null se nao
// houver vigencia cadastrada na data informada.
async function precoVigente(
  convenioId: string,
  procedimentoId: string,
  data: string
): Promise<number | null> {
  const row = await db.convenioTabelaPreco.findFirst({
    where: { convenioId, procedimentoId, vigenciaInicio: { lte: data } },
    orderBy: { vigenciaInicio: "desc" },
    select: { valor: true },
  });
  return row ? Number(row.valor) : null;
}

// GET /api/contas-receber
// Lista as contas a receber da clinica com filtros opcionais:
//   ?status=...          — status exato (aberto|recebido|vencido|parcial|cancelado)
//   ?mes=YYYY-MM         — dataExame comecando com "YYYY-MM-"
//   ?convenioId=...      — convenioId exato
//   ?limit=N&offset=N    — paginacao (default: sem limite; max 200)
// Inclui nome do convenio e do procedimento (select apenas do nome). Retorno
// achatado com convenioNome e procedimentoNome. Ordenacao: dataExame DESC.
// Requer apenas sessão válida.
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const status = req.nextUrl.searchParams.get("status") || undefined;
    const mes = req.nextUrl.searchParams.get("mes") || undefined;
    const convenioId = req.nextUrl.searchParams.get("convenioId") || undefined;
    const limitParam = req.nextUrl.searchParams.get("limit");
    const offsetParam = req.nextUrl.searchParams.get("offset");

    const where: {
      clinicaId: string;
      status?: string;
      dataExame?: { startsWith: string };
      convenioId?: string;
    } = { clinicaId: auth.clinicaId };
    if (status) where.status = status;
    if (mes) where.dataExame = { startsWith: mes };
    if (convenioId) where.convenioId = convenioId;

    // Paginação opcional — se `limit` vier, retorna {rows, total, hasMore}
    // Se não vier, mantém comportamento retrocompatível (array direto).
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam) || 20, 1), 200) : null;
    const offset = offsetParam ? Math.max(parseInt(offsetParam) || 0, 0) : 0;

    if (limit !== null) {
      const [rows, total] = await Promise.all([
        db.contaReceber.findMany({
          where,
          include: {
            convenio: { select: { nome: true } },
            procedimento: { select: { nome: true } },
          },
          orderBy: { dataExame: "desc" },
          take: limit,
          skip: offset,
        }),
        db.contaReceber.count({ where }),
      ]);
      const result = rows.map(({ convenio, procedimento, ...cr }) => ({
        ...cr,
        convenioNome: convenio?.nome ?? null,
        procedimentoNome: procedimento?.nome ?? null,
      }));
      return NextResponse.json({
        rows: result,
        total,
        hasMore: offset + limit < total,
      });
    }

    const rows = await db.contaReceber.findMany({
      where,
      include: {
        convenio: { select: { nome: true } },
        procedimento: { select: { nome: true } },
      },
      orderBy: { dataExame: "desc" },
    });

    const result = rows.map(({ convenio, procedimento, ...cr }) => ({
      ...cr,
      convenioNome: convenio?.nome ?? null,
      procedimentoNome: procedimento?.nome ?? null,
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

// POST /api/contas-receber
// Cria um lancamento de conta a receber. ABERTO A QUALQUER PAPEL
// AUTENTICADO (recepcao pode lancar producao) — nao usa podeEditar.
//
// Logica de valorFaturado:
//  1. Se `valorFaturado` for undefined E existir `convenioId`+`procedimentoId`,
//     busca o preco vigente na tabela do convenio para a data do exame.
//     Se nao houver tabela cadastrada -> 400 pedindo pra cadastrar a tabela.
//  2. Se ainda assim `valorFaturado` for undefined -> 400 (obrigatorio).
export async function POST(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const parsed = await readBody(req, contaReceberSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const {
      pacienteNome,
      procedimentoId,
      convenioId,
      dentistaSolicitante,
      dataExame,
      vencimento,
    } = body;
    let valorFaturado: number | undefined = body.valorFaturado;

    if (!dataExame || !/^\d{4}-\d{2}-\d{2}$/.test(dataExame)) {
      return NextResponse.json(
        { erro: "dataExame é obrigatória e precisa estar no formato AAAA-MM-DD." },
        { status: 400 }
      );
    }
    if (
      valorFaturado !== undefined &&
      (!Number.isFinite(valorFaturado) || valorFaturado < 0)
    ) {
      return NextResponse.json(
        { erro: "valorFaturado precisa ser um número não negativo." },
        { status: 400 }
      );
    }

    const [procedimento, convenio] = await Promise.all([
      procedimentoId
        ? db.procedimento.findFirst({
            where: { id: procedimentoId, clinicaId: auth.clinicaId },
            select: { id: true },
          })
        : Promise.resolve(null),
      convenioId
        ? db.convenio.findFirst({
            where: { id: convenioId, clinicaId: auth.clinicaId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if ((procedimentoId && !procedimento) || (convenioId && !convenio)) {
      return NextResponse.json(
        { erro: "Procedimento ou convênio não encontrado nesta clínica." },
        { status: 404 }
      );
    }

    if (valorFaturado === undefined && convenioId && procedimentoId && dataExame) {
      const vigente = await precoVigente(convenioId, procedimentoId, dataExame);
      if (vigente === null) {
        return NextResponse.json(
          {
            erro: "Não há preço cadastrado para esse convênio + procedimento nessa data. Cadastre na tabela de preços do convênio ou informe valorFaturado manualmente.",
          },
          { status: 400 }
        );
      }
      valorFaturado = vigente;
    }

    if (valorFaturado === undefined) {
      return NextResponse.json(
        {
          erro: "valorFaturado é obrigatório (ou informe convenioId + procedimentoId com tabela cadastrada).",
        },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const criado = await db.contaReceber.create({
      data: {
        id,
        clinicaId: auth.clinicaId,
        pacienteNome: pacienteNome || null,
        procedimentoId: procedimentoId || null,
        convenioId: convenioId || null,
        dentistaSolicitante: dentistaSolicitante || null,
        dataExame,
        valorFaturado,
        vencimento: vencimento || null,
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
