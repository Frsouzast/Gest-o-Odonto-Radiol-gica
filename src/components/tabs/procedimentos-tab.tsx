"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Pencil,
  Calculator,
  Save,
  AlertTriangle,
  TrendingUp,
  Check,
  RefreshCw,
  Stethoscope,
  Inbox,
  Clock,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch, useAuth } from "@/lib/auth-store";
import { brl, num, pct } from "@/lib/utils";
import { onNovoItem } from "@/lib/atalhos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types — mirror T2-c API contract (Prisma camelCase)
// ---------------------------------------------------------------------------
interface Procedimento {
  id: string;
  clinicaId: string;
  nome: string;
  tempoMinutos: number;
  laudos: number;
  retrabalhoPct: number;
  comissaoPct: number;
  lucroDesejadoPct: number;
  inadimplenciaPct: number;
  impostosPct: number;
  taxaCartaoPct: number;
  outrosPct: number;
  precoConcorrencia: number | null;
  precoFinal: number | null;
  ativo: boolean;
  equipamentoId: string | null;
}
type ProcedimentoConsulta = Pick<Procedimento, "id" | "nome" | "tempoMinutos" | "precoFinal">;

interface ItemProcedimento {
  insumoId: string;
  quantidade: number;
  insumoNome: string | null;
}

interface Ativo {
  id: string;
  clinicaId: string;
  nome: string;
  dataAquisicao: string | null;
  valorAquisicao: number;
  vidaUtilAnos: number;
}

interface Insumo {
  id: string;
  clinicaId: string;
  nome: string;
  unidade: string;
  valorTotal: number;
  quantidade: number;
}

interface ResultadoCalculo {
  procedimento: string;
  custoInsumos: number;
  rateio: number;
  retrabalhoValor: number;
  custoDireto: number;
  precoSugerido: number;
  pontoEquilibrio: number;
  lucratividadeFinal: number;
}

// ---------------------------------------------------------------------------
// Shared style helpers (mirror T3-b custos-capacidade-tab)
// ---------------------------------------------------------------------------
const inputCls =
  "bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] placeholder:text-[var(--text-app-faint)] focus-visible:border-[var(--accent-app)] focus-visible:ring-[var(--accent-app)]/25";

// ---------------------------------------------------------------------------
// Small UI primitives
// ---------------------------------------------------------------------------
function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
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
      {action && <div className="mt-4">{action}</div>}
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
          className="h-12 w-full bg-[var(--bg-app-alt-strong)]"
        />
      ))}
    </div>
  );
}

function CalcSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[var(--border-app-subtle)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-9 w-full bg-[var(--bg-app-alt-strong)] rounded-none"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-24 bg-[var(--bg-app-alt-strong)]"
          />
        ))}
      </div>
    </div>
  );
}

function CalcLine({
  label,
  value,
  accent,
  warning,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--border-app-subtle)] last:border-0">
      <span className="text-xs text-[var(--text-app-muted)]">{label}</span>
      <span
        className={`text-sm font-mono tabular-nums ${
          accent
            ? "text-[var(--accent-app-text)]"
            : warning
            ? "text-[var(--warning-app)]"
            : danger
            ? "text-[var(--danger-app)]"
            : "text-[var(--text-app)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
  nome: "nome",
  tempoMinutos: "tempo",
  laudos: "laudos",
  retrabalhoPct: "retrabalho",
  comissaoPct: "comissão",
  lucroDesejadoPct: "lucro",
  inadimplenciaPct: "inadimplência",
  impostosPct: "impostos",
  taxaCartaoPct: "taxa de cartão",
  outrosPct: "outros",
  precoConcorrencia: "concorrência",
  equipamentoId: "equipamento",
};

function labelForField(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function round2(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// 1. Main tab — two-pane responsive layout
// ---------------------------------------------------------------------------
export function ProcedimentosTab() {
  const podeEditar = useAuth((s) => s.podeEditar());

  const q = useQuery<ProcedimentoConsulta[]>({
    queryKey: ["procedimentos"],
    queryFn: () => apiFetch<ProcedimentoConsulta[]>("/api/procedimentos"),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derived effective selection (no setState-in-effect) — auto-selects the
  // first item once data arrives and falls back when the selected id is no
  // longer in the list (e.g., after a delete).
  const effectiveSelectedId = useMemo(() => {
    const list = q.data ?? [];
    if (list.length === 0) return null;
    if (selectedId && list.some((p) => p.id === selectedId)) return selectedId;
    return list[0].id;
  }, [q.data, selectedId]);

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 p-4 lg:p-6">
        <ProcedimentosListPane
          procedimentos={q.data ?? []}
          loading={q.isLoading}
          error={q.error}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedId}
          onRefetch={() => q.refetch()}
        />
        {effectiveSelectedId && !podeEditar ? (
          <ConsultaProcedimento procedimento={q.data?.find((item) => item.id === effectiveSelectedId)} />
        ) : effectiveSelectedId ? (
          <ProcedimentoDetalhe key={effectiveSelectedId} procedimentoId={effectiveSelectedId} podeEditar={podeEditar} />
        ) : (
          <EmptyDetailPane hasProcedimentos={(q.data ?? []).length > 0} podeEditar={podeEditar} />
        )}
      </div>
    </div>
  );
}

function ConsultaProcedimento({ procedimento }: { procedimento: ProcedimentoConsulta | undefined }) {
  if (!procedimento) return null;
  return <Card className="bg-[var(--surface-app)] border-[var(--border-app)] p-5 self-start">
    <h2 className="text-lg font-semibold text-[var(--text-app)]">{procedimento.nome}</h2>
    <p className="text-sm text-[var(--text-app-muted)]">Consulta para atendimento. Custos e margens são restritos à gestão.</p>
    <dl className="space-y-4 mt-4"><div><dt className="text-sm text-[var(--text-app-muted)]">Tempo previsto</dt><dd>{num(procedimento.tempoMinutos)} minutos</dd></div>
      <div><dt className="text-sm text-[var(--text-app-muted)]">Preço definido pela clínica</dt><dd className="text-xl font-semibold text-[var(--accent-app-text)]">{procedimento.precoFinal == null ? "Ainda não definido" : brl(procedimento.precoFinal)}</dd></div>
    </dl>
    {procedimento.precoFinal == null && <p className="text-sm text-[var(--text-app-muted)]">Consulte o responsável pela precificação antes de informar um valor ao paciente.</p>}
  </Card>;
}

// ---------------------------------------------------------------------------
// 2. List pane
// ---------------------------------------------------------------------------
function ProcedimentosListPane({
  procedimentos,
  loading,
  error,
  selectedId,
  onSelect,
  onRefetch,
}: {
  procedimentos: ProcedimentoConsulta[];
  loading: boolean;
  error: Error | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefetch: () => void;
}) {
  const podeEditar = useAuth((s) => s.podeEditar());
  const queryClient = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  // Atalho 'n' abre o dialog de novo procedimento (só se pode editar)
  useEffect(() => {
    if (!podeEditar) return;
    return onNovoItem(() => setNovoOpen(true));
  }, [podeEditar]);

  const addMut = useMutation({
    mutationFn: (nome: string) =>
      apiFetch<Procedimento>("/api/procedimentos", {
        method: "POST",
        body: JSON.stringify({ nome }),
      }),
    onSuccess: (novo) => {
      queryClient.invalidateQueries({ queryKey: ["procedimentos"] });
      setNovoOpen(false);
      setNovoNome("");
      toast.success("Procedimento criado");
      onSelect(novo.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none self-start">
      <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stethoscope size={16} className="text-[var(--text-app-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Procedimentos
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {procedimentos.length}
          </span>
        </div>
        {podeEditar && (
          <Button
            type="button"
            size="sm"
            onClick={() => setNovoOpen(true)}
            title="Criar novo procedimento (n)"
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
          >
            <Plus size={14} /> Novo
            <kbd className="hidden sm:inline-block ml-1.5 px-1 py-0.5 text-[10px] font-mono bg-white/20 border border-white/20 rounded">
              n
            </kbd>
          </Button>
        )}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRefetch} />
      ) : procedimentos.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} strokeWidth={1.5} />}
          title="Nenhum procedimento"
          hint={
            podeEditar
              ? "Crie o primeiro procedimento para começar a precificar."
              : "Aguarde o gestor cadastrar procedimentos."
          }
          action={
            podeEditar ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setNovoOpen(true)}
                className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
              >
                <Plus size={14} /> Criar procedimento
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="max-h-80 overflow-y-auto scroll-thin py-1">
          {procedimentos.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors border-l-2 ${
                  active
                    ? "bg-[var(--accent-app-soft-bg)] border-[var(--accent-app)] text-[var(--text-app)]"
                    : "bg-transparent border-transparent hover:bg-[var(--bg-app-alt-strong)]/60 text-[var(--text-app)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {p.nome || "(sem nome)"}
                  </span>
                  {p.precoFinal != null && p.precoFinal > 0 && (
                    <span className="text-[11px] font-mono tabular-nums text-[var(--text-app-muted)] shrink-0">
                      {brl(p.precoFinal)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-app-faint)] mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {num(p.tempoMinutos)} min
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New procedimento dialog */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-app)]">
              Novo procedimento
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Nome do procedimento
            </Label>
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Radiografia panorâmica, Periapical, Tratamento de canal…"
              className={inputCls}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = novoNome.trim();
                  if (v) addMut.mutate(v);
                }
              }}
            />
            <p className="text-[11px] text-[var(--text-app-muted)] mt-2">
              Os demais parâmetros (tempo, percentuais, insumos) podem ser
              ajustados depois na tela de edição.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                const v = novoNome.trim();
                if (!v) {
                  toast.error("Informe o nome");
                  return;
                }
                addMut.mutate(v);
              }}
              disabled={addMut.isPending}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
            >
              {addMut.isPending ? "Criando…" : "Criar procedimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Empty right pane when nothing is selected
function EmptyDetailPane({
  hasProcedimentos,
  podeEditar,
}: {
  hasProcedimentos: boolean;
  podeEditar: boolean;
}) {
  return (
    <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
      <EmptyState
        icon={<Calculator size={24} strokeWidth={1.5} />}
        title={
          hasProcedimentos
            ? "Selecione um procedimento"
            : "Sem procedimento selecionado"
        }
        hint={
          hasProcedimentos
            ? "Escolha um item da lista à esquerda para ver os parâmetros, insumos consumidos e o cálculo de preço."
            : podeEditar
            ? "Crie o primeiro procedimento para ver detalhes e o cálculo de preço."
            : "Aguarde o gestor cadastrar procedimentos."
        }
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3. Detail pane
// ---------------------------------------------------------------------------
function ProcedimentoDetalhe({
  procedimentoId,
  podeEditar,
}: {
  procedimentoId: string;
  podeEditar: boolean;
}) {
  const queryClient = useQueryClient();

  // Read procedimento from the cached list (shared queryKey, no extra fetch)
  const procQ = useQuery<Procedimento[], Error, Procedimento | null>({
    queryKey: ["procedimentos"],
    queryFn: () => apiFetch<Procedimento[]>("/api/procedimentos"),
    select: (list) => list.find((p) => p.id === procedimentoId) ?? null,
  });

  // Lookup data for the dropdowns
  const insumosQ = useQuery<Insumo[]>({
    queryKey: ["insumos"],
    queryFn: () => apiFetch<Insumo[]>("/api/insumos"),
  });
  const ativosQ = useQuery<Ativo[]>({
    queryKey: ["ativos"],
    queryFn: () => apiFetch<Ativo[]>("/api/ativos"),
  });

  // Items of this procedimento
  const itensQ = useQuery<ItemProcedimento[]>({
    queryKey: ["procedimentos", procedimentoId, "itens"],
    queryFn: () =>
      apiFetch<ItemProcedimento[]>(
        `/api/procedimentos/${procedimentoId}/itens`
      ),
  });

  // Calculo (400 = capacidade ausente — exibe banner em vez de erro)
  const calcQ = useQuery<ResultadoCalculo>({
    queryKey: ["procedimentos", procedimentoId, "calculo"],
    queryFn: async () => {
      // Distinguishes 400 (capacidade ausente) from other errors so we can
      // show a friendly banner instead of a hard error.
      return apiFetch<ResultadoCalculo>(`/api/procedimentos/${procedimentoId}/calculo`);
    },
    retry: false,
  });

  const proc = procQ.data ?? null;

  // PUT mutation (single-field inline update on blur)
  const putMut = useMutation({
    mutationFn: (vars: {
      id: string;
      field: string;
      value: number | string | null;
    }) =>
      apiFetch<Procedimento>(`/api/procedimentos/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify({ [vars.field]: vars.value }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedimentos"] });
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "calculo"],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // DELETE mutation (soft delete)
  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/procedimentos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedimentos"] });
      queryClient.removeQueries({
        queryKey: ["procedimentos", procedimentoId],
      });
      toast.success("Procedimento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Items mutations
  const addInsumoMut = useMutation({
    mutationFn: (vars: { insumoId: string; quantidade: number }) =>
      apiFetch<{
        procedimentoId: string;
        insumoId: string;
        quantidade: number;
      }>(`/api/procedimentos/${procedimentoId}/itens`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "itens"],
      });
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "calculo"],
      });
      toast.success("Insumo adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updInsumoMut = useMutation({
    mutationFn: (vars: { insumoId: string; quantidade: number }) =>
      apiFetch<{
        procedimentoId: string;
        insumoId: string;
        quantidade: number;
      }>(`/api/procedimentos/${procedimentoId}/itens`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "itens"],
      });
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "calculo"],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trocaInsumoMut = useMutation({
    mutationFn: async (vars: {
      insumoIdAntigo: string;
      insumoIdNovo: string;
      quantidade: number;
    }) => {
      if (vars.insumoIdNovo !== vars.insumoIdAntigo) {
        await apiFetch<void>(
          `/api/procedimentos/${procedimentoId}/itens/${vars.insumoIdAntigo}`,
          { method: "DELETE" }
        );
      }
      return apiFetch<{
        procedimentoId: string;
        insumoId: string;
        quantidade: number;
      }>(`/api/procedimentos/${procedimentoId}/itens`, {
        method: "POST",
        body: JSON.stringify({
          insumoId: vars.insumoIdNovo,
          quantidade: vars.quantidade,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "itens"],
      });
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "calculo"],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rmInsumoMut = useMutation({
    mutationFn: (insumoId: string) =>
      apiFetch<void>(
        `/api/procedimentos/${procedimentoId}/itens/${insumoId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "itens"],
      });
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "calculo"],
      });
      toast.success("Insumo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Preço final PUT — uncontrolled input read via ref
  const precoInputRef = useRef<HTMLInputElement>(null);

  const precoMut = useMutation({
    mutationFn: (precoNovo: number) =>
      apiFetch<void>(`/api/procedimentos/${procedimentoId}/preco-final`, {
        method: "PUT",
        body: JSON.stringify({ precoNovo }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedimentos"] });
      queryClient.invalidateQueries({
        queryKey: ["procedimentos", procedimentoId, "calculo"],
      });
      toast.success("Preço final definido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ----- Render states -----
  if (procQ.isLoading) {
    return (
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="p-5 space-y-4">
          <Skeleton className="h-8 w-2/3 bg-[var(--bg-app-alt-strong)]" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-16 bg-[var(--bg-app-alt-strong)]"
              />
            ))}
          </div>
          <Skeleton className="h-24 bg-[var(--bg-app-alt-strong)]" />
        </div>
      </Card>
    );
  }

  if (!proc) {
    return (
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <EmptyState
          icon={<Inbox size={22} strokeWidth={1.5} />}
          title="Procedimento não encontrado"
          hint="Talvez ele tenha sido removido. Recarregue a lista."
        />
      </Card>
    );
  }

  // ----- Commit helpers -----
  function commitNum(
    field: string,
    rawValue: string,
    original: number | null | undefined
  ) {
    const v = num(rawValue);
    const orig = original ?? 0;
    if (v === orig) return;
    putMut.mutate({ id: procedimentoId, field, value: v });
  }

  function commitPct(
    field: string,
    rawValue: string,
    original: number | null | undefined
  ) {
    // UI displays pct * 100 (e.g., 30 for 0.30) — divide by 100 on commit.
    const v = num(rawValue) / 100;
    const orig = original ?? 0;
    if (v === orig) return;
    putMut.mutate({ id: procedimentoId, field, value: v });
  }

  function commitStr(
    field: string,
    rawValue: string,
    original: string | null | undefined
  ) {
    const v = rawValue.trim();
    if (!v) {
      toast.error("O campo não pode ser vazio");
      return;
    }
    if (v === (original ?? "")) return;
    putMut.mutate({ id: procedimentoId, field, value: v });
  }

  function commitEquipamento(rawValue: string) {
    const v = rawValue;
    if (v === (proc?.equipamentoId ?? "")) return;
    if (!v) {
      // API T2-c só aceita string (typeof check) — não é possível desvincular
      // o equipamento via esta tela. Limitação documentada no worklog.
      toast.info(
        "Não é possível desvincular o equipamento por esta tela. Escolha outro equipamento para trocar."
      );
      return;
    }
    putMut.mutate({ id: procedimentoId, field: "equipamentoId", value: v });
  }

  // Insumo unit cost lookup (para a coluna "custo" da sub-tabela)
  const insumos = insumosQ.data ?? [];
  const unitCost = (insumoId: string): number => {
    const i = insumos.find((x) => x.id === insumoId);
    if (!i || !i.quantidade) return 0;
    return i.valorTotal / i.quantidade;
  };

  const salvandoCampo =
    putMut.isPending && putMut.variables ? putMut.variables.field : null;
  const itens = itensQ.data ?? [];
  const calc = calcQ.data;
  const calcCapacidadeAusente =
    calcQ.isError &&
    (calcQ.error as Error)?.message
      ?.toLowerCase()
      .includes("capacidade produtiva");

  function handleAddInsumo() {
    if (!insumos.length) {
      toast.error("Cadastre insumos na aba Custos & Capacidade antes");
      return;
    }
    const jaUsados = new Set(itens.map((it) => it.insumoId));
    const proximo = insumos.find((i) => !jaUsados.has(i.id));
    if (!proximo) {
      toast.error(
        "Todos os insumos cadastrados já foram adicionados a este procedimento."
      );
      return;
    }
    addInsumoMut.mutate({ insumoId: proximo.id, quantidade: 1 });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Header */}
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Nome do procedimento
            </Label>
            <Input
              defaultValue={proc.nome}
              onBlur={(e) =>
                commitStr("nome", e.currentTarget.value, proc.nome)
              }
              disabled={!podeEditar}
              className={`${inputCls} ${podeEditar ? "" : "opacity-70"} text-base h-9`}
            />
          </div>
          {podeEditar && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Remover procedimento"
                  className="bg-transparent border-[var(--border-app)] text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)] hover:border-[var(--danger-app)]"
                >
                  <Trash2 size={15} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[var(--text-app)]">
                    Remover procedimento?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[var(--text-app-muted)]">
                    {`O procedimento "${proc.nome}" será desativado (soft-delete). Histórico de preços e itens vinculados são preservados. Esta ação não pode ser desfeita pela interface.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => delMut.mutate(procedimentoId)}
                    className="bg-[var(--danger-app)] text-white hover:bg-[var(--danger-app)]/90"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </Card>

      {/* Parâmetros */}
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-5 py-3 border-b border-[var(--border-app-subtle)] flex items-center gap-2">
          <Pencil size={14} className="text-[var(--text-app-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Parâmetros
          </h3>
          {salvandoCampo && (
            <span className="ml-auto text-[11px] text-[var(--text-app-muted)] flex items-center gap-1">
              <Save size={11} className="animate-pulse" /> salvando{" "}
              {labelForField(salvandoCampo)}…
            </span>
          )}
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Tempo */}
          <ParamField
            label="Tempo (minutos)"
            type="number"
            step="1"
            min="0"
            defaultValue={num(proc.tempoMinutos)}
            onBlur={(e) =>
              commitNum("tempoMinutos", e.currentTarget.value, proc.tempoMinutos)
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "tempoMinutos"}
          />
          {/* Laudos */}
          <ParamField
            label="Laudos / planej. (R$)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={num(proc.laudos)}
            onBlur={(e) =>
              commitNum("laudos", e.currentTarget.value, proc.laudos)
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "laudos"}
          />
          {/* Retrabalho */}
          <ParamField
            label="Retrabalho (%)"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={round2(num(proc.retrabalhoPct) * 100)}
            onBlur={(e) =>
              commitPct("retrabalhoPct", e.currentTarget.value, proc.retrabalhoPct)
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "retrabalhoPct"}
          />
          {/* Equipamento */}
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Equipamento usado
            </Label>
            <select
              value={proc.equipamentoId ?? ""}
              onChange={(e) => commitEquipamento(e.target.value)}
              disabled={!podeEditar || ativosQ.isLoading}
              className={`w-full h-9 px-2 rounded-md border ${inputCls} ${
                podeEditar ? "" : "opacity-70"
              } text-sm bg-[var(--surface-app)]`}
            >
              <option value="">— nenhum —</option>
              {(ativosQ.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--text-app-faint)] mt-0.5">
              alimenta a rentabilidade por hora no Financeiro
            </p>
          </div>
          {/* Comissão */}
          <ParamField
            label="Comissão comercial (%)"
            type="number"
            step="0.1"
            min="0"
            defaultValue={round2(num(proc.comissaoPct) * 100)}
            onBlur={(e) =>
              commitPct("comissaoPct", e.currentTarget.value, proc.comissaoPct)
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "comissaoPct"}
          />
          {/* Lucro desejado */}
          <ParamField
            label="Lucro desejado (%)"
            type="number"
            step="0.1"
            min="0"
            defaultValue={round2(num(proc.lucroDesejadoPct) * 100)}
            onBlur={(e) =>
              commitPct(
                "lucroDesejadoPct",
                e.currentTarget.value,
                proc.lucroDesejadoPct
              )
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "lucroDesejadoPct"}
          />
          {/* Inadimplência */}
          <ParamField
            label="Inadimplência (%)"
            type="number"
            step="0.1"
            min="0"
            defaultValue={round2(num(proc.inadimplenciaPct) * 100)}
            onBlur={(e) =>
              commitPct(
                "inadimplenciaPct",
                e.currentTarget.value,
                proc.inadimplenciaPct
              )
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "inadimplenciaPct"}
          />
          {/* Impostos */}
          <ParamField
            label="Impostos (%)"
            type="number"
            step="0.1"
            min="0"
            defaultValue={round2(num(proc.impostosPct) * 100)}
            onBlur={(e) =>
              commitPct("impostosPct", e.currentTarget.value, proc.impostosPct)
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "impostosPct"}
          />
          {/* Taxa cartão */}
          <ParamField
            label="Taxa de cartão (%)"
            type="number"
            step="0.1"
            min="0"
            defaultValue={round2(num(proc.taxaCartaoPct) * 100)}
            onBlur={(e) =>
              commitPct("taxaCartaoPct", e.currentTarget.value, proc.taxaCartaoPct)
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "taxaCartaoPct"}
          />
          {/* Outros */}
          <ParamField
            label="Outros (%)"
            type="number"
            step="0.1"
            min="0"
            defaultValue={round2(num(proc.outrosPct) * 100)}
            onBlur={(e) =>
              commitPct("outrosPct", e.currentTarget.value, proc.outrosPct)
            }
            disabled={!podeEditar}
            salvando={salvandoCampo === "outrosPct"}
          />
          {/* Preço concorrência */}
          <ParamField
            label="Preço concorrência (R$)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={proc.precoConcorrencia ?? ""}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v === "") {
                if (proc.precoConcorrencia != null) {
                  putMut.mutate({
                    id: procedimentoId,
                    field: "precoConcorrencia",
                    value: 0,
                  });
                }
                return;
              }
              commitNum(
                "precoConcorrencia",
                v,
                proc.precoConcorrencia ?? 0
              );
            }}
            disabled={!podeEditar}
            salvando={salvandoCampo === "precoConcorrencia"}
          />
        </div>
      </Card>

      {/* Insumos consumidos */}
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-5 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-[var(--text-app-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Insumos consumidos
            </h3>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              {itens.length}
            </span>
          </div>
          {podeEditar && (
            <Button
              type="button"
              size="sm"
              onClick={handleAddInsumo}
              disabled={addInsumoMut.isPending || !insumos.length}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
            >
              <Plus size={13} /> Adicionar insumo
            </Button>
          )}
        </div>

        {itensQ.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-10 w-full bg-[var(--bg-app-alt-strong)]"
              />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <EmptyState
            icon={<Package size={22} strokeWidth={1.5} />}
            title="Nenhum insumo associado"
            hint={
              podeEditar
                ? "Adicione insumos para que o custo de materiais entre no cálculo."
                : "Aguarde o gestor vincular insumos a este procedimento."
            }
          />
        ) : (
          <div className="max-h-80 overflow-y-auto scroll-thin">
            <div className="grid grid-cols-[1fr_80px_110px_40px] gap-2 px-5 py-2 border-b border-[var(--border-app-subtle)] text-[11px] uppercase tracking-wide text-[var(--text-app-muted)]">
              <div>Insumo</div>
              <div className="text-right">Qtde</div>
              <div className="text-right">Custo</div>
              <div />
            </div>
            {itens.map((it) => {
              const usedIds = new Set(
                itens
                  .filter((x) => x.insumoId !== it.insumoId)
                  .map((x) => x.insumoId)
              );
              const saving =
                (updInsumoMut.isPending &&
                  updInsumoMut.variables?.insumoId === it.insumoId) ||
                (trocaInsumoMut.isPending &&
                  trocaInsumoMut.variables?.insumoIdAntigo === it.insumoId);
              return (
                <InsumoRow
                  key={it.insumoId}
                  item={it}
                  insumos={insumos}
                  usedInsumoIds={usedIds}
                  podeEditar={podeEditar}
                  custoUnitario={unitCost(it.insumoId)}
                  onTrocarInsumo={(novoId, quantidade) =>
                    trocaInsumoMut.mutate({
                      insumoIdAntigo: it.insumoId,
                      insumoIdNovo: novoId,
                      quantidade,
                    })
                  }
                  onSalvarQuantidade={(quantidade) =>
                    updInsumoMut.mutate({ insumoId: it.insumoId, quantidade })
                  }
                  onRemover={() => rmInsumoMut.mutate(it.insumoId)}
                  salvando={saving}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* Resultado do cálculo */}
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-5 py-3 border-b border-[var(--border-app-subtle)] flex items-center gap-2">
          <Calculator size={14} className="text-[var(--text-app-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Resultado do cálculo
          </h3>
          {calcQ.isFetching && !calcQ.isLoading && (
            <span className="ml-auto text-[11px] text-[var(--text-app-muted)]">
              recalculando…
            </span>
          )}
        </div>

        {calcQ.isLoading ? (
          <div className="p-5">
            <CalcSkeleton />
          </div>
        ) : calcCapacidadeAusente ? (
          <div className="m-5 flex items-start gap-3 bg-[var(--warning-app-bg)]/40 border-l-2 border-[var(--warning-app)] rounded-md p-4">
            <AlertTriangle
              size={18}
              className="text-[var(--warning-app)] shrink-0 mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-[var(--text-app)]">
                Ajuste a configuração antes de calcular
              </div>
              <p className="text-xs text-[var(--text-app-muted)] mt-1">
                {(calcQ.error as Error)?.message} Abra Custos & Capacidade para revisar os dados.
              </p>
            </div>
          </div>
        ) : calcQ.isError ? (
          <div className="p-5">
            <ErrorState
              message={(calcQ.error as Error)?.message ?? "Falha ao calcular"}
              onRetry={() => calcQ.refetch()}
            />
          </div>
        ) : calc ? (
          <div className="p-5 space-y-4">
            {/* Line items */}
            <div className="rounded-md border border-[var(--border-app-subtle)] overflow-hidden">
              <CalcLine
                label="Custo de insumos"
                value={brl(calc.custoInsumos)}
              />
              <CalcLine label="Rateio custo fixo" value={brl(calc.rateio)} />
              <CalcLine
                label="Retrabalho / desperdício"
                value={brl(calc.retrabalhoValor)}
              />
              <CalcLine
                label="Custo direto total"
                value={brl(calc.custoDireto)}
                accent
              />
            </div>

            {/* Preço sugerido + ponto de equilíbrio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-[var(--accent-app-soft-border)] bg-[var(--accent-app-soft-bg)] p-4">
                <div className="text-[11px] uppercase tracking-wide text-[var(--accent-app-text)]/80">
                  Preço sugerido
                </div>
                <div className="text-2xl font-mono tabular-nums text-[var(--accent-app-text)] mt-1">
                  {brl(calc.precoSugerido)}
                </div>
                <div className="text-[11px] text-[var(--text-app-muted)] mt-1">
                  Cobre os custos informados e a margem desejada. Arredondado para o próximo centavo quando necessário.
                </div>
              </div>
              <div className="rounded-md border border-[var(--warning-app-border)] bg-[var(--warning-app-bg)] p-4">
                <div className="text-[11px] uppercase tracking-wide text-[var(--warning-app)]/80">
                  Ponto de equilíbrio
                </div>
                <div className="text-xl font-mono tabular-nums text-[var(--warning-app)] mt-1">
                  {brl(calc.pontoEquilibrio)}
                </div>
                <div className="text-[11px] text-[var(--text-app-muted)] mt-1">
                  Preço que cobre os custos e taxas informados, sem a margem de lucro desejada.
                </div>
              </div>
            </div>

            {/* Badges de comparação */}
            {proc.precoFinal != null && proc.precoFinal > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {proc.precoFinal < calc.pontoEquilibrio && (
                  <Badge
                    variant="outline"
                    className="border-[var(--danger-app)] bg-[var(--danger-app-bg)] text-[var(--danger-app)] gap-1"
                  >
                    <AlertTriangle size={12} /> Abaixo do ponto de equilíbrio
                  </Badge>
                )}
                {proc.precoFinal > calc.precoSugerido && (
                  <Badge
                    variant="outline"
                    className="border-[var(--accent-app-soft-border)] bg-[var(--accent-app-soft-bg)] text-[var(--accent-app-text)] gap-1"
                  >
                    <TrendingUp size={12} /> Acima do sugerido
                  </Badge>
                )}
                {proc.precoFinal >= calc.pontoEquilibrio &&
                  proc.precoFinal <= calc.precoSugerido && (
                    <Badge
                      variant="outline"
                      className="border-[var(--border-app-strong)] bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)] gap-1"
                    >
                      <Check size={12} /> Dentro da faixa recomendada
                    </Badge>
                  )}
              </div>
            )}
          </div>
        ) : null}
      </Card>

      {/* Preço final + lucratividade final */}
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-5 py-4 space-y-3">
          <Label className="text-[11px] text-[var(--text-app-muted)] block">
            Preço final praticado
          </Label>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <Input
                ref={precoInputRef}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                defaultValue={proc.precoFinal ?? ""}
                placeholder="0,00"
                disabled={!podeEditar || precoMut.isPending}
                className={`${inputCls} font-mono tabular-nums text-right text-lg h-10`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = num(precoInputRef.current?.value ?? "");
                    if (!(v >= 0)) {
                      toast.error("Informe um preço válido");
                      return;
                    }
                    precoMut.mutate(v);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                const v = num(precoInputRef.current?.value ?? "");
                if (!(v >= 0)) {
                  toast.error("Informe um preço válido");
                  return;
                }
                precoMut.mutate(v);
              }}
              disabled={!podeEditar || precoMut.isPending}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
            >
              {precoMut.isPending ? (
                <>
                  <Save size={14} className="animate-pulse" /> Definindo…
                </>
              ) : (
                <>
                  <Save size={14} /> Definir preço
                </>
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-app-muted)] mb-1">
                Lucratividade final
              </div>
              <div
                className={`text-2xl font-mono tabular-nums ${
                  calc && isFinite(calc.lucratividadeFinal)
                    ? calc.lucratividadeFinal >= 0
                      ? "text-[var(--accent-app-text)]"
                      : "text-[var(--danger-app)]"
                    : "text-[var(--text-app-faint)]"
                }`}
              >
                {calc && isFinite(calc.lucratividadeFinal)
                  ? pct(calc.lucratividadeFinal)
                  : "—"}
              </div>
            </div>
          </div>
          {proc.precoFinal == null || proc.precoFinal <= 0 ? (
            <p className="text-[11px] text-[var(--text-app-muted)]">
              Defina um preço final para calcular a lucratividade real —
              considera os mesmos custos e percentuais, descontando o lucro
              desejado.
            </p>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Parameter field (uncontrolled input + onBlur commit + salvando highlight)
// ---------------------------------------------------------------------------
function ParamField({
  label,
  type,
  step,
  min,
  max,
  defaultValue,
  onBlur,
  disabled,
  salvando,
}: {
  label: string;
  type: string;
  step?: string;
  min?: string;
  max?: string;
  defaultValue: number | string;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  disabled: boolean;
  salvando: boolean;
}) {
  return (
    <div>
      <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
        {label}
      </Label>
      <Input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        onBlur={onBlur}
        disabled={disabled}
        className={`${inputCls} font-mono tabular-nums text-right ${
          disabled ? "opacity-70" : ""
        } ${salvando ? "ring-2 ring-[var(--accent-app)]/30" : ""}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insumo row (uncontrolled native select + uncontrolled input + actions)
// ---------------------------------------------------------------------------
function InsumoRow({
  item,
  insumos,
  usedInsumoIds,
  podeEditar,
  custoUnitario,
  onTrocarInsumo,
  onSalvarQuantidade,
  onRemover,
  salvando,
}: {
  item: ItemProcedimento;
  insumos: Insumo[];
  usedInsumoIds: Set<string>;
  podeEditar: boolean;
  custoUnitario: number;
  onTrocarInsumo: (novoInsumoId: string, quantidade: number) => void;
  onSalvarQuantidade: (quantidade: number) => void;
  onRemover: () => void;
  salvando: boolean;
}) {
  const availableInsumos = insumos.filter(
    (i) => i.id === item.insumoId || !usedInsumoIds.has(i.id)
  );

  return (
    <div
      className={`grid grid-cols-[1fr_80px_110px_40px] gap-2 px-5 py-2 border-b border-[var(--border-app-subtle)] last:border-0 items-center text-sm ${
        salvando ? "bg-[var(--accent-app-soft-bg)]/40" : ""
      }`}
    >
      <select
        defaultValue={item.insumoId}
        onChange={(e) =>
          onTrocarInsumo(e.target.value, num(item.quantidade))
        }
        disabled={!podeEditar || salvando}
        className={`w-full h-8 px-2 rounded-md border ${inputCls} text-sm bg-[var(--surface-app)] ${
          podeEditar ? "" : "opacity-70"
        }`}
      >
        {availableInsumos.length === 0 && (
          <option value={item.insumoId}>{item.insumoNome ?? item.insumoId}</option>
        )}
        {availableInsumos.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nome}
          </option>
        ))}
      </select>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        defaultValue={num(item.quantidade)}
        onBlur={(e) => {
          const v = num(e.currentTarget.value);
          if (v === num(item.quantidade)) return;
          if (!(v >= 0)) {
            toast.error("Quantidade inválida");
            return;
          }
          onSalvarQuantidade(v);
        }}
        disabled={!podeEditar || salvando}
        className={`${inputCls} font-mono tabular-nums text-right h-8`}
      />
      <div className="text-right font-mono tabular-nums text-[var(--text-app-muted)] text-sm">
        {brl(num(item.quantidade) * custoUnitario)}
      </div>
      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemover}
          disabled={!podeEditar || salvando}
          title="Remover insumo"
          className="h-8 w-8 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}
