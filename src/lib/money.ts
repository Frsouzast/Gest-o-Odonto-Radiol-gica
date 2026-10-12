// Valores em reais na API; somas executadas em centavos inteiros.
// A migração do armazenamento legado para centavos é uma etapa separada.
export function centavos(value: number | string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Valor monetário inválido.");
  const cents = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Valor monetário fora do limite.");
  return cents;
}

export function somarDinheiro(values: (number | string)[]): number {
  const total = values.reduce<number>((sum, value) => sum + centavos(value), 0);
  if (!Number.isSafeInteger(total)) throw new Error("Soma monetária fora do limite.");
  return total / 100;
}

export type Recebivel = {
  valorFaturado: number | string;
  valorPago?: number | string | null;
  status?: string;
};

export function saldoReceber(conta: Recebivel): number {
  if (conta.status === "cancelado" || conta.status === "recebido") return 0;
  return Math.max(0, centavos(conta.valorFaturado) - centavos(conta.valorPago ?? 0)) / 100;
}

export function valorRecebido(conta: Recebivel): number {
  if (conta.status !== "recebido" && conta.status !== "parcial") return 0;
  return centavos(conta.valorPago ?? (conta.status === "recebido" ? conta.valorFaturado : 0)) / 100;
}
