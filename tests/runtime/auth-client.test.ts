import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { apiFetch, encerrarSessao, restaurarSessao, useAuth, type SessaoUsuario } from "../../src/lib/auth-store";

const identity: SessaoUsuario = { id: "fake-a", nome: "Fictício", email: "fake@example.test", papel: "dono", clinica: { id: "fake-clinic", nome: "Fictícia" } };
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let fetchMock: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  useAuth.getState().setSessao(identity);
  fetchMock = spyOn(globalThis, "fetch");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "odonto_csrf=" + "c".repeat(43) } });
});
afterEach(() => {
  fetchMock.mockRestore();
  for (const [key, descriptor] of [["document", documentDescriptor], ["localStorage", storageDescriptor]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  useAuth.getState().limpar();
});

test("cliente envia cookie do navegador e CSRF sem credencial Bearer", async () => {
  fetchMock.mockResolvedValue(json({ ok: true }));
  await apiFetch("/api/clinica", { method: "PUT", body: "{}" });
  const options = fetchMock.mock.calls[0][1]!;
  expect(options.credentials).toBe("same-origin");
  expect(options.cache).toBe("no-store");
  expect(new Headers(options.headers).get("x-csrf-token")).toBe("c".repeat(43));
  expect(new Headers(options.headers).has("authorization")).toBe(false);
  expect("token" in useAuth.getState()).toBe(false);
  await expect(apiFetch("https://outside.example/api/test")).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("resposta antiga não entra na nova sessão, mesmo para o mesmo usuário", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockImplementation((() => new Promise<Response>((accept) => { finish = accept; })) as unknown as typeof fetch);
  const pending = apiFetch("/api/clinica");
  useAuth.getState().setSessao(identity);
  finish(json({ nome: "Dado antigo" }));
  await expect(pending).rejects.toThrow("A sessão mudou");
});
test("401 atrasado não apaga usuário novo; 401 da sessão atual limpa identidade", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockImplementation((() => new Promise<Response>((accept) => { finish = accept; })) as unknown as typeof fetch);
  const pending = apiFetch("/api/clinica");
  useAuth.getState().setSessao({ ...identity, id: "fake-b" });
  finish(json({ erro: "Sessão inválida" }, 401));
  await expect(pending).rejects.toThrow();
  expect(useAuth.getState().usuario?.id).toBe("fake-b");
  fetchMock.mockResolvedValue(json({ erro: "Sessão inválida" }, 401));
  await expect(apiFetch("/api/clinica")).rejects.toThrow();
  expect(useAuth.getState().usuario).toBeNull();
});
test("saída com falha não finge sucesso; saída confirmada limpa identidade", async () => {
  fetchMock.mockResolvedValue(json({ erro: "Indisponível" }, 503));
  await expect(encerrarSessao()).rejects.toThrow();
  expect(useAuth.getState().usuario?.id).toBe(identity.id);
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await encerrarSessao();
  expect(useAuth.getState().usuario).toBeNull();
});
test("restauração remove credencial antiga e busca identidade no servidor", async () => {
  const removed: string[] = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { removeItem: (key: string) => removed.push(key) } });
  const { clinica, ...usuario } = identity;
  fetchMock.mockResolvedValue(json({ usuario, clinica }));
  await restaurarSessao();
  expect(removed).toEqual(["precificacao-auth"]);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/me");
  expect(useAuth.getState().usuario).toEqual(identity);
  expect(useAuth.getState().status).toBe("ready");
});
test("falha de rede na restauração mostra erro, não formulário de login", async () => {
  useAuth.setState({ usuario: null, status: "loading" });
  fetchMock.mockRejectedValue(new Error("Network unavailable"));
  await restaurarSessao();
  expect(useAuth.getState().status).toBe("error");
});
