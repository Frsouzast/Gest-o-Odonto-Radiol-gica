import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

// GET /api/glosas
// Lista as glosas da clinica, com join em conta_receber e convenio para
// trazer o nome do paciente, valor faturado, data do exame e nome do
// convenio. Filtra por clinicaId atraves da relacao contaReceber.clinicaId
// (a tabela glosa em si nao tem clinicaId direto). Ordenacao: criadoEm DESC.
//   ?status=...      — filtra por status exato (glosada|em_recurso|recuperada|perdida)
//   ?limit=N&offset=N — paginacao (default: sem limite; max 200)
// Requer apenas sessão válida.
//
// Retorno achatado para `[{...g, pacienteNome, valorFaturado, dataExame, convenioNome, diasEmRecurso, atrasada}]`
// (o relation contaReceber e removido do spread para nao vazar dados do
// paciente/convenio alem dos 4 campos explicitamente achatados).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const statusParam = req.nextUrl.searchParams.get("status") || undefined;
    const limitParam = req.nextUrl.searchParams.get("limit");
    const offsetParam = req.nextUrl.searchParams.get("offset");

    const where: { contaReceber: { clinicaId: string }; status?: string } = {
      contaReceber: { clinicaId: auth.clinicaId },
    };
    if (statusParam) where.status = statusParam;

    // Helper para mapear row -> resposta achatada com diasEmRecurso + atrasada
    const mapGlosa = ({ contaReceber, ...g }: {
      contaReceber: { pacienteNome: string | null; valorFaturado: number | null; dataExame: string | null; convenio: { nome: string | null } | null } | null;
      id: string; contaReceberId: string; valor: number; motivo: string | null; status: string; valorRecuperado: number | null; criadoEm: Date | string;
    }) => {
      const criadoEmMs = g.criadoEm ? new Date(g.criadoEm).getTime() : Date.now();
      const diasEmRecurso = Math.floor((Date.now() - criadoEmMs) / (1000 * 60 * 60 * 24));
      const atrasada = g.status === "em_recurso" && diasEmRecurso > 30;
      return {
        ...g,
        pacienteNome: contaReceber?.pacienteNome ?? null,
        valorFaturado: contaReceber?.valorFaturado ?? null,
        dataExame: contaReceber?.dataExame ?? null,
        convenioNome: contaReceber?.convenio?.nome ?? null,
        diasEmRecurso,
        atrasada,
      };
    };

    // Paginação opcional
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam) || 20, 1), 200) : null;
    const offset = offsetParam ? Math.max(parseInt(offsetParam) || 0, 0) : 0;

    if (limit !== null) {
      const [rows, total] = await Promise.all([
        db.glosa.findMany({
          where,
          include: {
            contaReceber: { include: { convenio: true } },
          },
          orderBy: { criadoEm: "desc" },
          take: limit,
          skip: offset,
        }),
        db.glosa.count({ where }),
      ]);
      const result = rows.map(mapGlosa);
      return NextResponse.json({
        rows: result,
        total,
        hasMore: offset + limit < total,
      });
    }

    const rows = await db.glosa.findMany({
      where,
      include: {
        contaReceber: { include: { convenio: true } },
      },
      orderBy: { criadoEm: "desc" },
    });

    const result = rows.map(mapGlosa);

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
