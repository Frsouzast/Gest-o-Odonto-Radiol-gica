// Testes de regressão: os valores esperados abaixo vieram diretamente da
// planilha original (abas "Custos fixos", "Procedimentos" e "Cálculo de
// preços"), calculados pelo Excel/LibreOffice. Se o motor divergir daqui,
// algo na fórmula portada está errado — não é um valor inventado.

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  custoFixoTotal,
  horasEfetivas,
  custoFixoPorHora,
  custoFixoPorMinuto,
  calcProcedimento,
} = require("./engine");

const close = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

// ---- dados reais da aba "Custos fixos" ----
const despesasReais = [{ id: "total", valor: 44460.8663257352 }]; // soma já consolidada
const capacidadeReal = {
  diasTrabalhados: 24,
  horasPorDia: 8,
  unidadesRenda: 2,
  percentOcupacao: 0.75,
};

test("custo fixo por hora e por minuto batem com a planilha", () => {
  assert.equal(horasEfetivas(capacidadeReal), 288);
  assert.ok(close(custoFixoTotal(despesasReais), 44460.8663257352));
  assert.ok(close(custoFixoPorHora(despesasReais, capacidadeReal), 154.378008075469, 1e-6));
  assert.ok(close(custoFixoPorMinuto(despesasReais, capacidadeReal), 2.57296680125782, 1e-6));
});

const custoMinutoReal = custoFixoPorMinuto(despesasReais, capacidadeReal);

test('procedimento "Panorâmica" bate com a linha 13 da aba Cálculo de preços', () => {
  const proc = {
    tempoMinutos: 16,
    laudos: 12,
    retrabalho: 0.03,
    itens: [], // custo de insumos injetado direto no lookup abaixo
    comissao: 0,
    lucroDesejado: 0.3,
    inadimplencia: 0.03,
    impostos: 0.15,
    taxaCartao: 0.03,
    precoFinal: 140,
  };
  // injeta o custo de insumos já somado (6.42293714285714) como um item único
  proc.itens = [{ insumoId: "x", quantidade: 1 }];
  const lookup = () => 6.42293714285714;

  const r = calcProcedimento(proc, custoMinutoReal, lookup);

  assert.ok(close(r.rateio, 41.1674688201252, 1e-6), `rateio=${r.rateio}`);
  assert.ok(close(r.precoSugerido, 124.526771718106, 1e-6), `precoSugerido=${r.precoSugerido}`);
  assert.ok(close(r.pontoEquilibrio, 77.2381242302174, 1e-6), `pontoEquilibrio=${r.pontoEquilibrio}`);
  assert.ok(close(r.lucratividadeFinal, 0.362977899448086, 1e-6), `lucratividade=${r.lucratividadeFinal}`);
});

test('procedimento "Doc COM Modelo de Resina" bate com a linha 9 da aba Cálculo de preços', () => {
  const proc = {
    tempoMinutos: 45,
    laudos: 15,
    retrabalho: 0.03,
    itens: [{ insumoId: "x", quantidade: 1 }],
    comissao: 0,
    lucroDesejado: 0.3,
    inadimplencia: 0.03,
    impostos: 0.15,
    taxaCartao: 0.03,
    precoFinal: 230,
  };
  const lookup = () => 27.5743944155844;

  const r = calcProcedimento(proc, custoMinutoReal, lookup);

  assert.ok(close(r.rateio, 115.783506056602, 1e-6), `rateio=${r.rateio}`);
  assert.ok(close(r.precoSugerido, 331.956403033371, 1e-5), `precoSugerido=${r.precoSugerido}`);
  assert.ok(close(r.pontoEquilibrio, 205.897009476395, 1e-5), `pontoEquilibrio=${r.pontoEquilibrio}`);
  assert.ok(close(r.lucratividadeFinal, 0.0978907291102002, 1e-6), `lucratividade=${r.lucratividadeFinal}`);
});
