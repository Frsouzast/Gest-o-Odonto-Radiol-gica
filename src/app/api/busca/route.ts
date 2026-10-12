import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

interface ResultadoBusca {
  procedimentos: { id: string; nome: string; tempoMinutos: number; precoFinal: number | null }[];
  convenios: { id: string; nome: string; responsavel: string | null }[];
  agendamentos: {
    id: string;
    nome: string;
    data: string;
    hora: string | null;
    exame: string | null;
    status: string;
  }[];
  contasReceber: {
    id: string;
    pacienteNome: string | null;
    valorFaturado: number;
    dataExame: string;
    status: string;
  }[];
}

// GET /api/busca?q=termo
// Busca global em procedimentos, convênios, agendamentos e contas a receber
// da clínica do usuário autenticado. Limite de 8 por categoria.
// Nota SQLite: `mode: insensitive` não é suportado pelo Prisma em SQLite.
// Solução: trazer todos da clínica (são poucos) e filtrar com String.includes()
// em lowercase. Isto é aceitável porque uma clínica tem tipicamente <1000 registros
// em cada tabela — o custo de fetch é dominado pelo JOIN no DB, não pelo filtro em JS.
export async function GET(req: NextRequest) {
  try {
    const payload = await authRequired(req, "operacional");
    if ("erro" in payload) {
      return NextResponse.json({ erro: payload.erro }, { status: payload.status });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 2) {
      return NextResponse.json({
        procedimentos: [],
        convenios: [],
        agendamentos: [],
        contasReceber: [],
      });
    }

    const clinicaId = payload.clinicaId;

    // Busca tudo da clínica (sem filtros) e filtra em JS — SQLite não suporta `mode: insensitive`.
    const [procsAll, convsAll, agendsAll, contasAll] = await Promise.all([
      db.procedimento.findMany({
        where: { clinicaId, ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, tempoMinutos: true, precoFinal: true },
      }),
      payload.papel !== "recepcao" ? db.convenio.findMany({
        where: { clinicaId },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, responsavel: true, cnpj: true },
      }) : Promise.resolve([]),
      db.agendamento.findMany({
        where: { clinicaId },
        orderBy: { data: "desc" },
        select: { id: true, nome: true, data: true, hora: true, exame: true, status: true, telefone: true },
        take: 200, // limite p/ evitar fetched muito grande
      }),
      payload.papel !== "recepcao" ? db.contaReceber.findMany({
        where: { clinicaId },
        orderBy: { dataExame: "desc" },
        select: {
          id: true,
          pacienteNome: true,
          dentistaSolicitante: true,
          valorFaturado: true,
          dataExame: true,
          status: true,
        },
        take: 200,
      }) : Promise.resolve([]),
    ]);

    const match = (s: string | null | undefined) =>
      s != null && s.toLowerCase().includes(q);

    const procedimentos = procsAll
      .filter((p) => match(p.nome))
      .slice(0, 8)
      .map((p) => ({ id: p.id, nome: p.nome, tempoMinutos: p.tempoMinutos, precoFinal: p.precoFinal }));

    const convenios = convsAll
      .filter((c) => match(c.nome) || match(c.responsavel) || match(c.cnpj))
      .slice(0, 8)
      .map((c) => ({ id: c.id, nome: c.nome, responsavel: c.responsavel }));

    const agendamentos = agendsAll
      .filter((a) => match(a.nome) || match(a.exame) || match(a.telefone))
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        nome: a.nome,
        data: a.data,
        hora: a.hora,
        exame: a.exame,
        status: a.status,
      }));

    const contasReceber = contasAll
      .filter((c) => match(c.pacienteNome) || match(c.dentistaSolicitante))
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        pacienteNome: c.pacienteNome,
        valorFaturado: c.valorFaturado,
        dataExame: c.dataExame,
        status: c.status,
      }));

    const resultado: ResultadoBusca = {
      procedimentos,
      convenios,
      agendamentos,
      contasReceber,
    };

    return NextResponse.json(resultado);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
