"use client";

import { create } from "zustand";
import { apiErrorMessage } from "./api-error";
export type Papel = "dono" | "financeiro" | "recepcao";
export interface SessaoUsuario { id: string; nome: string; email: string; papel: Papel; clinica: { id: string; nome: string } }
interface AuthState {
  usuario: SessaoUsuario | null;
  status: "loading" | "ready" | "error";
  version: number;
  setSessao: (usuario: SessaoUsuario) => void;
  limpar: () => void;
  podeEditar: () => boolean;
}
export const useAuth = create<AuthState>()((set, get) => ({
  usuario: null, status: "loading", version: 0,
  setSessao: (usuario) => set((state) => ({ usuario, status: "ready", version: state.version + 1 })),
  limpar: () => set((state) => ({ usuario: null, status: "ready", version: state.version + 1 })),
  podeEditar: () => ["dono", "financeiro"].includes(get().usuario?.papel || ""),
}));
export class ApiHttpError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiHttpError"; }
}
function csrfCookie() {
  if (typeof document === "undefined") return "";
  const name = process.env.NODE_ENV === "production" ? "__Host-odonto_csrf" : "odonto_csrf";
  return document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error("Use somente os endereços internos do app.");
  const version = useAuth.getState().version;
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes((opts.method || "GET").toUpperCase())) {
    const csrf = csrfCookie();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const res = await fetch(path, { ...opts, headers, credentials: "same-origin", cache: "no-store" });
  const body = res.headers.get("content-type")?.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth/") && version === useAuth.getState().version) useAuth.getState().limpar();
    throw new ApiHttpError(apiErrorMessage(body, res.status), res.status);
  }
  if (version !== useAuth.getState().version) throw new Error("A sessão mudou. Repita a operação na sessão atual.");
  return res.status === 204 ? undefined as T : body as T;
}
export async function restaurarSessao() {
  try { localStorage.removeItem("precificacao-auth"); } catch {}
  const version = useAuth.getState().version;
  try {
    const data = await apiFetch<{ usuario: Omit<SessaoUsuario, "clinica">; clinica: SessaoUsuario["clinica"] }>("/api/auth/me");
    if (version === useAuth.getState().version) useAuth.getState().setSessao({ ...data.usuario, clinica: data.clinica });
  } catch (error) {
    if (version !== useAuth.getState().version) return;
    if (error instanceof ApiHttpError && error.status === 401) useAuth.getState().limpar();
    else useAuth.setState({ status: "error" });
  }
}
export async function encerrarSessao() {
  const version = useAuth.getState().version;
  try { await apiFetch<void>("/api/auth/logout", { method: "POST" }); }
  catch (error) { if (!(error instanceof ApiHttpError) || error.status !== 401) throw error; }
  if (version === useAuth.getState().version) useAuth.getState().limpar();
}
