import { expect, test } from "bun:test";
import { canAccessScope } from "../../src/lib/permissions";
import type { Papel } from "../../src/lib/auth";

test("matriz de permissões separa operação, financeiro e gerência da equipe", () => {
  for (const role of ["dono", "financeiro", "recepcao"] as const) {
    expect(canAccessScope(role, "operacional")).toBe(true);
    expect(canAccessScope(role, "financeiro")).toBe(role !== "recepcao");
    expect(canAccessScope(role, "usuarios")).toBe(role === "dono");
  }
  expect(canAccessScope("inventado" as Papel, "operacional")).toBe(false);
});
