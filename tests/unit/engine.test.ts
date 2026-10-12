import { describe, expect, test } from "bun:test";
import { calcProcedimento, custoFixoPorMinuto, custoFixoTotal, horasEfetivas, insumoUnitCost, pricingSetupIssue, PricingError, roundPriceUp } from "../../src/lib/engine";
import { calcularDRE, calcularConciliacao } from "../../src/lib/financeiro";

describe("cálculos de gestão", () => {
  const input = { tempoMinutos: 20, laudos: 10, retrabalho: 0.1, itens: [{ insumoId: "filme", quantidade: 2 }], comissao: 0.05, lucroDesejado: 0.3, inadimplencia: 0.02, impostos: 0.08, taxaCartao: 0.03 };
  test("custos mensais são somados em centavos", () => {
    expect(custoFixoTotal([{ valor: 0.1 }, { valor: 0.2 }])).toBe(0.3);
  });
  test("configuração ausente, ocupação zero e custos ausentes não viram custo zero", () => {
    const cap = { diasTrabalhados: 20, horasPorDia: 8, unidadesRenda: 1, percentOcupacao: 0.75 };
    expect(pricingSetupIssue([{ valor: 100 }], null)).toContain("capacidade");
    expect(pricingSetupIssue([{ valor: 100 }], { ...cap, percentOcupacao: 0 })).toContain("acima de 0%");
    expect(pricingSetupIssue([], cap)).toContain("Custos não cadastrados");
    expect(pricingSetupIssue([{ valor: 0 }], cap)).toBeNull();
    expect(pricingSetupIssue([{ valor: NaN }], cap)).toContain("valores válidos");
    expect(pricingSetupIssue([{ valor: 1 }], { ...cap, unidadesRenda: 1.5 })).not.toBeNull();
  });
  test("preço sugerido e margem incluem o mesmo retrabalho sobre tempo e materiais", () => {
    const first = calcProcedimento(input, 1, () => 2.5);
    expect(first.retrabalhoValor).toBe(2.5);
    expect(first.custoDireto).toBe(37.5);
    expect(first.precoSugerido).toBe(72.12);
    const final = calcProcedimento({ ...input, precoFinal: first.precoSugerido }, 1, () => 2.5);
    expect(final.lucratividadeFinal).toBeGreaterThanOrEqual(0.3);
    expect(final.pontoEquilibrio).toBe(45.74);
    expect(calcProcedimento({ ...input, precoFinal: final.pontoEquilibrio }, 1, () => 2.5).lucratividadeFinal).toBeGreaterThanOrEqual(0);
  });
  test("arredondamento final não acrescenta centavo quando o valor já é exato", () => {
    expect(roundPriceUp(50)).toBe(50);
    expect(roundPriceUp(0.1 + 0.2)).toBe(0.3);
    expect(roundPriceUp(50.001)).toBe(50.01);
    expect(roundPriceUp(0)).toBe(0);
  });
  test("percentuais impossíveis, duração zero e materiais inválidos são recusados", () => {
    expect(() => calcProcedimento({ ...input, lucroDesejado: 0.9 }, 1, () => 1)).toThrow(PricingError);
    expect(() => calcProcedimento({ ...input, tempoMinutos: 0 }, 1, () => 1)).toThrow(PricingError);
    expect(() => calcProcedimento(input, 1, () => NaN)).toThrow(PricingError);
    expect(() => calcProcedimento({ ...input, impostos: -0.1 }, 1, () => 1)).toThrow(PricingError);
    expect(() => calcProcedimento(input, Infinity, () => 1)).toThrow(PricingError);
    expect(calcProcedimento({ ...input, precoFinal: 0 }, 1, () => 1).lucratividadeFinal).toBeNaN();
  });
  test("rateia R$ 7.200 em 120 horas efetivas: R$ 1 por minuto", () => {
    const capacidade = { diasTrabalhados: 20, horasPorDia: 8, unidadesRenda: 1, percentOcupacao: 0.75 };
    expect(horasEfetivas(capacidade)).toBe(120);
    expect(custoFixoPorMinuto([{ valor: 7200 }], capacidade)).toBe(1);
  });
  test("preço cobre custos e margem de 30% sobre faturamento", () => {
    const result = calcProcedimento({ tempoMinutos: 20, laudos: 10, retrabalho: 0,
      itens: [{ insumoId: "filme", quantidade: 2 }], comissao: 0, lucroDesejado: 0.3,
      inadimplencia: 0, impostos: 0, taxaCartao: 0, precoFinal: 50 }, 1, () => 2.5);
    expect(result.custoDireto).toBe(35);
    expect(result.pontoEquilibrio).toBe(35);
    expect(result.precoSugerido).toBe(50);
    expect(result.lucratividadeFinal).toBeCloseTo(0.3);
  });
  test("insumo divide valor total por quantidade da embalagem", () => {
    expect(insumoUnitCost({ valorTotal: 250, quantidade: 100 })).toBe(2.5);
    expect(() => insumoUnitCost({ valorTotal: 250, quantidade: 0 })).toThrow(PricingError);
    expect(() => insumoUnitCost({ valorTotal: -1, quantidade: 100 })).toThrow(PricingError);
  });
  test("DRE desconta glosa antes dos impostos e custos", () => {
    expect(calcularDRE({ receitaBruta: 1000, glosas: 100, aliquotaImpostos: 0.1,
      custosVariaveis: 200, despesasFixas: 300 })).toEqual({ receitaBruta: 1000, glosas: 100,
      impostos: 90, receitaLiquida: 810, custosVariaveis: 200, margemContribuicao: 610,
      despesasFixas: 300, resultadoOperacional: 310 });
  });
  test("conciliação detecta diferenças de entrada e saída", () => {
    const result = calcularConciliacao({ recebidoSistema: 100, pagoSistema: 50, entradasBanco: 110, saidasBanco: 55 });
    expect(result.diferencaEntradas).toBe(10);
    expect(result.diferencaSaidas).toBe(5);
  });
});
