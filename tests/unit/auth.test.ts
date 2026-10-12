import { describe, expect, test } from "bun:test";
import { authPapel, authRequired, conferirSenha, hashSenha } from "../../src/lib/auth";

const dono = { usuarioId: "usuario-a", clinicaId: "clinica-a", papel: "dono" as const, sessaoId: "sessao-a" };

describe("autenticação", () => {
  test("senha é comparada sem armazenar texto original", async () => {
    const hash = await hashSenha("senha-correta");
    expect(hash).not.toContain("senha-correta");
    expect(await conferirSenha("senha-correta", hash)).toBe(true);
    expect(await conferirSenha("senha-errada", hash)).toBe(false);
  });
  test("Bearer antigo não autentica", async () => {
    expect(await authRequired(new Request("http://localhost:3000/api/usuarios", { headers: { authorization: "Bearer legacy-jwt" } }))).toMatchObject({ status: 401 });
  });
  test("credenciais ausentes não autenticam", async () => {
    expect(await authRequired(new Request("http://localhost:3000/api/usuarios"))).toMatchObject({ status: 401 });
  });
  test("recepção não obtém autorização financeira", () => {
    expect(authPapel("dono", "financeiro")({ ...dono, papel: "recepcao" })).toMatchObject({ ok: false, status: 403 });
    expect(authPapel("dono", "financeiro")(dono)).toMatchObject({ ok: true });
  });
});
