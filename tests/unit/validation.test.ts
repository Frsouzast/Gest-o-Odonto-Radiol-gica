import { describe, expect, test } from "bun:test";
import { agendaQuerySchema, agendamentoSchema, agendamentoUpdateSchema, appointmentTime, capacidadeSchema, contaPagarSchema, contaReceberUpdateSchema, dateISO, inviteSchema, pricingPercentagesSchema, procedimentoSchema, procedimentoUpdateSchema, registerSchema, readBody, remarcarSchema } from "../../src/lib/validation";

describe("validação de dados", () => {
  test("rejeita datas inexistentes, aceita ano bissexto", () => {
    expect(dateISO.safeParse("2026-02-30").success).toBe(false);
    expect(dateISO.safeParse("2026-02-29").success).toBe(false);
    expect(dateISO.safeParse("2024-02-29").success).toBe(true);
  });
  test("não cadastra despesa negativa ou sem descrição", () => {
    expect(contaPagarSchema.safeParse({ descricao: "  ", valor: -10, vencimento: "2026-10-11" }).success).toBe(false);
  });
  test("rejeita status inventado, valor negativo e atualização vazia", () => {
    for (const body of [{ status: "inventado" }, { valorPago: -1 }, {}]) {
      expect(contaReceberUpdateSchema.safeParse(body).success).toBe(false);
    }
  });
  test("normaliza espaços dos nomes e e-mail", () => {
    const parsed = registerSchema.parse({ clinicaNome: " Clínica A ", usuarioNome: " Nome ", email: "NOME@EXAMPLE.COM", senha: "senha-forte" });
    expect(parsed.clinicaNome).toBe("Clínica A");
    expect(parsed.email).toBe("nome@example.com");
  });
  test("convite exige senha forte e não permite outro dono", () => {
    expect(inviteSchema.safeParse({ nome: "Nome", email: "nome@example.com", senha: "123", papel: "financeiro" }).success).toBe(false);
    expect(inviteSchema.safeParse({ nome: "Nome", email: "nome@example.com", senha: "senha-forte", papel: "dono" }).success).toBe(false);
  });
  test("JSON inválido recebe 400, não erro interno", async () => {
    const result = await readBody(new Request("http://localhost", { method: "POST", body: "{invalido" }), contaPagarSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
  test("corpo grande é recusado mesmo sem Content-Length ou com cabeçalho falso", async () => {
    const payload = JSON.stringify({ descricao: "á".repeat(9_000), valor: 10, vencimento: "2026-10-11" });
    for (const headers of [new Headers(), new Headers({ "content-length": "1" }), new Headers({ "content-length": "999999" })]) {
      const response = await readBody(new Request("http://localhost", { method: "POST", headers, body: payload }), contaPagarSchema);
      expect(response.ok).toBe(false);
      if (!response.ok) expect(response.response.status).toBe(413);
    }
  });
  test("corpo JSON pequeno continua válido após leitura limitada", async () => {
    const response = await readBody(new Request("http://localhost", { method: "POST", body: JSON.stringify({ descricao: "Despesa", valor: 10, vencimento: "2026-10-11" }) }), contaPagarSchema);
    expect(response.ok).toBe(true);
  });
  test("agenda exige nome, data real e opções booleanas", () => {
    const valid = { nome: " Paciente ", data: "2026-10-11", plano: false, particular: true };
    expect(agendamentoSchema.parse(valid).nome).toBe("Paciente");
    for (const invalid of [{ nome: " " }, { data: "2026-02-30" }, { plano: "false" }, { particular: 1 }]) {
      expect(agendamentoSchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
    }
  });
  test("horário aceita limites reais e normaliza ausência", () => {
    for (const valid of ["00:00", "23:59", "12:30"]) expect(appointmentTime.parse(valid)).toBe(valid);
    expect(appointmentTime.parse("")).toBeNull();
    expect(appointmentTime.parse(null)).toBeNull();
    for (const invalid of ["24:00", "12:60", "9:00", "abc"]) expect(appointmentTime.safeParse(invalid).success).toBe(false);
  });
  test("alteração de agenda não aceita estado inventado ou corpo vazio", () => {
    for (const invalid of [{}, { desconhecido: true }, { status: "inventado" }, { nome: " " }, { plano: "false" }]) {
      expect(agendamentoUpdateSchema.safeParse(invalid).success).toBe(false);
    }
    expect(agendamentoUpdateSchema.parse({ status: "atendido", hora: "" })).toEqual({ status: "atendido", hora: null });
    expect(remarcarSchema.safeParse({ novaData: "2026-02-30" }).success).toBe(false);
    expect(remarcarSchema.parse({ novaData: "2026-10-12", novaHora: null }).novaHora).toBeNull();
  });
  test("consulta de agenda exige apenas um filtro e período ordenado", () => {
    expect(agendaQuerySchema.safeParse({ data: "2026-10-11" }).success).toBe(true);
    expect(agendaQuerySchema.safeParse({ periodoInicio: "2026-10-01", periodoFim: "2026-10-31" }).success).toBe(true);
    for (const invalid of [{}, { data: "2026-02-30" }, { periodoInicio: "2026-10-01" },
      { periodoInicio: "2026-10-31", periodoFim: "2026-10-01" },
      { data: "2026-10-11", periodoInicio: "2026-10-01", periodoFim: "2026-10-31" }]) {
      expect(agendaQuerySchema.safeParse(invalid).success).toBe(false);
    }
  });
  test("capacidade aceita ocupação zero e rejeita números impossíveis", () => {
    const valid = { diasTrabalhados: 20, horasPorDia: 8, unidadesRenda: 1, percentOcupacao: 0 };
    expect(capacidadeSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [{ diasTrabalhados: 32 }, { diasTrabalhados: 1.5 }, { horasPorDia: 25 },
      { unidadesRenda: 0 }, { unidadesRenda: 1.5 }, { percentOcupacao: -0.01 }, { percentOcupacao: 1.01 }, { horasPorDia: Infinity }]) {
      expect(capacidadeSchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
    }
  });
  test("procedimentos mantêm defaults e rejeitam custo e tempo negativos", () => {
    expect(procedimentoSchema.parse({ nome: " Exame " })).toEqual({ nome: "Exame", tempoMinutos: 0, laudos: 0, retrabalhoPct: 0.03 });
    for (const invalid of [{ tempoMinutos: -1 }, { laudos: -10 }, { retrabalhoPct: 1.1 }, { tempoMinutos: Infinity }]) {
      expect(procedimentoSchema.safeParse({ nome: "Exame", ...invalid }).success).toBe(false);
    }
    for (const invalid of [{}, { impostosPct: -0.1 }, { precoConcorrencia: -1 }, { nome: " " }]) {
      expect(procedimentoUpdateSchema.safeParse(invalid).success).toBe(false);
    }
  });
  test("precificação rejeita soma igual ou superior a 100%, sem contar retrabalho", () => {
    expect(pricingPercentagesSchema.safeParse({ comissaoPct: 0.4, lucroDesejadoPct: 0.6 }).success).toBe(false);
    expect(pricingPercentagesSchema.safeParse({ impostosPct: 0.6, lucroDesejadoPct: 0.5 }).success).toBe(false);
    expect(pricingPercentagesSchema.safeParse({ comissaoPct: 0.1, lucroDesejadoPct: 0.3, retrabalhoPct: 0.9 }).success).toBe(true);
  });
});
