import { describe, expect, test } from "bun:test";
import { centavos, saldoReceber, somarDinheiro, valorRecebido } from "../../src/lib/money";
import { calcularFluxoProjetado } from "../../src/lib/financeiro";

describe("valores e pagamentos parciais", () => {
  test("R$ 0,10 + R$ 0,20 resulta exatamente em R$ 0,30", () => {
    expect(somarDinheiro([0.1, 0.2])).toBe(0.3);
    expect(centavos(1.005)).toBe(101);
  });
  test("R$ 100 faturados e R$ 40 pagos deixam R$ 60 a receber", () => {
    const conta = { valorFaturado: 100, valorPago: 40, status: "parcial" };
    expect(saldoReceber(conta)).toBe(60);
    expect(valorRecebido(conta)).toBe(40);
    expect(calcularFluxoProjetado([conta], [{ valor: 25 }]).saldoProjetado).toBe(35);
  });
  test("contas canceladas ou quitadas não projetam receita futura", () => {
    expect(saldoReceber({ valorFaturado: 100, status: "cancelado" })).toBe(0);
    expect(saldoReceber({ valorFaturado: 100, status: "recebido" })).toBe(0);
    expect(valorRecebido({ valorFaturado: 100, status: "aberto" })).toBe(0);
  });
  test("parcial sem valor pago não vira faturamento integral recebido", () => {
    expect(valorRecebido({ valorFaturado: 100, status: "parcial", valorPago: null })).toBe(0);
  });
  test("números inválidos não contaminam os totais", () => {
    expect(() => centavos(NaN)).toThrow();
    expect(() => centavos(Infinity)).toThrow();
  });
});
