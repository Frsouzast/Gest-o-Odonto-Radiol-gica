import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import { hashSenha } from "../../src/lib/auth";
import { sessionHash } from "../../src/lib/server-sessions";

// Esta suíte testa contratos HTTP e as condições de acesso enviadas ao banco.
// O banco é substituído antes dos imports: nenhum dado real é lido ou alterado.
const db = {
  $transaction: mock(async (work: (tx: unknown) => Promise<unknown>) => work(db)),
  sessao: {
    findUnique: mock(async (args: { where: { tokenHash: string } }) => ({ id: "sessao-a", revogadaEm: null, expiraEm: new Date("2099-01-01"), csrfHash: sessionHash("c".repeat(43)),
      usuario: { id: "usuario-a", clinicaId: "clinica-a", papel: args.where.tokenHash === sessionHash("r".repeat(43)) ? "recepcao" : "dono", nome: "Nome", email: "fake@example.com", clinica: { id: "clinica-a", nome: "Clínica A" } } })),
    create: mock(async (_args: unknown) => ({ id: "new-session" })),
  },
  usuario: { findUnique: mock(async (_args: unknown) => null as null | {
    id: string; nome: string; email: string; papel: string; clinicaId: string; senhaHash: string; acesso?: { ativo: boolean }; clinica: { id: string; nome: string };
  }) },
  glosa: { findFirst: mock(async (_args: unknown) => null as null | { id: string }), update: mock(async () => ({})) },
  convenio: { findFirst: mock(async (_args: unknown) => null as null | { id: string }), findMany: mock(async (_args: unknown) => []) },
  convenioTabelaPreco: { findMany: mock(async (_args: unknown) => []), create: mock(async () => ({})) },
  procedimento: {
    findFirst: mock(async (_args: unknown) => null as null | { id: string; impostosPct?: number; lucroDesejadoPct?: number }),
    create: mock(async (_args: unknown) => ({})), update: mock(async (_args: unknown) => ({})),
    findMany: mock(async (_args: unknown) => []),
  },
  insumo: { findFirst: mock(async (_args: unknown) => null as null | { id: string }) },
  procedimentoInsumo: { findMany: mock(async (_args: unknown) => []), upsert: mock(async () => ({})), deleteMany: mock(async (_args: unknown) => ({ count: 0 })) },
  contaReceber: { create: mock(async () => ({})), findMany: mock(async (_args: unknown) => []) },
  agendamento: {
    findFirst: mock(async (_args: unknown) => null as null | { id: string }),
    findMany: mock(async (_args: unknown) => []),
    create: mock(async (_args: unknown) => ({})),
    update: mock(async (_args: unknown) => ({})),
  },
  capacidadeProdutiva: { upsert: mock(async (_args: unknown) => ({})) },
};
mock.module("../../src/lib/db", () => ({ db }));
const glosas = await import("../../src/app/api/glosas/[id]/route");
const precos = await import("../../src/app/api/convenios/[id]/precos/route");
const itens = await import("../../src/app/api/procedimentos/[id]/itens/route");
const excluirItem = await import("../../src/app/api/procedimentos/[id]/itens/[insumoId]/route");
const receber = await import("../../src/app/api/contas-receber/route");
const agenda = await import("../../src/app/api/agendamentos/route");
const agendaItem = await import("../../src/app/api/agendamentos/[id]/route");
const remarcar = await import("../../src/app/api/agendamentos/[id]/remarcar/route");
const capacidade = await import("../../src/app/api/capacidade/route");
const procedimentos = await import("../../src/app/api/procedimentos/route");
const procedimentoItem = await import("../../src/app/api/procedimentos/[id]/route");
const login = await import("../../src/app/api/auth/login/route");
const busca = await import("../../src/app/api/busca/route");

function request(method: string, body?: unknown, papel: "dono" | "recepcao" = "dono") {
  return new NextRequest("http://localhost:3000/api/test", { method, headers: {
    "content-type": "application/json",
    origin: "http://localhost:3000", "x-csrf-token": "c".repeat(43),
    cookie: `odonto_session=${(papel === "recepcao" ? "r" : "d").repeat(43)}`,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const params = { params: Promise.resolve({ id: "id-de-outra-clinica" }) };
beforeEach(() => { mock.clearAllMocks(); });

describe("isolamento dos contratos HTTP", () => {
  test("consulta da recepção pede somente campos de atendimento ao banco", async () => {
    const response = await procedimentos.GET(request("GET", undefined, "recepcao"));
    expect(response.status).toBe(200);
    expect(db.procedimento.findMany).toHaveBeenCalledWith({ where: { clinicaId: "clinica-a", ativo: true }, orderBy: { nome: "asc" },
      select: { id: true, nome: true, tempoMinutos: true, precoFinal: true } });
  });
  test("busca da recepção não consulta convênios nem contas financeiras", async () => {
    const req = request("GET", undefined, "recepcao");
    const response = await busca.GET(new NextRequest("http://localhost:3000/api/busca?q=ficticio", { headers: req.headers }));
    expect(response.status).toBe(200);
    expect(db.convenio.findMany).not.toHaveBeenCalled();
    expect(db.contaReceber.findMany).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ convenios: [], contasReceber: [] });
  });
  test("glosa procura clínica pela conta e não atualiza registro alheio", async () => {
    const response = await glosas.PUT(request("PUT", { status: "perdida" }), params);
    expect(response.status).toBe(404);
    expect(db.glosa.findFirst).toHaveBeenCalledWith({ where: {
      id: "id-de-outra-clinica", contaReceber: { clinicaId: "clinica-a" },
    }, select: { id: true } });
    expect(db.glosa.update).not.toHaveBeenCalled();
  });
  test("preços e insumos não listam dados de outra clínica", async () => {
    await precos.GET(request("GET"), params);
    await itens.GET(request("GET"), params);
    expect(db.convenioTabelaPreco.findMany.mock.calls[0][0]).toMatchObject({ where: { convenio: { clinicaId: "clinica-a" } } });
    expect(db.procedimentoInsumo.findMany.mock.calls[0][0]).toMatchObject({ where: { procedimento: { clinicaId: "clinica-a" } } });
  });
  test("inserção de insumo alheio não executa upsert", async () => {
    const response = await itens.POST(request("POST", { insumoId: "insumo-alheio", quantidade: 1 }), params);
    expect(response.status).toBe(404);
    expect(db.insumo.findFirst).toHaveBeenCalledWith({ where: { id: "insumo-alheio", clinicaId: "clinica-a" }, select: { id: true } });
    expect(db.procedimentoInsumo.upsert).not.toHaveBeenCalled();
  });
  test("insumo e procedimento da própria clínica podem ser vinculados", async () => {
    db.procedimento.findFirst.mockResolvedValueOnce({ id: "proc-a" });
    db.insumo.findFirst.mockResolvedValueOnce({ id: "insumo-a" });
    const response = await itens.POST(request("POST", { insumoId: "insumo-a", quantidade: 2 }), { params: Promise.resolve({ id: "proc-a" }) });
    expect(response.status).toBe(201);
    expect(db.procedimentoInsumo.upsert).toHaveBeenCalledWith({
      where: { procedimentoId_insumoId: { procedimentoId: "proc-a", insumoId: "insumo-a" } },
      create: { procedimentoId: "proc-a", insumoId: "insumo-a", quantidade: 2 }, update: { quantidade: 2 },
    });
  });
  test("exclusão exige procedimento e insumo da mesma clínica", async () => {
    await excluirItem.DELETE(request("DELETE"), { params: Promise.resolve({ id: "proc", insumoId: "insumo" }) });
    expect(db.procedimentoInsumo.deleteMany).toHaveBeenCalledWith({ where: {
      procedimentoId: "proc", insumoId: "insumo", procedimento: { clinicaId: "clinica-a" }, insumo: { clinicaId: "clinica-a" },
    } });
  });
  test("preço de convênio alheio não pode ser criado", async () => {
    const response = await precos.POST(request("POST", { procedimentoId: "proc", valor: 10 }), params);
    expect(response.status).toBe(404);
    expect(db.convenioTabelaPreco.create).not.toHaveBeenCalled();
  });
  test("recepção não altera preços ou glosas", async () => {
    expect((await precos.POST(request("POST", { procedimentoId: "proc", valor: 10 }, "recepcao"), params)).status).toBe(403);
    expect((await glosas.PUT(request("PUT", { status: "perdida" }, "recepcao"), params)).status).toBe(403);
  });
  test("lançamento financeiro rejeita referência de outra clínica", async () => {
    const response = await receber.POST(request("POST", { dataExame: "2026-10-11", procedimentoId: "proc-alheio", valorFaturado: 10 }));
    expect(response.status).toBe(404);
    expect(db.contaReceber.create).not.toHaveBeenCalled();
  });
  test("agenda rejeita booleano textual e remarcação com data inválida antes de gravar", async () => {
    expect((await agenda.POST(request("POST", { nome: "Paciente", data: "2026-10-11", plano: "false" }))).status).toBe(400);
    expect((await remarcar.PUT(request("PUT", { novaData: "2026-02-30" }), params)).status).toBe(400);
    expect(db.agendamento.create).not.toHaveBeenCalled();
    expect(db.agendamento.update).not.toHaveBeenCalled();
  });
  test("agenda cria com clínica da sessão e aceita horário ausente", async () => {
    expect((await agenda.POST(request("POST", { nome: " Paciente ", data: "2026-10-11", plano: false, hora: "" }, "recepcao"))).status).toBe(201);
    expect(db.agendamento.create.mock.calls[0][0]).toMatchObject({ data: {
      nome: "Paciente", clinicaId: "clinica-a", plano: false, particular: false, hora: null,
    } });
  });
  test("agenda não altera agendamento de outra clínica", async () => {
    expect((await agendaItem.PUT(request("PUT", { status: "atendido" }), params)).status).toBe(404);
    expect(db.agendamento.findFirst).toHaveBeenCalledWith({ where: { id: "id-de-outra-clinica", clinicaId: "clinica-a" } });
    expect(db.agendamento.update).not.toHaveBeenCalled();
  });
  test("agenda consulta por clínica e rejeita intervalo invertido", async () => {
    const req = request("GET");
    req.nextUrl.searchParams.set("data", "2026-10-11");
    expect((await agenda.GET(req)).status).toBe(200);
    expect(db.agendamento.findMany.mock.calls[0][0]).toMatchObject({ where: { clinicaId: "clinica-a", data: "2026-10-11" } });
    req.nextUrl.searchParams.delete("data");
    req.nextUrl.searchParams.set("periodoInicio", "2026-10-31");
    req.nextUrl.searchParams.set("periodoFim", "2026-10-01");
    expect((await agenda.GET(req)).status).toBe(400);
    expect(db.agendamento.findMany).toHaveBeenCalledTimes(1);
  });
  test("capacidade rejeita excesso e bloqueia recepção", async () => {
    const body = { diasTrabalhados: 32, horasPorDia: 8, unidadesRenda: 1, percentOcupacao: 0.75 };
    expect((await capacidade.PUT(request("PUT", body))).status).toBe(400);
    expect((await capacidade.PUT(request("PUT", { ...body, diasTrabalhados: 20 }, "recepcao"))).status).toBe(403);
    expect(db.capacidadeProdutiva.upsert).not.toHaveBeenCalled();
  });
  test("procedimento rejeita custo negativo antes de cadastrar", async () => {
    expect((await procedimentos.POST(request("POST", { nome: "Exame", laudos: -1 }))).status).toBe(400);
    expect(db.procedimento.create).not.toHaveBeenCalled();
  });
  test("percentuais novos são conferidos junto com os já salvos", async () => {
    db.procedimento.findFirst.mockResolvedValueOnce({ id: "proc-a", impostosPct: 0.6, lucroDesejadoPct: 0.2 });
    expect((await procedimentoItem.PUT(request("PUT", { lucroDesejadoPct: 0.5 }), params)).status).toBe(400);
    expect(db.procedimento.update).not.toHaveBeenCalled();
  });
  test("alteração válida de procedimento preserva filtro por clínica", async () => {
    db.procedimento.findFirst.mockResolvedValueOnce({ id: "proc-a", impostosPct: 0.1, lucroDesejadoPct: 0.2 });
    expect((await procedimentoItem.PUT(request("PUT", { lucroDesejadoPct: 0.3 }), params)).status).toBe(200);
    expect(db.procedimento.update.mock.calls[0][0]).toMatchObject({ where: { id: "id-de-outra-clinica", clinicaId: "clinica-a" }, data: { lucroDesejadoPct: 0.3 } });
  });
  test("login válido cria cookie HttpOnly e não retorna credencial no JSON", async () => {
    const user = { id: "usuario-a", nome: "Nome", email: "valid@example.com", papel: "dono",
      clinicaId: "clinica-a", senhaHash: await hashSenha("senha-correta"), clinica: { id: "clinica-a", nome: "Clínica A" } };
    db.usuario.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(user);
    const response = await login.POST(request("POST", { email: "valid@example.com", senha: "senha-correta" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBeUndefined();
    expect(response.cookies.get("odonto_session")?.httpOnly).toBe(true);
    expect(db.sessao.create).toHaveBeenCalled();
  });
  test("desativação durante comparação de senha impede criação da sessão", async () => {
    const user = { id: "usuario-a", nome: "Nome", email: "race@example.com", papel: "recepcao",
      clinicaId: "clinica-a", senhaHash: await hashSenha("senha-correta"), clinica: { id: "clinica-a", nome: "Clínica A" } };
    db.usuario.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, acesso: { ativo: false } });
    expect((await login.POST(request("POST", { email: user.email, senha: "senha-correta" }))).status).toBe(401);
    expect(db.sessao.create).not.toHaveBeenCalled();
  });
  test("troca de senha durante login impede uso do hash antigo", async () => {
    const user = { id: "usuario-a", nome: "Nome", email: "password-race@example.com", papel: "recepcao",
      clinicaId: "clinica-a", senhaHash: await hashSenha("senha-correta"), clinica: { id: "clinica-a", nome: "Clínica A" } };
    db.usuario.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, senhaHash: "changed-hash" });
    expect((await login.POST(request("POST", { email: user.email, senha: "senha-correta" }))).status).toBe(401);
    expect(db.sessao.create).not.toHaveBeenCalled();
  });
  test("tentativas de login param antes de consultar o banco após o limite", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await login.POST(request("POST", { email: "limited@example.com", senha: "senha-errada" }))).status).toBe(401);
    }
    const response = await login.POST(request("POST", { email: "LIMITED@example.com", senha: "senha-errada" }));
    expect(response.status).toBe(429);
    expect(db.usuario.findUnique).toHaveBeenCalledTimes(10);
    expect(response.headers.get("Retry-After")).not.toBeNull();
  });
});
