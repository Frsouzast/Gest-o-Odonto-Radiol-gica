// Cálculos do módulo Financeiro avançado. Funções puras (sem banco/HTTP),
// mesmo padrão do engine.js — permite testar a lógica isoladamente.

/**
 * DRE gerencial simplificada, conforme o mapa mestre:
 *   Receita bruta − Glosas − Impostos = Receita líquida
 *   Receita líquida − Custos variáveis = Margem de contribuição
 *   Margem de contribuição − Despesas fixas = Resultado operacional
 *
 * Simplificação assumida: o imposto incide sobre a receita já líquida de
 * glosa (não sobre o bruto) — é uma aproximação gerencial, não uma apuração
 * fiscal real.
 */
function calcularDRE({ receitaBruta, glosas, aliquotaImpostos, custosVariaveis, despesasFixas }) {
  const baseImposto = receitaBruta - glosas;
  const impostos = baseImposto * aliquotaImpostos;
  const receitaLiquida = baseImposto - impostos;
  const margemContribuicao = receitaLiquida - custosVariaveis;
  const resultadoOperacional = margemContribuicao - despesasFixas;
  return { receitaBruta, glosas, impostos, receitaLiquida, custosVariaveis, margemContribuicao, despesasFixas, resultadoOperacional };
}

/**
 * Agrupa uma lista de lançamentos {chave, receita, custo} por "chave"
 * (procedimento, convênio, dentista...) e calcula margem de cada grupo.
 * Usado tanto pra "rentabilidade por exame" quanto "por convênio".
 */
function agruparRentabilidade(lancamentos) {
  const grupos = new Map();
  for (const l of lancamentos) {
    const atual = grupos.get(l.chave) || { chave: l.chave, receita: 0, custo: 0, quantidade: 0 };
    atual.receita += l.receita;
    atual.custo += l.custo;
    atual.quantidade += 1;
    grupos.set(l.chave, atual);
  }
  return [...grupos.values()].map((g) => ({
    ...g,
    resultado: g.receita - g.custo,
    margem: g.receita > 0 ? (g.receita - g.custo) / g.receita : 0,
    ticketMedio: g.quantidade > 0 ? g.receita / g.quantidade : 0,
  }));
}

/**
 * Fluxo de caixa projetado: soma o que está previsto pra entrar/sair dentro
 * da janela de dias informada, a partir de listas já filtradas por status
 * "aberto" (o filtro por data fica a cargo de quem chama, via SQL).
 */
function calcularFluxoProjetado(contasReceberAbertas, contasPagarAbertas) {
  const recebimentosPrevistos = contasReceberAbertas.reduce((s, c) => s + Number(c.valor_faturado), 0);
  const pagamentosPrevistos = contasPagarAbertas.reduce((s, c) => s + Number(c.valor), 0);
  return {
    recebimentosPrevistos,
    pagamentosPrevistos,
    saldoProjetado: recebimentosPrevistos - pagamentosPrevistos,
  };
}

/**
 * Receita/lucro por hora de um equipamento — o mapa mestre destaca isso
 * como "indicador poderoso": não basta saber o resultado total, é o
 * resultado dividido pelas horas de uso que revela se vale a pena.
 */
function calcularPorHora(receitaTotal, custoTotal, minutosTotais) {
  const horas = minutosTotais / 60;
  if (horas <= 0) return { receitaPorHora: 0, lucroPorHora: 0, horas: 0 };
  return {
    receitaPorHora: receitaTotal / horas,
    lucroPorHora: (receitaTotal - custoTotal) / horas,
    horas,
  };
}

/**
 * Conciliação bancária simplificada: compara o que o sistema registrou
 * como recebido/pago contra o que apareceu no extrato bancário lançado
 * manualmente, no mesmo período.
 */
function calcularConciliacao({ recebidoSistema, pagoSistema, entradasBanco, saidasBanco }) {
  return {
    recebidoSistema,
    entradasBanco,
    diferencaEntradas: entradasBanco - recebidoSistema,
    pagoSistema,
    saidasBanco,
    diferencaSaidas: saidasBanco - pagoSistema,
  };
}

module.exports = { calcularDRE, agruparRentabilidade, calcularFluxoProjetado, calcularPorHora, calcularConciliacao };
