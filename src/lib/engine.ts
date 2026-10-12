// Motor de cálculo de custo fixo por minuto e precificação de procedimentos.
// Funções puras (sem I/O). Preço sugerido e margem usam a mesma base de custos.
import { somarDinheiro } from "./money";

export class PricingError extends Error {}

export function pricingSetupIssue(despesas: Despesa[], capacidade: Capacidade | null): string | null {
  if (!capacidade) return "Configure a capacidade produtiva em Custos & Capacidade antes de calcular preços.";
  const { diasTrabalhados: dias, horasPorDia: horas, unidadesRenda: unidades, percentOcupacao: ocupacao } = capacidade;
  if (![dias, horas, unidades, ocupacao].every(Number.isFinite) || !Number.isInteger(dias) || dias < 1 || dias > 31 || horas <= 0 || horas > 24 || !Number.isInteger(unidades) || unidades < 1 || ocupacao <= 0 || ocupacao > 1)
    return "A capacidade produtiva precisa de dias, horas e unidades válidos e ocupação acima de 0%. Ocupação é a parte do tempo disponível realmente usada em atendimentos.";
  if (!despesas.length) return "Cadastre os custos mensais em Custos & Capacidade antes de calcular preços. Custos não cadastrados não significam custo zero.";
  if (despesas.some((d) => !Number.isFinite(d.valor) || d.valor < 0)) return "Revise os custos mensais: use valores válidos, sem números negativos.";
  return null;
}

// Só arredonda o preço final; o centavo seguinte evita reduzir a margem pretendida.
export function roundPriceUp(value: number): number {
  const scaled = value * 100;
  if (!Number.isFinite(scaled) || scaled < 0 || scaled > Number.MAX_SAFE_INTEGER) throw new PricingError("Preço fora do limite de cálculo. Revise custos e percentuais.");
  const nearest = Math.round(scaled);
  return (Math.abs(scaled - nearest) <= Number.EPSILON * Math.max(1, scaled) * 4 ? nearest : Math.ceil(scaled)) / 100;
}

export interface Despesa {
  valor: number;
}

export interface Capacidade {
  diasTrabalhados: number;
  horasPorDia: number;
  unidadesRenda: number;
  percentOcupacao: number;
}

export interface ItemProcedimento {
  insumoId: string;
  quantidade: number;
}

export interface ProcedimentoInput {
  tempoMinutos: number;
  laudos: number;
  retrabalho: number;
  itens: ItemProcedimento[];
  comissao: number;
  lucroDesejado: number;
  inadimplencia: number;
  impostos: number;
  taxaCartao: number;
  outrosPct?: number;
  precoFinal?: number;
}

export interface ResultadoProcedimento {
  custoInsumos: number;
  rateio: number;
  retrabalhoValor: number;
  custoDireto: number;
  precoSugerido: number;
  pontoEquilibrio: number;
  lucratividadeFinal: number;
}

export function custoFixoTotal(despesas: Despesa[]): number {
  return somarDinheiro(despesas.map((d) => d.valor));
}

export function horasEfetivas(capacidade: Capacidade): number {
  const { diasTrabalhados, horasPorDia, unidadesRenda, percentOcupacao } =
    capacidade;
  return diasTrabalhados * horasPorDia * unidadesRenda * percentOcupacao;
}

export function custoFixoPorHora(
  despesas: Despesa[],
  capacidade: Capacidade
): number {
  const horas = horasEfetivas(capacidade);
  if (horas <= 0) return 0;
  return custoFixoTotal(despesas) / horas;
}

export function custoFixoPorMinuto(
  despesas: Despesa[],
  capacidade: Capacidade
): number {
  return custoFixoPorHora(despesas, capacidade) / 60;
}

export function insumoUnitCost(insumo: {
  valorTotal: number;
  quantidade: number;
}): number {
  if (!insumo || !Number.isFinite(insumo.quantidade) || insumo.quantidade <= 0 || !Number.isFinite(insumo.valorTotal) || insumo.valorTotal < 0) throw new PricingError("Revise o material: informe uma quantidade de embalagem acima de zero e um valor válido.");
  return insumo.valorTotal / insumo.quantidade;
}

export function calcProcedimento(
  proc: ProcedimentoInput,
  custoMinuto: number,
  custoUnitarioInsumo: (insumoId: string) => number
): ResultadoProcedimento {
  const amounts = [proc.tempoMinutos, proc.laudos, custoMinuto, ...(proc.precoFinal == null ? [] : [proc.precoFinal])];
  const fractions = [proc.retrabalho, proc.comissao, proc.lucroDesejado, proc.inadimplencia, proc.impostos, proc.taxaCartao, proc.outrosPct ?? 0];
  if (amounts.some((n) => !Number.isFinite(n) || n < 0) || proc.tempoMinutos <= 0) throw new PricingError("Informe duração acima de zero e custos válidos para o procedimento.");
  if (fractions.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) throw new PricingError("Revise os percentuais do procedimento: use valores entre 0% e 100%.");
  const outrosPct = proc.outrosPct || 0;

  const custoInsumos = proc.itens.reduce(
    (soma, item) => {
      const unitCost = custoUnitarioInsumo(item.insumoId);
      if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(item.quantidade) || item.quantidade < 0) throw new PricingError("Revise a quantidade e o custo dos materiais do procedimento.");
      return soma + item.quantidade * unitCost;
    },
    0
  );
  const rateio = proc.tempoMinutos * custoMinuto;
  const retrabalhoValor = (rateio + custoInsumos) * proc.retrabalho;
  const custoDireto = rateio + custoInsumos + retrabalhoValor + proc.laudos;

  const somaPercentComLucro =
    outrosPct +
    proc.comissao +
    proc.lucroDesejado +
    proc.inadimplencia +
    proc.impostos +
    proc.taxaCartao;
  const somaPercentSemLucro =
    outrosPct +
    proc.comissao +
    proc.inadimplencia +
    proc.impostos +
    proc.taxaCartao;

  if (somaPercentComLucro >= 1) throw new PricingError("Lucro, comissão, impostos e demais taxas precisam somar menos de 100%. Revise os percentuais para calcular o preço.");
  const precoSugerido = roundPriceUp(custoDireto / (1 - somaPercentComLucro));
  const pontoEquilibrio = roundPriceUp(custoDireto / (1 - somaPercentSemLucro));

  // Inclui o mesmo retrabalho (materiais + tempo) usado no preço sugerido.
  const precoFinal = proc.precoFinal || 0;
  const lucratividadeFinal =
    precoFinal > 0
      ? (precoFinal -
          precoFinal * somaPercentSemLucro -
          custoDireto) /
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
