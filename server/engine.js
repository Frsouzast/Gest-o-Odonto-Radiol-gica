// Motor de cálculo de custo fixo por minuto e precificação de procedimentos.
// Funções puras: mesma entrada -> mesma saída, sem I/O. Isso é o que torna
// possível testar contra os valores reais da planilha (ver engine.test.js).

function custoFixoTotal(despesas) {
  return despesas.reduce((soma, d) => soma + (d.valor || 0), 0);
}

function horasEfetivas(capacidade) {
  const { diasTrabalhados, horasPorDia, unidadesRenda, percentOcupacao } = capacidade;
  return diasTrabalhados * horasPorDia * unidadesRenda * percentOcupacao;
}

function custoFixoPorHora(despesas, capacidade) {
  const horas = horasEfetivas(capacidade);
  if (horas <= 0) return 0;
  return custoFixoTotal(despesas) / horas;
}

function custoFixoPorMinuto(despesas, capacidade) {
  return custoFixoPorHora(despesas, capacidade) / 60;
}

function insumoUnitCost(insumo) {
  if (!insumo || !insumo.quantidade) return 0;
  return insumo.valorTotal / insumo.quantidade;
}

/**
 * Calcula o custo e o preço de um procedimento.
 *
 * @param {object} proc - { tempoMinutos, laudos, retrabalho, itens: [{insumoId, quantidade}],
 *                           comissao, lucroDesejado, inadimplencia, impostos, taxaCartao,
 *                           outrosPct?, precoFinal? }
 * @param {number} custoMinuto - custo fixo por minuto da clínica (já calculado)
 * @param {(insumoId: string) => number} custoUnitarioInsumo - lookup de custo unitário por id
 */
function calcProcedimento(proc, custoMinuto, custoUnitarioInsumo) {
  const outrosPct = proc.outrosPct || 0;

  const custoInsumos = proc.itens.reduce(
    (soma, item) => soma + item.quantidade * custoUnitarioInsumo(item.insumoId),
    0
  );
  const rateio = proc.tempoMinutos * custoMinuto;
  const retrabalhoValor = (rateio + custoInsumos) * proc.retrabalho;
  const custoDireto = rateio + custoInsumos + retrabalhoValor + proc.laudos;

  const somaPercentComLucro =
    outrosPct + proc.comissao + proc.lucroDesejado + proc.inadimplencia + proc.impostos + proc.taxaCartao;
  const somaPercentSemLucro =
    outrosPct + proc.comissao + proc.inadimplencia + proc.impostos + proc.taxaCartao;

  const precoSugerido = somaPercentComLucro < 1 ? custoDireto / (1 - somaPercentComLucro) : NaN;
  const pontoEquilibrio = somaPercentSemLucro < 1 ? custoDireto / (1 - somaPercentSemLucro) : NaN;

  // Nota: a planilha original calcula o retrabalho de forma diferente aqui do
  // que na fórmula de preço sugerido acima — ali o percentual incide sobre
  // (rateio + insumos), aqui incide só sobre os insumos (E*G, não (D+E)*G).
  // Mantido fiel ao Excel; ver README para a recomendação de padronizar isso.
  const retrabalhoSobreInsumos = custoInsumos * proc.retrabalho;
  const precoFinal = proc.precoFinal || 0;
  const lucratividadeFinal =
    precoFinal > 0
      ? (precoFinal -
          precoFinal * somaPercentSemLucro -
          proc.laudos -
          custoInsumos -
          rateio -
          retrabalhoSobreInsumos) /
        precoFinal
      : NaN;

  return {
    custoInsumos,
    rateio,
    retrabalhoValor,
    custoDireto,
    precoSugerido,
    pontoEquilibrio,
    lucratividadeFinal,
  };
}

module.exports = {
  custoFixoTotal,
  horasEfetivas,
  custoFixoPorHora,
  custoFixoPorMinuto,
  insumoUnitCost,
  calcProcedimento,
};
