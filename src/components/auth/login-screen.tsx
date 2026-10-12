"use client";

import { useState, useSyncExternalStore } from "react";
import { useAuth, apiFetch } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, Activity } from "lucide-react";
import { FluxXMark } from "@/components/app/flux-x-mark";
import { toast } from "sonner";

interface LoginResp {
  usuario: {
    id: string;
    nome: string;
    email: string;
    papel: "dono" | "financeiro" | "recepcao";
  };
  clinica: { id: string; nome: string };
}

function subscribeEmail(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readRememberedEmail() {
  try { return localStorage.getItem("ultimoEmail") || ""; }
  catch { return ""; }
}

export function LoginScreen() {
  const setSessao = useAuth((s) => s.setSessao);

  // ---- login state ----
  const rememberedEmail = useSyncExternalStore(subscribeEmail, readRememberedEmail, () => "");
  const [editedEmail, setLoginEmail] = useState<string | null>(null);
  const loginEmail = editedEmail ?? rememberedEmail;
  const [loginSenha, setLoginSenha] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ---- registro state ----
  const [regClinica, setRegClinica] = useState("");
  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const data = await apiFetch<LoginResp>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, senha: loginSenha }),
      });
      try {
        localStorage.setItem("ultimoEmail", loginEmail);
      } catch {}
      setSessao({ ...data.usuario, clinica: data.clinica });
      toast.success(`Bem-vindo, ${data.usuario.nome}!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoginLoading(false);
    }
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (regSenha.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setRegLoading(true);
    try {
      const data = await apiFetch<LoginResp>("/api/auth/registrar", {
        method: "POST",
        body: JSON.stringify({
          clinicaNome: regClinica,
          usuarioNome: regNome,
          email: regEmail,
          senha: regSenha,
        }),
      });
      try {
        localStorage.setItem("ultimoEmail", regEmail);
      } catch {}
      setSessao({ ...data.usuario, clinica: data.clinica });
      toast.success(`Conta criada! Bem-vindo, ${data.usuario.nome}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="flex-1 min-h-screen bg-[var(--bg-app)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.9fr)]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[var(--brand-navy)] px-12 py-10 text-white xl:px-20">
        <div className="absolute -right-36 -top-20 h-[34rem] w-[34rem] opacity-[0.12]" aria-hidden="true">
          <FluxXMark className="h-full w-full" monochrome />
        </div>
        <div className="relative flex items-center gap-3">
          <FluxXMark className="h-12 w-12" onDark />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Flux-X Odonto
            </h1>
            <p className="text-xs text-white/65">
              Gestão para radiologia odontológica
            </p>
          </div>
        </div>

        <div className="relative max-w-xl pb-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#70ded0]">Mais clareza no seu fluxo</p>
          <p className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">A rotina da clínica, organizada em um só lugar.</p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">Agenda, custos e financeiro conectados para ajudar sua equipe a acompanhar o dia com confiança.</p>
          <div className="mt-10 grid gap-3 text-sm text-white/80">
            <div className="flex items-center gap-3"><Activity size={17} className="text-[#70ded0]" /> Visão simples da operação</div>
            <div className="flex items-center gap-3"><ShieldCheck size={17} className="text-[#70ded0]" /> Acessos separados por função</div>
          </div>
        </div>
        <p className="relative text-xs text-white/45">Flux-X Odonto · Gestão clínica</p>
      </aside>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
          <FluxXMark className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-app)]">Flux-X Odonto</h1>
            <p className="text-xs text-[var(--text-app-muted)]">Gestão para radiologia odontológica</p>
          </div>
        </div>

        <Card className="border-[var(--border-app)] bg-[var(--surface-app)] shadow-[0_24px_70px_-36px_rgba(18,59,98,0.28)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[var(--text-app)] text-lg">
              Acessar
            </CardTitle>
            <CardDescription className="text-[var(--text-app-muted)]">
              Entre com seu e-mail e senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 mb-4 bg-[var(--bg-app-alt-strong)]">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="registro">Nova clínica</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={entrar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[var(--text-app-secondary)] text-xs">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="senha" className="text-[var(--text-app-secondary)] text-xs">
                      Senha
                    </Label>
                    <Input
                      id="senha"
                      type="password"
                      autoComplete="current-password"
                      value={loginSenha}
                      onChange={(e) => setLoginSenha(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-[var(--accent-app)] hover:bg-[var(--accent-app-hover)] text-white"
                  >
                    {loginLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="registro">
                <p className="text-sm text-[var(--text-app-muted)] mb-4">Este cadastro cria uma clínica nova e seu dono. Para entrar como Financeiro ou Recepção em uma clínica existente, peça ao dono para cadastrar seu acesso em Usuários → Adicionar. Depois, use a opção Entrar.</p>
                <form onSubmit={registrar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      Nome da clínica
                    </Label>
                    <Input
                      value={regClinica}
                      onChange={(e) => setRegClinica(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      Seu nome
                    </Label>
                    <Input
                      value={regNome}
                      onChange={(e) => setRegNome(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      E-mail
                    </Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--text-app-secondary)] text-xs">
                      Senha (mínimo 8 caracteres)
                    </Label>
                    <Input
                      type="password"
                      value={regSenha}
                      onChange={(e) => setRegSenha(e.target.value)}
                      required
                      minLength={8}
                      className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={regLoading}
                    className="w-full bg-[var(--accent-app)] hover:bg-[var(--accent-app-hover)] text-white"
                  >
                    {regLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                    Criar conta (você será o dono)
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-[11px] text-[var(--text-app-faint)] text-center mt-4">
          Os dados da clínica são armazenados no servidor e acessados pela sua equipe autorizada.
        </p>
      </div>
      </section>
    </div>
  );
}
