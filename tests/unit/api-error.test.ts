import { describe, expect, test } from "bun:test";
import { apiErrorMessage } from "../../src/lib/api-error";

describe("mensagens de erro para o usuário", () => {
  test("mostra orientação dos campos, sem repetir a mesma mensagem", () => {
    expect(apiErrorMessage({ erro: "Confira os campos informados.", campos: [
      { mensagem: "Use uma data válida." }, { mensagem: "Use uma data válida." }, { mensagem: "Preencha este campo." },
    ] }, 400)).toBe("Confira os campos informados. Use uma data válida. Preencha este campo.");
  });
  test("resposta inesperada tem fallback e não transforma objeto em mensagem", () => {
    expect(apiErrorMessage(null, 500)).toBe("Erro 500");
    expect(apiErrorMessage({ erro: { segredo: true }, campos: [{ mensagem: {} }] }, 400)).toBe("Erro 400");
    expect(apiErrorMessage({ erro: "Não autorizado." }, 401)).toBe("Não autorizado.");
  });
});
