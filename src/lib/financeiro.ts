// Cálculos do módulo Financeiro avançado. Funções puras, mesmo padrão do engine.
import { saldoReceber, somarDinheiro, type Recebivel } from "./money";

export interface DREInput {
  receitaBruta: number;
  glosas: number;
  aliquotaImpostos: number;
  custosVariaveis: number;
  despesasFixas: number;
}

export interface DRE {
  receitaBruta: number;
  glosas: number;
  impostos: number;
  receitaLiquida: number;
  custosVariaveis: number;
  margemContribuicao: number;
  despesasFixas: number;
  resultadoOperacional: number;
}

export interface LancamentoRentabilidade {
  chave: string;
  receita: number;
  custo: number;
}

export interface GrupoRentabilidade {
  chave: string;
  receita: number;
  custo: number;
  quantidade: number;
  resultado: number;
  margem: number;
  ticketMedio: number;
}

export interface FluxoProjetado {
  recebimentosPrevistos: number;
  pagamentosPrevistos: number;
  saldoProjetado: number;
}

export interface PorHora {
  receitaPorHora: number;
  lucroPorHora: number;
  horas: number;
}

export interface Conciliacao {
  recebidoSistema: number;
  entradasBanco: number;
  diferencaEntradas: number;
  pagoSistema: number;
  saidasBanco: number;
  diferencaSaidas: number;
}

/**
 * DRE gerencial simplificada (mesma fórmula do app original):
 *   Receita bruta − Glosas − Impostos = Receita líquida
 *   Receita líquida − Custos variáveis = Margem de contribuição
 *   Margem de contribuição − Despesas fixas = Resultado operacional
 */
export function calcularDRE(input: DREInput): DRE {
  const baseImposto = input.receitaBruta - input.glosas;
  const impostos = baseImposto * input.aliquotaImpostos;
  const receitaLiquida = baseImposto - impostos;
  const margemContribuicao = receitaLiquida - input.custosVariaveis;
  const resultadoOperacional = margemContribuicao - input.despesasFixas;
  return {
    receitaBruta: input.receitaBruta,
    glosas: input.glosas,
    impostos,
    receitaLiquida,
    custosVariaveis: input.custosVariaveis,
    margemContribuicao,
    despesasFixas: input.despesasFixas,
    resultadoOperacional,
  };
}

export function agruparRentabilidade(
  lancamentos: LancamentoRentabilidade[]
): GrupoRentabilidade[] {
  const grupos = new Map<string, GrupoRentabilidade>();
  for (const l of lancamentos) {
    const atual = grupos.get(l.chave) || {
      chave: l.chave,
      receita: 0,
      custo: 0,
      quantidade: 0,
    } as GrupoRentabilidade;
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

export function calcularFluxoProjetado(
  contasReceberAbertas: Recebivel[],
  contasPagarAbertas: { valor: number | string }[]
): FluxoProjetado {
  const recebimentosPrevistos = somarDinheiro(contasReceberAbertas.map(saldoReceber));
  const pagamentosPrevistos = somarDinheiro(contasPagarAbertas.map((c) => c.valor));
  return {
    recebimentosPrevistos,
    pagamentosPrevistos,
    saldoProjetado: somarDinheiro([recebimentosPrevistos, -pagamentosPrevistos]),
  };
}

export function calcularPorHora(
  receitaTotal: number,
  custoTotal: number,
  minutosTotais: number
): PorHora {
  const horas = minutosTotais / 60;
  if (horas <= 0) return { receitaPorHora: 0, lucroPorHora: 0, horas: 0 };
  return {
    receitaPorHora: receitaTotal / horas,
    lucroPorHora: (receitaTotal - custoTotal) / horas,
    horas,
  };
}

export function calcularConciliacao(input: {
  recebidoSistema: number;
  pagoSistema: number;
  entradasBanco: number;
  saidasBanco: number;
}): Conciliacao {
  return {
    recebidoSistema: input.recebidoSistema,
    entradasBanco: input.entradasBanco,
    diferencaEntradas: input.entradasBanco - input.recebidoSistema,
    pagoSistema: input.pagoSistema,
    saidasBanco: input.saidasBanco,
    diferencaSaidas: input.saidasBanco - input.pagoSistema,
  };
}
