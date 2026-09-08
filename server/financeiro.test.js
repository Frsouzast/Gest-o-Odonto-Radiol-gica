const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularDRE, agruparRentabilidade, calcularFluxoProjetado, calcularPorHora, calcularConciliacao } = require("./financeiro");

const perto = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test("DRE gerencial bate com o exemplo do mapa mestre", () => {
  // Exemplo do mapa: despesas fixas R$30.000/mês, margem média 60% ->
  // ponto de equilíbrio R$50.000. Aqui simulamos um mês acima disso.
  const dre = calcularDRE({
    receitaBruta: 57000,
    glosas: 1500,
    aliquotaImpostos: 0.06,
    custosVariaveis: 15000,
    despesasFixas: 30000,
  });
  assert.ok(perto(dre.impostos, (57000 - 1500) * 0.06));
  assert.ok(perto(dre.receitaLiquida, 57000 - 1500 - dre.impostos));
  assert.ok(perto(dre.margemContribuicao, dre.receitaLiquida - 15000));
  assert.ok(perto(dre.resultadoOperacional, dre.margemContribuicao - 30000));
  assert.ok(dre.resultadoOperacional > 0, "deveria dar resultado positivo neste cenário");
});

test("rentabilidade agrupada por convênio bate com o exemplo do mapa (Particular vs Convênio)", () => {
  const lancamentos = [
    { chave: "Particular", receita: 350, custo: 135 },
    { chave: "Convênio GEAP", receita: 210, custo: 135 },
  ];
  const grupos = agruparRentabilidade(lancamentos);
  const particular = grupos.find((g) => g.chave === "Particular");
  const geap = grupos.find((g) => g.chave === "Convênio GEAP");

  assert.ok(perto(particular.resultado, 215));
  assert.ok(perto(geap.resultado, 75));
  // "Particular gera 2,86× mais resultado por exame" — do próprio mapa
  assert.ok(perto(particular.resultado / geap.resultado, 215 / 75, 1e-3));
});

test("agrupa múltiplos lançamentos do mesmo grupo (soma receita/custo, calcula ticket médio)", () => {
  const lancamentos = [
    { chave: "Panorâmica", receita: 100, custo: 38 },
    { chave: "Panorâmica", receita: 120, custo: 38 },
  ];
  const [grupo] = agruparRentabilidade(lancamentos);
  assert.equal(grupo.quantidade, 2);
  assert.ok(perto(grupo.receita, 220));
  assert.ok(perto(grupo.ticketMedio, 110));
  assert.ok(perto(grupo.margem, (220 - 76) / 220));
});

test("receita/lucro por hora de equipamento bate com o exemplo do mapa (40min a R$75 -> R$112,50/h)", () => {
  const r = calcularPorHora(75, 0, 40);
  assert.ok(perto(r.receitaPorHora, 112.5));
  const r2 = calcularPorHora(150, 0, 20);
  assert.ok(perto(r2.receitaPorHora, 450));
});

test("conciliação bancária identifica diferença entre sistema e extrato", () => {
  const c = calcularConciliacao({ recebidoSistema: 20000, pagoSistema: 15000, entradasBanco: 19500, saidasBanco: 15000 });
  assert.ok(perto(c.diferencaEntradas, -500));
  assert.ok(perto(c.diferencaSaidas, 0));
});
test("fluxo de caixa projetado bate com o exemplo do mapa (recebimentos 48k, pagamentos 35k -> +13k)", () => {
  const receber = [{ valor_faturado: 30000 }, { valor_faturado: 18000 }];
  const pagar = [{ valor: 20000 }, { valor: 15000 }];
  const fluxo = calcularFluxoProjetado(receber, pagar);
  assert.ok(perto(fluxo.recebimentosPrevistos, 48000));
  assert.ok(perto(fluxo.pagamentosPrevistos, 35000));
  assert.ok(perto(fluxo.saldoProjetado, 13000));
});
