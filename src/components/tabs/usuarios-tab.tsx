"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, useAuth, type SessaoUsuario } from "@/lib/auth-store";
import { dataBR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  UserCog, UserPlus, Mail, Shield, Loader2, Trash2, Crown, Briefcase, ClipboardList,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  papel: "dono" | "financeiro" | "recepcao";
  criadoEm?: string;
  ativo: boolean;
}

const PAPEL_INFO: Record<string, { label: string; icon: typeof Crown; desc: string; cor: string }> = {
  dono: {
    label: "Dono(a)",
    icon: Crown,
    desc: "Acesso total. Pode cadastrar a equipe, editar preços, custos e tudo do financeiro.",
    cor: "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
  },
  financeiro: {
    label: "Financeiro",
    icon: Briefcase,
    desc: "Acesso a Custos, Procedimentos, Agenda e Financeiro. Não pode gerenciar usuários.",
    cor: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]",
  },
  recepcao: {
    label: "Recepção",
    icon: ClipboardList,
    desc: "Acesso a Procedimentos (consulta) e Agenda. Sem acesso ao Financeiro.",
    cor: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]",
  },
};

export function UsuariosTab() {
  const usuario = useAuth((s) => s.usuario) as SessaoUsuario;
  const qc = useQueryClient();
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [editar, setEditar] = useState<UsuarioLista | null>(null);

  const usuariosQ = useQuery<UsuarioLista[]>({
    queryKey: ["usuarios"],
    queryFn: () => apiFetch(`/api/usuarios`),
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCog size={20} className="text-[var(--accent-app-text)]" />
            <h1 className="text-xl font-semibold text-[var(--text-app)]">Usuários da clínica</h1>
          </div>
          <p className="text-sm text-[var(--text-app-muted)]">
            Cadastre membros da equipe e escolha o que cada pessoa pode acessar.
          </p>
        </div>
        <Button
          onClick={() => setConvidarOpen(true)}
          disabled={usuario.papel !== "dono"}
          className="bg-[var(--accent-app)] hover:bg-[var(--accent-app-hover)] text-white shrink-0"
        >
          <UserPlus size={16} className="mr-1.5" />
          Adicionar
        </Button>
      </div>

      {/* Papéis explicação */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(PAPEL_INFO).map(([papel, info]) => {
          const Icon = info.icon;
          const count = usuariosQ.data?.filter((u) => u.papel === papel).length ?? 0;
          return (
            <div
              key={papel}
              className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg grid place-items-center ${info.cor}`}>
                  <Icon size={16} />
                </div>
                <span className="text-xs font-mono text-[var(--text-app-muted)]">
                  {count} {count === 1 ? "usuário" : "usuários"}
                </span>
              </div>
              <div className="text-sm font-medium text-[var(--text-app)] mb-1">{info.label}</div>
              <div className="text-[11px] text-[var(--text-app-muted)] leading-relaxed">{info.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Lista de usuários */}
      <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-app)]">
            Membros
            {usuariosQ.data && (
              <span className="ml-1.5 text-xs text-[var(--text-app-muted)]">
                · {usuariosQ.data.length}
              </span>
            )}
          </h2>
        </div>
        {usuariosQ.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-[var(--bg-app-alt-strong)]" />
            ))}
          </div>
        ) : usuariosQ.isError ? (
          <div className="p-4 text-center" role="alert"><p>Não foi possível carregar os usuários.</p><Button variant="outline" className="mt-3" onClick={() => void usuariosQ.refetch()}>Tentar novamente</Button></div>
        ) : usuariosQ.data && usuariosQ.data.length > 0 ? (
          <ul className="divide-y divide-[var(--border-app-subtle)]">
            {usuariosQ.data.map((u) => {
              const info = PAPEL_INFO[u.papel];
              const Icon = info.icon;
              const voce = u.id === usuario.id;
              return (
                <li
                  key={u.id}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 hover:bg-[var(--bg-app-alt-strong)] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--brand-navy)] text-white text-xs font-semibold grid place-items-center shrink-0">
                    {u.nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-app)] truncate">{u.nome}</span>
                      {voce && (
                        <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]">
                          você
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-app-muted)] flex items-center gap-1">
                      <Mail size={11} /> {u.email}
                    </div>
                    {!u.ativo && <p className="text-xs text-[var(--warning-app)] mt-1">Acesso desativado</p>}
                  </div>
                  {u.criadoEm && (
                    <div className="hidden sm:block text-[11px] text-[var(--text-app-faint)]">
                      desde {dataBR(u.criadoEm.slice(0, 10))}
                    </div>
                  )}
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1 ${info.cor}`}>
                    <Icon size={11} />
                    {info.label}
                  </span>
                  {usuario.papel === "dono" && u.papel !== "dono" && !voce && (
                    <Button variant="outline" size="sm" onClick={() => setEditar(u)} aria-label={`Gerenciar acesso de ${u.nome}`}>Gerenciar acesso</Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-[var(--text-app-muted)]">Nenhum usuário além de você.</p>
          </div>
        )}
      </div>

      <ConvidarDialog open={convidarOpen} onOpenChange={setConvidarOpen} />
      {editar && <AcessoDialog key={editar.id} usuario={editar} onClose={() => setEditar(null)} />}
    </div>
  );
}

function AcessoDialog({ usuario, onClose }: { usuario: UsuarioLista; onClose: () => void }) {
  const qc = useQueryClient();
  const [papel, setPapel] = useState(usuario.papel);
  const [ativo, setAtivo] = useState(usuario.ativo);
  const mutation = useMutation({
    mutationFn: () => apiFetch<{ alterado: boolean }>(`/api/usuarios/${encodeURIComponent(usuario.id)}`, { method: "PATCH", body: JSON.stringify({
      ...(papel !== usuario.papel ? { papel } : {}), ...(ativo !== usuario.ativo ? { ativo } : {}),
    }) }),
    onSuccess: (data) => { void qc.invalidateQueries({ queryKey: ["usuarios"] }); toast.success(data.alterado ? "Acesso atualizado. Os acessos anteriores foram encerrados." : "O acesso já estava assim. Nenhuma alteração foi necessária."); onClose(); },
    onError: (error: Error) => toast.error(error.message || "Não foi possível atualizar o acesso."),
  });
  const changed = papel !== usuario.papel || ativo !== usuario.ativo;
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] max-w-md">
      <DialogHeader><DialogTitle>Gerenciar acesso</DialogTitle><DialogDescription>{usuario.nome} · {usuario.email}</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="funcao-usuario">Função</Label>
          <Select value={papel} onValueChange={(value) => setPapel(value as UsuarioLista["papel"])} disabled={mutation.isPending}>
            <SelectTrigger id="funcao-usuario"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="financeiro">Financeiro</SelectItem><SelectItem value="recepcao">Recepção</SelectItem></SelectContent>
          </Select>
          <p className="text-sm text-[var(--text-app-muted)]">{PAPEL_INFO[papel].desc}</p>
        </div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor="acesso-usuario">Permitir acesso ao app</Label><Switch id="acesso-usuario" checked={ativo} onCheckedChange={setAtivo} disabled={mutation.isPending} /></div>
        <p className="text-sm text-[var(--text-app-muted)]">Ao salvar uma alteração, essa pessoa precisará entrar novamente. Desativar impede novos acessos e não apaga seus registros. Reativar não recupera acessos antigos.</p>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button><Button onClick={() => mutation.mutate()} disabled={!changed || mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar alteração"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ConvidarDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"financeiro" | "recepcao">("financeiro");

  const mut = useMutation({
    mutationFn: () =>
      apiFetch("/api/auth/convidar", {
        method: "POST",
        body: JSON.stringify({ nome, email, senha, papel }),
      }),
    onSuccess: () => {
      toast.success(`${nome} foi cadastrado(a) como ${PAPEL_INFO[papel].label}.`);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setNome("");
      setEmail("");
      setSenha("");
      setPapel("financeiro");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao convidar usuário"),
  });

  const senhaValida = senha.length >= 8;
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const podeEnviar = nome.trim().length > 0 && emailValido && senhaValida && !mut.isPending;

  function resetar() {
    setNome("");
    setEmail("");
    setSenha("");
    setPapel("financeiro");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetar();
        onOpenChange(v);
      }}
    >
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-[var(--accent-app-text)]" />
            Cadastrar novo usuário
          </DialogTitle>
          <DialogDescription className="text-[var(--text-app-muted)]">
            Adicione um membro à sua clínica. Este cadastro ainda não envia convite por e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-app-secondary)]">Nome completo</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ana Souza"
              className="bg-[var(--bg-app)] border-[var(--border-app)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-app-secondary)]">E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@clinica.com.br"
              className={`bg-[var(--bg-app)] border-[var(--border-app)] ${
                email && !emailValido ? "border-[var(--danger-app)]" : ""
              }`}
            />
            {email && !emailValido && (
              <p className="text-[11px] text-[var(--danger-app)]">E-mail inválido.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-app-secondary)]">
              Senha de acesso (mín. 8 caracteres)
            </Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Use uma senha forte e exclusiva"
              className={`bg-[var(--bg-app)] border-[var(--border-app)] ${
                senha && !senhaValida ? "border-[var(--danger-app)]" : ""
              }`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-app-secondary)]">Tipo de acesso</Label>
            <Select value={papel} onValueChange={(v: "financeiro" | "recepcao") => setPapel(v)}>
              <SelectTrigger className="bg-[var(--bg-app)] border-[var(--border-app)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
                <SelectItem value="financeiro">
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-[var(--warning-app)]" />
                    <div>
                      <div className="text-sm">Financeiro</div>
                      <div className="text-[10px] text-[var(--text-app-muted)]">
                        Custos, Procedimentos, Financeiro
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="recepcao">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={14} className="text-[var(--text-app-muted)]" />
                    <div>
                      <div className="text-sm">Recepção</div>
                      <div className="text-[10px] text-[var(--text-app-muted)]">
                        Procedimentos (consulta) + Agenda
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!podeEnviar}
            className="bg-[var(--accent-app)] hover:bg-[var(--accent-app-hover)] text-white"
          >
            {mut.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
            Cadastrar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
