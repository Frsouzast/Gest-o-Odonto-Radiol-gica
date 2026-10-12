"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarClock,
  Clock,
  Phone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Inbox,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch, useAuth } from "@/lib/auth-store";
import { cn, dataBR } from "@/lib/utils";
import { onNovoItem } from "@/lib/atalhos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip as UITooltip,
  TooltipTrigger as UITooltipTrigger,
  TooltipContent as UITooltipContent,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types — mirror T2-d API contract
// ---------------------------------------------------------------------------
type StatusAgendamento =
  | "aguardando"
  | "atendido"
  | "faltou"
  | "desmarcou"
  | "remarcado";

interface Agendamento {
  id: string;
  clinicaId: string;
  nome: string;
  telefone: string | null;
  exame: string | null;
  plano: boolean;
  particular: boolean;
  data: string;
  hora: string | null;
  status: StatusAgendamento;
  remarcadoParaId: string | null;
  remarcadoParaData: string | null;
  remarcadoParaHora: string | null;
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// Status config (matches original App.jsx + task spec, ported to *-app vars)
// ---------------------------------------------------------------------------
const STATUS_AGENDAMENTO: Record<
  StatusAgendamento,
  { label: string; badge: string; descricao: string }
> = {
  aguardando: {
    label: "Aguardando chegar",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]",
    descricao: "Paciente agendado, ainda não compareceu à clínica.",
  },
  atendido: {
    label: "Atendido",
    badge:
      "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
    descricao: "Paciente compareceu e foi atendido.",
  },
  faltou: {
    label: "Faltou",
    badge: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]",
    descricao: "Paciente não compareceu sem aviso prévio.",
  },
  desmarcou: {
    label: "Desmarcou",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]",
    descricao: "Paciente cancelou o agendamento sem remarcar.",
  },
  remarcado: {
    label: "Remarcado",
    badge: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]",
    descricao: "Agendamento remarcado para outra data. Clique em \"ver remarcação\" para ir ao novo dia.",
  },
};

const STATUS_ORDER: StatusAgendamento[] = [
  "aguardando",
  "atendido",
  "faltou",
  "desmarcou",
  "remarcado",
];

// ---------------------------------------------------------------------------
// Shared style helpers (mirror T3-b / T3-c)
// ---------------------------------------------------------------------------
const inputCls =
  "bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] placeholder:text-[var(--text-app-faint)] focus-visible:border-[var(--accent-app)] focus-visible:ring-[var(--accent-app)]/25";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function diaOffset(iso: string, delta: number): string {
  // Use midday to avoid DST-shift edge cases when adding/subtracting days.
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatarDataLonga(iso: string): string {
  // "Sexta-feira, 26/09/2025"
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// Calcula o intervalo (início, fim) e o label de navegação conforme o modo.
// - dia: início=fim=dataSelecionada; label = data longa (Sexta, 26/09/2025)
// - semana: segunda a domingo da semana da dataSelecionada; label = "25/09 – 01/10"
// - mes: primeiro ao último dia do mês; label = "Setembro 2025"
function calcularPeriodo(
  modo: "dia" | "semana" | "mes",
  dataSelecionada: string,
): {
  periodoInicio: string | null;
  periodoFim: string | null;
  navegacaoLabel: string;
} {
  const d = new Date(`${dataSelecionada}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { periodoInicio: null, periodoFim: null, navegacaoLabel: dataSelecionada };
  }

  if (modo === "dia") {
    return {
      periodoInicio: dataSelecionada,
      periodoFim: dataSelecionada,
      navegacaoLabel: formatarDataLonga(dataSelecionada),
    };
  }

  if (modo === "semana") {
    // Domingo = 0, Segunda = 1, ... Sábado = 6
    // Considera semana começando na segunda-feira (padrão BR)
    const diaSemana = d.getDay();
    const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segunda = new Date(d);
    segunda.setDate(d.getDate() + diffSegunda);
    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);
    const fmt = (x: Date) => x.toISOString().slice(0, 10);
    const fmtCurto = (x: Date) =>
      new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(x);
    return {
      periodoInicio: fmt(segunda),
      periodoFim: fmt(domingo),
      navegacaoLabel: `${fmtCurto(segunda)} – ${fmtCurto(domingo)}`,
    };
  }

  // mes
  const primeiro = new Date(d.getFullYear(), d.getMonth(), 1);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  const fmtMes = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(d);
  return {
    periodoInicio: fmt(primeiro),
    periodoFim: fmt(ultimo),
    navegacaoLabel: fmtMes.charAt(0).toUpperCase() + fmtMes.slice(1),
  };
}

// Helper para invalidar a query correta de agendamentos conforme o modo.
// Sempre invalida tanto a query da data específica quanto as queries de período,
// porque o usuário pode trocar de modo e a UI precisa estar consistente.
function invalidarAgenda(
  qc: ReturnType<typeof useQueryClient>,
  _modo: "dia" | "semana" | "mes",
  dataSelecionada: string,
) {
  // Invalida a query do dia específico (caso o usuário esteja no modo dia)
  qc.invalidateQueries({ queryKey: ["agendamentos", dataSelecionada] });
  // Invalida TODAS as queries de período — mesmo se o usuário está no modo dia,
  // ele pode trocar pra semana/mês depois e o cache precisa estar fresco
  qc.invalidateQueries({ queryKey: ["agendamentos", "periodo"] });
  // Também invalida o resumo de status (pie chart no Início)
  qc.invalidateQueries({ queryKey: ["agendamentos", "resumo-status"] });
}

// ---------------------------------------------------------------------------
// Small UI primitives — match procedimentos-tab
// ---------------------------------------------------------------------------
function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)] grid place-items-center mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium text-[var(--text-app)]">{title}</div>
      {hint && (
        <div className="text-xs text-[var(--text-app-muted)] mt-1 max-w-sm">
          {hint}
        </div>
      )}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
      <AlertTriangle
        size={28}
        className="text-[var(--danger-app)]"
        strokeWidth={1.5}
      />
      <div className="text-sm text-[var(--text-app)]">Erro ao carregar</div>
      <div className="text-xs text-[var(--text-app-muted)] max-w-md">
        {message}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
      >
        <RefreshCw size={13} /> Tentar novamente
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 px-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-16 w-full bg-[var(--bg-app-alt-strong)]"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------
export function AgendaTab() {
  const queryClient = useQueryClient();
  const [dataSelecionada, setDataSelecionada] = useState<string>(hojeIso);
  const [modoVisualizacao, setModoVisualizacao] = useState<
    "dia" | "semana" | "mes"
  >("dia");

  // Form state (inline add)
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formExame, setFormExame] = useState("");
  const [formPlano, setFormPlano] = useState(false);
  const [formParticular, setFormParticular] = useState(false);
  const [formHora, setFormHora] = useState("");
  const [formData, setFormData] = useState<string>(hojeIso);
  const formNomeRef = useRef<HTMLInputElement>(null);

  // Atalho 'n' foca o campo Nome do formulário de novo agendamento
  useEffect(() => {
    return onNovoItem(() => {
      formNomeRef.current?.focus();
      formNomeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  // Calcula periodoInicio/periodoFim conforme modo
  const { periodoInicio, periodoFim, navegacaoLabel } = calcularPeriodo(
    modoVisualizacao,
    dataSelecionada,
  );

  const queryKey =
    modoVisualizacao === "dia"
      ? ["agendamentos", dataSelecionada]
      : ["agendamentos", "periodo", periodoInicio, periodoFim];

  const q = useQuery<Agendamento[]>({
    queryKey,
    queryFn: () => {
      if (modoVisualizacao === "dia") {
        return apiFetch<Agendamento[]>(
          `/api/agendamentos?data=${encodeURIComponent(dataSelecionada)}`,
        );
      }
      return apiFetch<Agendamento[]>(
        `/api/agendamentos?periodoInicio=${encodeURIComponent(periodoInicio!)}&periodoFim=${encodeURIComponent(periodoFim!)}`,
      );
    },
    enabled: Boolean(dataSelecionada),
  });

  const addMut = useMutation({
    mutationFn: (novo: {
      nome: string;
      telefone?: string;
      exame?: string;
      plano: boolean;
      particular: boolean;
      data: string;
      hora?: string;
    }) =>
      apiFetch<Agendamento>("/api/agendamentos", {
        method: "POST",
        body: JSON.stringify(novo),
      }),
    onSuccess: () => {
      invalidarAgenda(queryClient, modoVisualizacao, dataSelecionada);
      setFormNome("");
      setFormTelefone("");
      setFormExame("");
      setFormPlano(false);
      setFormParticular(false);
      setFormHora("");
      toast.success("Agendamento criado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusAgendamento }) =>
      apiFetch<Agendamento>(`/api/agendamentos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      invalidarAgenda(queryClient, modoVisualizacao, dataSelecionada);
      toast.success("Status atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remarcarMut = useMutation({
    mutationFn: ({
      id,
      novaData,
      novaHora,
    }: {
      id: string;
      novaData: string;
      novaHora?: string;
    }) =>
      apiFetch<Agendamento>(`/api/agendamentos/${id}/remarcar`, {
        method: "PUT",
        body: JSON.stringify({
          novaData,
          novaHora: novaHora || null,
        }),
      }),
    onSuccess: (_novo, vars) => {
      invalidarAgenda(queryClient, modoVisualizacao, dataSelecionada);
      // Also invalidate the destination date so the new agendamento appears
      // there if/when the user navigates to it.
      if (vars.novaData && vars.novaData !== dataSelecionada) {
        queryClient.invalidateQueries({
          queryKey: ["agendamentos", vars.novaData],
        });
      }
      toast.success("Agendamento remarcado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/agendamentos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidarAgenda(queryClient, modoVisualizacao, dataSelecionada);
      toast.success("Agendamento excluído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nome = formNome.trim();
    if (!nome) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    // Em modo dia, usa dataSelecionada; em semana/mês, usa formData (input date extra)
    const dataFinal = modoVisualizacao === "dia" ? dataSelecionada : formData;
    if (!dataFinal) {
      toast.error("Informe a data do agendamento.");
      return;
    }
    addMut.mutate({
      nome,
      telefone: formTelefone.trim() || undefined,
      exame: formExame.trim() || undefined,
      plano: formPlano,
      particular: formParticular,
      data: dataFinal,
      hora: formHora || undefined,
    });
  }

  const agendamentos = q.data ?? [];

  return (
    <div className="h-full overflow-y-auto scroll-thin p-4 sm:p-6 bg-[var(--bg-app)]">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* ---------------------------------------------------------------- */}
        {/* Day/Week/Month navigation                                        */}
        {/* ---------------------------------------------------------------- */}
        <Card className="bg-[var(--surface-app)] border-[var(--border-app)] rounded-xl shadow-none p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Toggle Dia/Semana/Mês */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--bg-app-alt-strong)]">
              {([
                { id: "dia", label: "Dia" },
                { id: "semana", label: "Semana" },
                { id: "mes", label: "Mês" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModoVisualizacao(opt.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    modoVisualizacao === opt.id
                      ? "bg-[var(--surface-app)] text-[var(--accent-app-text)] shadow-sm"
                      : "text-[var(--text-app-muted)] hover:text-[var(--text-app)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() =>
                  setDataSelecionada((d) =>
                    diaOffset(d, modoVisualizacao === "dia" ? -1 : modoVisualizacao === "semana" ? -7 : -30),
                  )
                }
                title={modoVisualizacao === "dia" ? "Anterior" : modoVisualizacao === "semana" ? "Semana anterior" : "Mês anterior"}
                aria-label="Anterior"
                className="h-9 w-9 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDataSelecionada(hojeIso())}
                className="h-9 px-3 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                Hoje
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() =>
                  setDataSelecionada((d) =>
                    diaOffset(d, modoVisualizacao === "dia" ? 1 : modoVisualizacao === "semana" ? 7 : 30),
                  )
                }
                title={modoVisualizacao === "dia" ? "Próximo" : modoVisualizacao === "semana" ? "Próxima semana" : "Próximo mês"}
                aria-label="Próximo"
                className="h-9 w-9 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <ChevronRight size={16} />
              </Button>
            </div>

            <div className="flex-1 min-w-0 px-1 sm:px-2">
              <div className="flex items-center gap-2">
                <CalendarDays
                  size={16}
                  className="text-[var(--text-app-muted)] shrink-0"
                />
                <span className="text-sm font-semibold text-[var(--accent-app-text)] capitalize truncate">
                  {navegacaoLabel}
                </span>
                {(() => {
                  const hoje = hojeIso();
                  const dentroDoPeriodo =
                    modoVisualizacao === "dia"
                      ? dataSelecionada === hoje
                      : periodoInicio && periodoFim && periodoInicio <= hoje && periodoFim >= hoje;
                  if (dentroDoPeriodo) {
                    return (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--text-app-muted)] bg-[var(--bg-app-alt-strong)] px-1.5 py-0.5 rounded">
                        atual
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label
                htmlFor="ir-data"
                className="text-[11px] text-[var(--text-app-muted)] whitespace-nowrap"
              >
                Ir para
              </Label>
              <Input
                id="ir-data"
                type="date"
                value={dataSelecionada}
                onChange={(e) => {
                  if (e.target.value) setDataSelecionada(e.target.value);
                }}
                className={cn(inputCls, "h-9 w-[150px]")}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imprimirAgendaDia(dataSelecionada, agendamentos)}
                disabled={agendamentos.length === 0}
                title="Imprimir agenda do dia (PDF)"
                className="h-9 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)] hover:text-[var(--text-app)]"
              >
                <Printer size={14} />
                <span className="hidden sm:inline ml-1.5">Imprimir</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Add appointment form (inline)                                    */}
        {/* ---------------------------------------------------------------- */}
        <Card className="bg-[var(--surface-app)] border-[var(--border-app)] rounded-xl shadow-none p-3 sm:p-4">
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="flex items-center gap-2">
              <Plus size={15} className="text-[var(--text-app-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--text-app)]">
                Novo agendamento
              </h3>
              <span className="text-[11px] text-[var(--text-app-muted)]">
                {modoVisualizacao === "dia"
                  ? `para ${dataBR(dataSelecionada)}`
                  : "escolha a data abaixo"}
              </span>
              <kbd className="hidden sm:inline-block ml-auto px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-app-faint)] bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] rounded">
                n
              </kbd>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4 sm:col-span-2">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Nome *
                </Label>
                <Input
                  ref={formNomeRef}
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Nome do paciente"
                  className={cn(inputCls, "h-9")}
                />
              </div>

              <div className="lg:col-span-3">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Telefone
                </Label>
                <Input
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={cn(inputCls, "h-9")}
                />
              </div>

              <div className="lg:col-span-3">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Exame
                </Label>
                <Input
                  value={formExame}
                  onChange={(e) => setFormExame(e.target.value)}
                  placeholder="Exame / procedimento"
                  className={cn(inputCls, "h-9")}
                />
              </div>

              <div className="lg:col-span-2">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Hora
                </Label>
                <Input
                  type="time"
                  value={formHora}
                  onChange={(e) => setFormHora(e.target.value)}
                  className={cn(inputCls, "h-9")}
                />
              </div>

              {/* Campo de data extra — só aparece nos modos semana/mês */}
              {modoVisualizacao !== "dia" && (
                <div className="lg:col-span-2 sm:col-span-2">
                  <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                    Data *
                  </Label>
                  <Input
                    type="date"
                    value={formData}
                    onChange={(e) => setFormData(e.target.value)}
                    className={cn(inputCls, "h-9")}
                  />
                </div>
              )}

              <div className={`flex items-center gap-5 h-9 ${modoVisualizacao !== "dia" ? "lg:col-span-4 sm:col-span-2" : "lg:col-span-6 sm:col-span-2"}`}>
                <label className="flex items-center gap-2 text-sm text-[var(--text-app)] cursor-pointer select-none">
                  <Checkbox
                    checked={formPlano}
                    onCheckedChange={(v) => setFormPlano(v === true)}
                  />
                  Plano
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-app)] cursor-pointer select-none">
                  <Checkbox
                    checked={formParticular}
                    onCheckedChange={(v) => setFormParticular(v === true)}
                  />
                  Particular
                </label>
              </div>

              <div className="flex justify-end lg:col-span-6 sm:col-span-2 items-center">
                <Button
                  type="submit"
                  disabled={addMut.isPending || !formNome.trim()}
                  className="h-9 bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
                >
                  {addMut.isPending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Agendar
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Status legend                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {Object.entries(STATUS_AGENDAMENTO).map(([k, v]) => (
            <span
              key={k}
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] font-medium",
                v.badge,
              )}
            >
              {v.label}
            </span>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Appointment list                                                 */}
        {/* ---------------------------------------------------------------- */}
        <Card className="bg-[var(--surface-app)] border-[var(--border-app)] rounded-xl shadow-none">
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays
                size={16}
                className="text-[var(--text-app-muted)]"
              />
              <h3 className="text-sm font-semibold text-[var(--text-app)]">
                Agendamentos
              </h3>
              <span className="text-[11px] text-[var(--text-app-muted)]">
                {agendamentos.length}
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              {dataBR(dataSelecionada)}
            </span>
          </div>

          {q.isLoading ? (
            <ListSkeleton />
          ) : q.error ? (
            <ErrorState
              message={q.error.message}
              onRetry={() => q.refetch()}
            />
          ) : agendamentos.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} strokeWidth={1.5} />}
              title={
                modoVisualizacao === "dia"
                  ? "Nenhum agendamento para este dia."
                  : modoVisualizacao === "semana"
                  ? "Nenhum agendamento nesta semana."
                  : "Nenhum agendamento neste mês."
              }
              hint="Adicione o primeiro acima."
            />
          ) : modoVisualizacao === "dia" ? (
            <div className="max-h-[60vh] overflow-y-auto scroll-thin divide-y divide-[var(--border-app-subtle)]">
              {agendamentos.map((ag) => (
                <AppointmentRow
                  key={ag.id}
                  ag={ag}
                  onStatusChange={(status) =>
                    updateStatusMut.mutate({ id: ag.id, status })
                  }
                  onRemarcar={(novaData, novaHora) =>
                    remarcarMut.mutate({
                      id: ag.id,
                      novaData,
                      novaHora,
                    })
                  }
                  onDelete={() => deleteMut.mutate(ag.id)}
                  onJumpToDate={(d) => setDataSelecionada(d)}
                  isRemarcando={remarcarMut.isPending}
                  isStatusPending={updateStatusMut.isPending}
                  isDeleting={deleteMut.isPending}
                />
              ))}
            </div>
          ) : (
            <AgrupadoPorData
              agendamentos={agendamentos}
              onStatusChange={(id, status) => updateStatusMut.mutate({ id, status })}
              onRemarcar={(id, novaData, novaHora) =>
                remarcarMut.mutate({ id, novaData, novaHora })
              }
              onDelete={(id) => deleteMut.mutate(id)}
              onJumpToDate={(d) => setDataSelecionada(d)}
              isRemarcando={remarcarMut.isPending}
              isStatusPending={updateStatusMut.isPending}
              isDeleting={deleteMut.isPending}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppointmentRow — single appointment card with status quick actions, badges,
// remarcar inline form, and delete.
// ---------------------------------------------------------------------------
function AppointmentRow({
  ag,
  onStatusChange,
  onRemarcar,
  onDelete,
  onJumpToDate,
  isRemarcando,
  isStatusPending,
  isDeleting,
}: {
  ag: Agendamento;
  onStatusChange: (status: StatusAgendamento) => void;
  onRemarcar: (novaData: string, novaHora: string) => void;
  onDelete: () => void;
  onJumpToDate: (iso: string) => void;
  isRemarcando: boolean;
  isStatusPending: boolean;
  isDeleting: boolean;
}) {
  const [remarcarOpen, setRemarcarOpen] = useState(false);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  function handleConfirmarRemarcar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!novaData) {
      toast.error("Informe a nova data.");
      return;
    }
    onRemarcar(novaData, novaHora);
    setRemarcarOpen(false);
    setNovaData("");
    setNovaHora("");
  }

  const st = STATUS_AGENDAMENTO[ag.status] ?? STATUS_AGENDAMENTO.aguardando;

  return (
    <div className="px-3 sm:px-4 py-3 hover:bg-[var(--bg-app-alt-strong)]/40 transition-colors">
      {/* Main row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-3">
        {/* Hora */}
        <div className="flex items-center gap-1.5 sm:w-16 shrink-0 mb-2 sm:mb-0">
          <Clock
            size={13}
            className="text-[var(--text-app-faint)] shrink-0"
          />
          <span className="text-sm font-mono tabular-nums text-[var(--text-app-secondary)]">
            {ag.hora || "Sem hora"}
          </span>
        </div>

        {/* Patient + badges */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-app)] truncate">
            {ag.nome}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[11px] text-[var(--text-app-muted)]">
            {ag.telefone && (
              <span className="flex items-center gap-1">
                <Phone size={11} />
                {ag.telefone}
              </span>
            )}
            {ag.exame && (
              <span className="truncate max-w-[200px]">{ag.exame}</span>
            )}
            {!ag.telefone && !ag.exame && (
              <span className="text-[var(--text-app-faint)]">
                Sem detalhes
              </span>
            )}
          </div>

          {(ag.plano || ag.particular) && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {ag.plano && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium",
                    "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
                  )}
                >
                  Plano
                </span>
              )}
              {ag.particular && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  Particular
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status quick actions */}
        <div
          className="flex flex-col sm:items-end gap-1.5 mt-2 sm:mt-0 shrink-0"
          onClick={stop}
        >
          <div className="flex flex-wrap gap-1 sm:justify-end">
            {STATUS_ORDER.map((s) => {
              const conf = STATUS_AGENDAMENTO[s];
              const active = ag.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isStatusPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(s);
                  }}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full border transition-colors disabled:opacity-50 cursor-pointer",
                    active
                      ? cn(conf.badge, "border-transparent font-medium")
                      : "bg-transparent text-[var(--text-app-muted)] border-[var(--border-app-subtle)] hover:bg-[var(--bg-app-alt-strong)]",
                  )}
                  title={conf.label}
                  aria-pressed={active}
                >
                  {conf.label}
                </button>
              );
            })}
          </div>

          {/* Remarcado link */}
          {ag.status === "remarcado" && ag.remarcadoParaData && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onJumpToDate(ag.remarcadoParaData as string);
              }}
              className="flex items-center gap-1 text-[11px] text-[var(--warning-app)] hover:underline mt-0.5"
              title="Ir para o dia remarcado"
            >
              <CalendarClock size={12} />
              ver remarcação {dataBR(ag.remarcadoParaData)}
              {ag.remarcadoParaHora ? ` ${ag.remarcadoParaHora}` : ""}
            </button>
          )}
        </div>
      </div>

      {/* Row actions */}
      <div
        className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-[var(--border-app-subtle)] sm:ml-[76px]"
        onClick={stop}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            setRemarcarOpen((v) => !v);
            setNovaData("");
            setNovaHora("");
          }}
          className="h-7 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] text-xs"
        >
          <CalendarClock size={12} />
          Remarcar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="h-7 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--danger-app)] hover:bg-[var(--danger-app-bg-strong)] text-xs"
        >
          {isDeleting ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Trash2 size={12} />
          )}
          Excluir
        </Button>

        {/* Inline status indicator (subtle reminder of current status) */}
        <UITooltip>
          <UITooltipTrigger asChild>
            <span
              className={cn(
                "ml-auto text-[10px] px-1.5 py-0.5 rounded-full cursor-help",
                st.badge,
              )}
            >
              {st.label}
            </span>
          </UITooltipTrigger>
          <UITooltipContent
            side="left"
            className="bg-[var(--text-app)] text-[var(--bg-app)] text-xs max-w-[220px] border-none"
          >
            <div className="space-y-0.5">
              <div className="font-semibold">{st.label}</div>
              <div className="text-[11px] opacity-90">{st.descricao}</div>
            </div>
          </UITooltipContent>
        </UITooltip>
      </div>

      {/* Inline remarcar form */}
      <AnimatePresence initial={false}>
        {remarcarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2.5 sm:ml-[76px] p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-app-subtle)] flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3"
              onClick={stop}
            >
              <div>
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Nova data *
                </Label>
                <Input
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className={cn(inputCls, "h-9 w-full sm:w-[160px]")}
                />
              </div>
              <div>
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Nova hora
                </Label>
                <Input
                  type="time"
                  value={novaHora}
                  onChange={(e) => setNovaHora(e.target.value)}
                  className={cn(inputCls, "h-9 w-full sm:w-[120px]")}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemarcarOpen(false);
                    setNovaData("");
                    setNovaHora("");
                  }}
                  className="h-9 text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isRemarcando || !novaData}
                  onClick={handleConfirmarRemarcar}
                  className="h-9 bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
                >
                  {isRemarcando ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Confirmar remarcação
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgrupadoPorData — agrupa agendamentos por data (modo semana/mês)
// Renderiza um header de data com contagem, seguido pelos agendamentos do dia.
// ---------------------------------------------------------------------------
function AgrupadoPorData({
  agendamentos,
  onStatusChange,
  onRemarcar,
  onDelete,
  onJumpToDate,
  isRemarcando,
  isStatusPending,
  isDeleting,
}: {
  agendamentos: Agendamento[];
  onStatusChange: (id: string, status: StatusAgendamento) => void;
  onRemarcar: (id: string, novaData: string, novaHora?: string) => void;
  onDelete: (id: string) => void;
  onJumpToDate: (data: string) => void;
  isRemarcando: boolean;
  isStatusPending: boolean;
  isDeleting: boolean;
}) {
  // Agrupa por data (preserva ordem ASC dos agendamentos)
  const grupos = new Map<string, Agendamento[]>();
  for (const ag of agendamentos) {
    const arr = grupos.get(ag.data) || [];
    arr.push(ag);
    grupos.set(ag.data, arr);
  }

  const datas = Array.from(grupos.keys()).sort((a, b) => a.localeCompare(b));
  const hoje = hojeIso();

  return (
    <div className="max-h-[60vh] overflow-y-auto scroll-thin space-y-3">
      {datas.map((data) => {
        const lista = grupos.get(data) || [];
        const d = new Date(`${data}T12:00:00`);
        const ehHoje = data === hoje;
        const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(d);
        const diaMes = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
        return (
          <div key={data}>
            {/* Header do dia */}
            <div
              className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md ${
                ehHoje
                  ? "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]"
                  : "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]"
              }`}
            >
              <CalendarDays size={13} />
              <span className="capitalize">{diaSemana}</span>
              <span>· {diaMes}</span>
              {ehHoje && (
                <span className="text-[10px] uppercase tracking-wide bg-[var(--accent-app)] text-white px-1.5 py-0.5 rounded">
                  hoje
                </span>
              )}
              <span className="ml-auto text-[10px] font-normal text-[var(--text-app-muted)]">
                {lista.length} {lista.length === 1 ? "agendamento" : "agendamentos"}
              </span>
            </div>
            {/* Lista do dia */}
            <div className="divide-y divide-[var(--border-app-subtle)] mt-1">
              {lista.map((ag) => (
                <AppointmentRow
                  key={ag.id}
                  ag={ag}
                  onStatusChange={(status) => onStatusChange(ag.id, status)}
                  onRemarcar={(novaData, novaHora) => onRemarcar(ag.id, novaData, novaHora)}
                  onDelete={() => onDelete(ag.id)}
                  onJumpToDate={onJumpToDate}
                  isRemarcando={isRemarcando}
                  isStatusPending={isStatusPending}
                  isDeleting={isDeleting}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// imprimirAgendaDia — abre uma janela de impressão com layout otimizado pra
// balcão de recepção: cabeçalho com data + clínica, lista numerada com
// horário/paciente/exame/convênio/status, e rodapé com totalizadores.
// ---------------------------------------------------------------------------
function imprimirAgendaDia(data: string, agendamentos: Agendamento[]) {
  if (agendamentos.length === 0) {
    toast.error("Nenhum agendamento para imprimir neste dia.");
    return;
  }

  const dataHora = new Date().toLocaleString("pt-BR");
  const dataLonga = formatarDataLonga(data);
  const usuario = useAuth.getState().usuario;
  const nomeClinica = usuario?.clinica.nome ?? "Clínica";

  // Estatísticas por status
  const porStatus: Record<string, number> = {};
  for (const a of agendamentos) {
    porStatus[a.status] = (porStatus[a.status] ?? 0) + 1;
  }
  const statsText = Object.entries(porStatus)
    .map(([s, n]) => `${STATUS_AGENDAMENTO[s as StatusAgendamento]?.label ?? s}: ${n}`)
    .join(" · ");

  const rows = agendamentos
    .map(
      (a, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="hora">${a.hora || "—"}</td>
        <td class="paciente">${escapeHtml(a.nome)}</td>
        <td class="exame">${escapeHtml(a.exame || "—")}</td>
        <td class="tipo">${a.plano ? "Plano" : a.particular ? "Particular" : "—"}</td>
        <td class="telefone">${escapeHtml(a.telefone || "—")}</td>
        <td class="status status-${a.status}">${STATUS_AGENDAMENTO[a.status]?.label ?? a.status}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Agenda — ${dataLonga}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #183247;
    margin: 24px;
    font-size: 12px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #123b62;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .header h1 {
    color: #123b62;
    font-size: 18px;
    margin: 0 0 4px;
  }
  .header .sub { color: #617a8c; font-size: 11px; }
  .header .clinica {
    text-align: right;
    font-size: 11px;
    color: #617a8c;
  }
  .header .clinica strong {
    color: #183247;
    font-size: 12px;
    display: block;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  th {
    background: #123b62;
    color: white;
    text-align: left;
    padding: 8px 6px;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  td {
    padding: 8px 6px;
    border-bottom: 1px solid #dbe7ee;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f6fafc; }
  .num { text-align: center; width: 28px; color: #8ba0ae; font-variant-numeric: tabular-nums; }
  .hora { text-align: center; width: 60px; font-weight: 600; color: #087a9d; font-variant-numeric: tabular-nums; }
  .paciente { font-weight: 500; min-width: 140px; }
  .exame { color: #355369; }
  .tipo { width: 80px; text-align: center; }
  .telefone { width: 100px; color: #617a8c; font-variant-numeric: tabular-nums; }
  .status {
    width: 90px;
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 10px;
    color: white;
  }
  .status-aguardando { background: #617a8c; }
  .status-atendido { background: #087a9d; }
  .status-faltou { background: #dc2626; }
  .status-desmarcou { background: #8ba0ae; }
  .status-remarcado { background: #b45309; }
  .footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid #dbe7ee;
    display: flex;
    justify-content: space-between;
    color: #617a8c;
    font-size: 10px;
  }
  .stats {
    color: #355369;
    font-size: 11px;
  }
  .stats strong { color: #087a9d; }
  @page { margin: 1.5cm; size: A4; }
  @media print {
    body { margin: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Agenda do dia</h1>
      <div class="sub">${dataLonga}</div>
    </div>
    <div class="clinica">
      <strong>${escapeHtml(nomeClinica)}</strong>
      Gerado em ${dataHora}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Hora</th>
        <th>Paciente</th>
        <th>Exame</th>
        <th>Tipo</th>
        <th>Telefone</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    <div class="stats">
      <strong>${agendamentos.length}</strong> agendamento(s) · ${statsText}
    </div>
    <div>Flux-X Odonto</div>
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    toast.error("Popup bloqueado. Permita popups para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  toast.success("Abrindo janela de impressão da agenda…");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
