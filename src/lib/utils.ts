import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const brl = (n: unknown) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export const pct = (n: unknown) =>
  typeof n === "number" && isFinite(n)
    ? `${(n * 100).toFixed(1)}%`
    : "—";

export const num = (v: unknown): number =>
  v === null || v === undefined || v === "" ? 0 : Number(v);

export const hoje = () => new Date().toISOString().slice(0, 10);
export const mesAtual = () => new Date().toISOString().slice(0, 7);

export const dataBR = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

export const meses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const nomeMes = (iso: string) => {
  const [y, m] = iso.slice(0, 7).split("-");
  if (!y || !m) return iso;
  return `${meses[Number(m) - 1]} ${y}`;
};
