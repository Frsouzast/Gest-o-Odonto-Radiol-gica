import type { Papel } from "./auth";

export type AccessScope = "financeiro" | "operacional" | "usuarios";
export function canAccessScope(papel: Papel, scope: AccessScope): boolean {
  if (!["dono", "financeiro", "recepcao"].includes(papel)) return false;
  if (scope === "usuarios") return papel === "dono";
  if (scope === "financeiro") return papel === "dono" || papel === "financeiro";
  return scope === "operacional";
}
