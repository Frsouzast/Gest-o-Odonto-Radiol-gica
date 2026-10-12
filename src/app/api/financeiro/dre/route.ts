import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { calcularDRE } from "@/lib/financeiro";

// Helper: custo variavel de um procedimento = somatorio de
//   pi.quantidade * (insumo.quantidade > 0 ? insumo.valorTotal / insumo.quantidade : 0)
// (fiel ao SQL `select pi.quantidade, i.valor_total, i.quantidade as insumo_quantidade
//  from procedimento_insumo pi join insumo i on i.id = pi.insumo_id where pi.procedimento_id = $1`
//  e a reducao do api.js L857).
async function custoVariavelProcedimento(procedimentoId: string): Promise<number> {
  const itens = await db.procedimentoInsumo.findMany({
    where: { procedimentoId },
    select: {
      quantidade: true,
      insumo: { select: { valorTotal: true, quantidade: true } },
    },
  });
  return itens.reduce((s, it) => {
    const insumoQtd = Number(it.insumo?.quantidade);
    const insumoValor = Number(it.insumo?.valorTotal);
    const unit = insumoQtd ? insumoValor / insumoQtd : 0;
    return s + Number(it.quantidade) * unit;
  }, 0);
}

// GET /api/financeiro/dre?mes=YYYY-MM
// DRE gerencial mensal. Requer sessão válida. `mes` obrigatorio.
//
// 4 queries em paralelo:
//   1. config: `financeiro_config` da clinica (linha unica, pode ser null).
//   2. receber: contas a receber do mes (dataExame comeca com "YYYY-MM-").
//   3. despesas: `despesa_fixa` da clinica (select valor).
//   4. ativos: `ativo` da clinica (select valorAquisicao, vidaUtilAnos).
//
// Em seguida:
//   - aliquota = config?.aliquotaImpostosPct ?? 0.06
//   - receitaBruta = somatorio de receber.valorFaturado
//   - glosas = somatorio de `glosa.valor` das glosas cuja conta_receber
//     pertence a clinica e cujo dataExame comeca com mes
//   - custosVariaveis = somatorio, para cada conta_receber com procedimentoId,
//     de custoVariavelProcedimento(procedimentoId)
//   - despesasFixas = somatorio de despesaFixa.valor + somatorio de depreciação
//     mensal dos ativos (vidaUtilAnos > 0 ? valorAquisicao / vidaUtilAnos / 12 : 0)
//
// Retorna o objeto DRE (calcularDRE de @/lib/financeiro).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const mes = req.nextUrl.searchParams.get("mes");
    if (!mes) {
      return NextResponse.json(
        { erro: "mes (AAAA-MM) é obrigatório." },
        { status: 400 }
      );
    }

    const [configArr, receber, despesas, ativos] = await Promise.all([
      db.financeiroConfig.findFirst({
        where: { clinicaId: auth.clinicaId },
      }),
      db.contaReceber.findMany({
        where: {
          clinicaId: auth.clinicaId,
          dataExame: { startsWith: mes },
        },
      }),
      db.despesaFixa.findMany({
        where: { clinicaId: auth.clinicaId },
        select: { valor: true },
      }),
      db.ativo.findMany({
        where: { clinicaId: auth.clinicaId },
        select: { valorAquisicao: true, vidaUtilAnos: true },
      }),
    ]);

    const aliquota = configArr ? Number(configArr.aliquotaImpostosPct) : 0.06;

    const receitaBruta = receber.reduce(
      (s, r) => s + Number(r.valorFaturado),
      0
    );

    const glosasDoMes = await db.glosa.findMany({
      where: {
        contaReceber: {
          clinicaId: auth.clinicaId,
          dataExame: { startsWith: mes },
        },
      },
      select: { valor: true },
    });
    const glosas = glosasDoMes.reduce((s, g) => s + Number(g.valor), 0);

    let custosVariaveis = 0;
    for (const r of receber) {
      if (!r.procedimentoId) continue;
      custosVariaveis += await custoVariavelProcedimento(r.procedimentoId);
    }

    const despesasFixas =
      despesas.reduce((s, d) => s + Number(d.valor), 0) +
      ativos.reduce((s, a) => {
        const vida = Number(a.vidaUtilAnos);
        return s + (vida > 0 ? Number(a.valorAquisicao) / vida / 12 : 0);
      }, 0);

    const dre = calcularDRE({
      receitaBruta,
      glosas,
      aliquotaImpostos: aliquota,
      custosVariaveis,
      despesasFixas,
    });

    return NextResponse.json(dre);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
