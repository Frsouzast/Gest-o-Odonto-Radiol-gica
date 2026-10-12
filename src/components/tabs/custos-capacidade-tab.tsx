"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Clock,
  Timer,
  Gauge,
  Package,
  Search,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

import { ApiHttpError, apiFetch, useAuth } from "@/lib/auth-store";
import { brl, num } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from "@/components/ui/table";

// ----------------------------------------------------------------------------
// Types (mirror T2-b API contract)
// ----------------------------------------------------------------------------
interface Despesa {
  id: string;
  clinicaId: string;
  nome: string;
  valor: number;
  ordem: number;
}

interface Capacidade {
  clinicaId: string;
  diasTrabalhados: number;
  horasPorDia: number;
  unidadesRenda: number;
  percentOcupacao: number; // 0..1 decimal
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

interface Resumo {
  custoFixoTotal: number;
  depreciacaoMensalTotal: number;
  horasEfetivas: number;
  custoFixoPorHora: number;
  custoFixoPorMinuto: number;
}

// ----------------------------------------------------------------------------
// Shared style helpers
// ----------------------------------------------------------------------------
const inputCls =
  "bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] placeholder:text-[var(--text-app-faint)] focus-visible:border-[var(--accent-app)] focus-visible:ring-[var(--accent-app)]/25";

const cellInputCls =
  "h-8 px-2 py-0.5 bg-transparent border-b border-[var(--border-app-strong)] hover:border-[var(--accent-app)] focus-visible:border-[var(--accent-app)] focus-visible:ring-0 focus-visible:ring-transparent rounded-none";

// ----------------------------------------------------------------------------
// Small UI primitives
// ----------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
      <div className="px-4 py-3 flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
            accent
              ? "bg-[var(--accent-app-soft-bg)] text-[var(--accent-app-text)]"
              : "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-app-muted)] truncate">
            {label}
          </div>
          <div
            className={`text-xl font-mono tabular-nums ${
              accent ? "text-[var(--accent-app-text)]" : "text-[var(--text-app)]"
            }`}
          >
            {value}
          </div>
          {sub && (
            <div className="text-[11px] text-[var(--text-app-muted)] mt-0.5 truncate">
              {sub}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

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

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="px-4 py-3 space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton
              key={j}
              className="h-7 flex-1 bg-[var(--bg-app-alt-strong)]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 1. Despesas fixas
// ----------------------------------------------------------------------------
function DespesasPanel() {
  const podeEditar = useAuth((s) => s.podeEditar());
  const queryClient = useQueryClient();

  const q = useQuery<Despesa[]>({
    queryKey: ["despesas"],
    queryFn: () => apiFetch<Despesa[]>("/api/despesas"),
  });

  const [novoNome, setNovoNome] = useState("");
  const [novoValor, setNovoValor] = useState("");

  const total = useMemo(
    () => (q.data ?? []).reduce((acc, d) => acc + num(d.valor), 0),
    [q.data]
  );

  const addMut = useMutation({
    mutationFn: (vars: { nome: string; valor: number }) =>
      apiFetch<Despesa>("/api/despesas", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      setNovoNome("");
      setNovoValor("");
      toast.success("Despesa adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const putMut = useMutation({
    mutationFn: (vars: { id: string; nome: string; valor: number }) =>
      apiFetch<Despesa>(`/api/despesas/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify({ nome: vars.nome, valor: vars.valor }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Despesa atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/despesas/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Despesa removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAdd() {
    const nome = novoNome.trim();
    const valor = num(novoValor);
    if (!nome) {
      toast.error("Informe o nome da despesa");
      return;
    }
    if (!(valor >= 0)) {
      toast.error("Informe um valor válido");
      return;
    }
    addMut.mutate({ nome, valor });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Despesas fixas mensais
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {(q.data ?? []).length}{" "}
            {(q.data ?? []).length === 1 ? "item" : "itens"}
          </span>
        </div>

        {/* Inline add form */}
        {podeEditar && (
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Nome da despesa
              </Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Aluguel, Energia, Internet…"
                className={inputCls}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <div className="w-full sm:w-40">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Valor médio (R$)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="0,00"
                className={`${inputCls} font-mono tabular-nums text-right`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={addMut.isPending}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] shrink-0"
            >
              <Plus size={14} />
              {addMut.isPending ? "Adicionando…" : "Adicionar"}
            </Button>
          </div>
        )}

        {/* Table / states */}
        {q.isLoading ? (
          <TableSkeleton cols={3} />
        ) : q.isError ? (
          <ErrorState
            message={q.error?.message ?? "Falha ao carregar despesas"}
            onRetry={() => q.refetch()}
          />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Wallet size={22} strokeWidth={1.5} />}
            title="Nenhuma despesa cadastrada"
            hint={
              podeEditar
                ? "Use o formulário acima para adicionar aluguel, energia, salários, etc. Esses custos entram no cálculo do custo fixo por minuto."
                : "Aguarde o gestor cadastrar as despesas fixas da clínica."
            }
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Despesa
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-40">
                    Valor médio mensal
                  </TableHead>
                  <TableHead className="w-12 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((d) => (
                  <DespesaRow
                    key={d.id}
                    despesa={d}
                    podeEditar={podeEditar}
                    onSalvar={(nome, valor) =>
                      putMut.mutate({ id: d.id, nome, valor })
                    }
                    onRemover={() => delMut.mutate(d.id)}
                    salvando={putMut.isPending && putMut.variables?.id === d.id}
                  />
                ))}
              </TableBody>
              <TableFooter className="bg-[var(--bg-app)] border-t border-[var(--border-app)] font-medium">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--text-app-muted)]">
                    Total
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app)]">
                    {brl(total)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[var(--text-app-muted)] px-1">
        As despesas fixas compõem o custo fixo mensal da clínica e entram no
        rateio por minuto para a precificação de procedimentos.
      </p>
    </motion.div>
  );
}

function DespesaRow({
  despesa,
  podeEditar,
  onSalvar,
  onRemover,
  salvando,
}: {
  despesa: Despesa;
  podeEditar: boolean;
  onSalvar: (nome: string, valor: number) => void;
  onRemover: () => void;
  salvando: boolean;
}) {
  // Uncontrolled inputs with defaultValue + key={d.id} (from parent).
  // Initial value comes from the server on first mount; subsequent refetches
  // with the same id keep the user's local edits (no re-init).
  function commitNome(novoNome: string) {
    const n = novoNome.trim();
    if (!n) {
      toast.error("Nome não pode ser vazio");
      return;
    }
    if (n !== despesa.nome) {
      onSalvar(n, num(despesa.valor));
    }
  }

  function commitValor(novoValor: string) {
    const v = num(novoValor);
    if (!(v >= 0)) {
      toast.error("Valor inválido");
      return;
    }
    if (v !== num(despesa.valor)) {
      onSalvar(despesa.nome, v);
    }
  }

  return (
    <TableRow className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40">
      <TableCell className="px-4 py-1.5">
        <Input
          defaultValue={despesa.nome}
          onBlur={(e) => commitNome(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={despesa.valor ?? 0}
          onBlur={(e) => commitValor(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} text-right font-mono tabular-nums ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-2 text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
          onClick={onRemover}
          disabled={!podeEditar || salvando}
          title="Remover despesa"
        >
          <Trash2 size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------------
// 2. Capacidade produtiva
// ----------------------------------------------------------------------------
const CAPACIDADE_DEFAULTS: Capacidade = {
  clinicaId: "",
  diasTrabalhados: 20,
  horasPorDia: 8,
  unidadesRenda: 1,
  percentOcupacao: 0.75,
};

function CapacidadePanel() {
  const capQ = useQuery<Capacidade | null>({
    queryKey: ["capacidade"],
    queryFn: () => apiFetch<Capacidade | null>("/api/capacidade"),
  });

  // Aux queries to compute custoFixoPorHora preview from despesas+ativos
  const despesasQ = useQuery<Despesa[]>({
    queryKey: ["despesas"],
    queryFn: () => apiFetch<Despesa[]>("/api/despesas"),
  });
  const ativosQ = useQuery<Ativo[]>({
    queryKey: ["ativos"],
    queryFn: () => apiFetch<Ativo[]>("/api/ativos"),
  });

  const custoFixo = useMemo(() => {
    const desp = (despesasQ.data ?? []).reduce((a, d) => a + num(d.valor), 0);
    const dep = (ativosQ.data ?? []).reduce(
      (a, x) =>
        a +
        (num(x.vidaUtilAnos) > 0
          ? num(x.valorAquisicao) / num(x.vidaUtilAnos) / 12
          : 0),
      0
    );
    return desp + dep;
  }, [despesasQ.data, ativosQ.data]);

  if (capQ.isLoading) {
    return (
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="p-5 space-y-4">
          <Skeleton className="h-5 w-48 bg-[var(--bg-app-alt-strong)]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-16 bg-[var(--bg-app-alt-strong)]"
              />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (capQ.isError) {
    return (
      <ErrorState
        message={capQ.error?.message ?? "Falha ao carregar capacidade"}
        onRetry={() => capQ.refetch()}
      />
    );
  }

  const semCapacidade = capQ.isSuccess && capQ.data === null;
  // `key` forces remount (and re-init of useState) when transitioning from
  // null → configured capacidade. Stable id while the same data is shown.
  const formKey = capQ.data?.clinicaId ?? "novo";

  return (
    <CapacidadeForm
      key={formKey}
      initial={capQ.data ?? CAPACIDADE_DEFAULTS}
      semCapacidade={semCapacidade}
      custoFixo={custoFixo}
    />
  );
}

function CapacidadeForm({
  initial,
  semCapacidade,
  custoFixo,
}: {
  initial: Capacidade;
  semCapacidade: boolean;
  custoFixo: number;
}) {
  const podeEditar = useAuth((s) => s.podeEditar());
  const queryClient = useQueryClient();

  // Local state initialized once per mount (parent uses `key` to remount when
  // the underlying capacidade changes between null↔configured).
  const [dias, setDias] = useState(String(initial.diasTrabalhados ?? 0));
  const [horas, setHoras] = useState(String(initial.horasPorDia ?? 0));
  const [unidades, setUnidades] = useState(String(initial.unidadesRenda ?? 0));
  const [pct, setPct] = useState(
    String(((initial.percentOcupacao ?? 0) * 100).toFixed(0))
  ); // 0..100 in UI

  const temCustos = custoFixo > 0;

  const horasEfetivas = useMemo(() => {
    const d = num(dias);
    const h = num(horas);
    const u = num(unidades);
    const o = num(pct) / 100;
    return d * h * u * o;
  }, [dias, horas, unidades, pct]);

  const custoFixoPorHora =
    horasEfetivas > 0 && temCustos ? custoFixo / horasEfetivas : null;
  const custoFixoPorMinuto =
    horasEfetivas > 0 && temCustos ? custoFixo / (horasEfetivas * 60) : null;

  const saveMut = useMutation({
    mutationFn: (vars: {
      diasTrabalhados: number;
      horasPorDia: number;
      unidadesRenda: number;
      percentOcupacao: number;
    }) =>
      apiFetch<Capacidade>("/api/capacidade", {
        method: "PUT",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacidade"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Capacidade produtiva salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSalvar() {
    const d = num(dias);
    const h = num(horas);
    const u = num(unidades);
    const o = num(pct) / 100;
    if (!(d > 0) || !(h > 0) || !(u > 0)) {
      toast.error("Dias, horas e unidades devem ser maiores que zero");
      return;
    }
    if (!(o >= 0 && o <= 1)) {
      toast.error("Ocupação deve estar entre 0% e 100%");
      return;
    }
    saveMut.mutate({
      diasTrabalhados: d,
      horasPorDia: h,
      unidadesRenda: u,
      percentOcupacao: o,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {semCapacidade && (
        <Card className="bg-[var(--warning-app-bg)] border-[var(--warning-app-border)] py-0 shadow-none">
          <div className="px-4 py-3 flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="text-[var(--warning-app)] shrink-0 mt-0.5"
              strokeWidth={1.75}
            />
            <div className="text-sm text-[var(--warning-app-strong)]">
              <div className="font-medium">
                Configure a capacidade produtiva para começar
              </div>
              <div className="text-xs text-[var(--warning-app)] mt-0.5">
                Sem essa configuração não é possível calcular o custo fixo por
                minuto utilizado na precificação. Já preenchemos valores
                sugeridos — ajuste e salve.
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Capacidade produtiva mensal
          </h3>
          {podeEditar && (
            <Button
              type="button"
              size="sm"
              onClick={handleSalvar}
              disabled={saveMut.isPending}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
            >
              {saveMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CapacidadeField
            label="Dias trabalhados / mês"
            value={dias}
            onChange={setDias}
            disabled={!podeEditar}
          />
          <CapacidadeField
            label="Horas por dia"
            value={horas}
            onChange={setHoras}
            disabled={!podeEditar}
          />
          <CapacidadeField
            label="Unidades de renda"
            hint="Salas ou aparelhos que atendem ao mesmo tempo"
            value={unidades}
            onChange={setUnidades}
            disabled={!podeEditar}
          />
          <CapacidadeField
            label="% de ocupação"
            hint="Ex.: 75% = 6 horas usadas em um dia de 8 horas"
            suffix="%"
            step="1"
            value={pct}
            onChange={setPct}
            disabled={!podeEditar}
          />
        </div>

        {num(pct) <= 0 && <p role="alert" className="px-4 pb-3 text-sm text-[var(--warning-app)]">Com ocupação de 0%, não há tempo de atendimento para dividir os custos. Você pode salvar essa configuração, mas os preços sugeridos ficam indisponíveis até informar ocupação acima de zero.</p>}

        {/* Computed summary */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-[var(--border-app-subtle)] bg-[var(--bg-app)] p-3">
            <SummaryItem
              icon={<Timer size={15} strokeWidth={1.75} />}
              label="Horas efetivas / mês"
              value={`${horasEfetivas.toFixed(0)}h`}
            />
            <SummaryItem
              icon={<Clock size={15} strokeWidth={1.75} />}
              label="Custo fixo / hora"
              value={custoFixoPorHora !== null ? brl(custoFixoPorHora) : "—"}
              accent
            />
            <SummaryItem
              icon={<Gauge size={15} strokeWidth={1.75} />}
              label="Custo fixo / minuto"
              value={
                custoFixoPorMinuto !== null ? brl(custoFixoPorMinuto) : "—"
              }
              accent
            />
          </div>
          {!temCustos && (
            <p className="text-[11px] text-[var(--text-app-muted)] mt-2">
              Cadastre despesas fixas ou equipamentos na aba correspondente
              para calcular o custo fixo por hora.
            </p>
          )}
        </div>
      </Card>

      <p className="text-[11px] text-[var(--text-app-muted)] px-1">
        Horas efetivas = dias × horas por dia × unidades × ocupação. Esse
        número divide o custo fixo total para chegar ao custo por hora (e por
        minuto) usado na precificação.
      </p>
    </motion.div>
  );
}

function CapacidadeField({
  label,
  value,
  onChange,
  disabled,
  hint,
  suffix,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <div>
      <Label className="text-[11px] text-[var(--text-app-muted)] block mb-1">
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step={step ?? "1"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${inputCls} font-mono tabular-nums text-right pr-8`}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-app-muted)]">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <div className="text-[10px] text-[var(--text-app-faint)] mt-1">
          {hint}
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-7 h-7 rounded-md grid place-items-center shrink-0 ${
          accent
            ? "bg-[var(--accent-app-soft-bg)] text-[var(--accent-app-text)]"
            : "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-[var(--text-app-muted)] truncate">
          {label}
        </div>
        <div
          className={`text-base font-mono tabular-nums ${
            accent ? "text-[var(--accent-app-text)]" : "text-[var(--text-app)]"
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 3. Ativos / Equipamentos
// ----------------------------------------------------------------------------
function AtivosPanel() {
  const podeEditar = useAuth((s) => s.podeEditar());
  const queryClient = useQueryClient();

  const q = useQuery<Ativo[]>({
    queryKey: ["ativos"],
    queryFn: () => apiFetch<Ativo[]>("/api/ativos"),
  });

  const [novoNome, setNovoNome] = useState("");
  const [novoData, setNovoData] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoVida, setNovoVida] = useState("");

  const depTotal = useMemo(
    () =>
      (q.data ?? []).reduce(
        (a, x) =>
          a +
          (num(x.vidaUtilAnos) > 0
            ? num(x.valorAquisicao) / num(x.vidaUtilAnos) / 12
            : 0),
        0
      ),
    [q.data]
  );

  const addMut = useMutation({
    mutationFn: (vars: {
      nome: string;
      dataAquisicao: string | null;
      valorAquisicao: number;
      vidaUtilAnos: number;
    }) =>
      apiFetch<Ativo>("/api/ativos", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ativos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      setNovoNome("");
      setNovoData("");
      setNovoValor("");
      setNovoVida("");
      toast.success("Equipamento adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const putMut = useMutation({
    mutationFn: (vars: {
      id: string;
      nome?: string;
      dataAquisicao?: string | null;
      valorAquisicao?: number;
      vidaUtilAnos?: number;
    }) =>
      apiFetch<Ativo>(`/api/ativos/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(vars.nome !== undefined ? { nome: vars.nome } : {}),
          ...(vars.dataAquisicao !== undefined
            ? { dataAquisicao: vars.dataAquisicao }
            : {}),
          ...(vars.valorAquisicao !== undefined
            ? { valorAquisicao: vars.valorAquisicao }
            : {}),
          ...(vars.vidaUtilAnos !== undefined
            ? { vidaUtilAnos: vars.vidaUtilAnos }
            : {}),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ativos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Equipamento atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/ativos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ativos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Equipamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAdd() {
    const nome = novoNome.trim();
    if (!nome) {
      toast.error("Informe o nome do equipamento");
      return;
    }
    addMut.mutate({
      nome,
      dataAquisicao: novoData || null,
      valorAquisicao: num(novoValor),
      vidaUtilAnos: num(novoVida) || 1,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Equipamentos e móveis (depreciação)
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {(q.data ?? []).length}{" "}
            {(q.data ?? []).length === 1 ? "item" : "itens"}
          </span>
        </div>

        {podeEditar && (
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Nome
              </Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Panorâmico, Computador…"
                className={inputCls}
              />
            </div>
            <div>
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Aquisição
              </Label>
              <Input
                type="date"
                value={novoData}
                onChange={(e) => setNovoData(e.target.value)}
                className={`${inputCls} font-mono tabular-nums`}
              />
            </div>
            <div>
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Valor pago (R$)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="0,00"
                className={`${inputCls} text-right font-mono tabular-nums`}
              />
            </div>
            <div>
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Vida útil (anos)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min="1"
                value={novoVida}
                onChange={(e) => setNovoVida(e.target.value)}
                placeholder="5"
                className={`${inputCls} text-right font-mono tabular-nums`}
              />
            </div>
            <div className="lg:col-span-5 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                disabled={addMut.isPending}
                className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
              >
                <Plus size={14} />
                {addMut.isPending ? "Adicionando…" : "Adicionar equipamento"}
              </Button>
            </div>
          </div>
        )}

        {q.isLoading ? (
          <TableSkeleton cols={5} />
        ) : q.isError ? (
          <ErrorState
            message={q.error?.message ?? "Falha ao carregar equipamentos"}
            onRetry={() => q.refetch()}
          />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Package size={22} strokeWidth={1.5} />}
            title="Nenhum equipamento cadastrado"
            hint={
              podeEditar
                ? "Cadastre equipamentos e móveis para incluir a depreciação mensal no custo fixo da clínica."
                : "Aguarde o gestor cadastrar os equipamentos."
            }
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Equipamento
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-36">
                    Aquisição
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-32">
                    Valor pago
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-28">
                    Vida útil (anos)
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-32">
                    Depreciação / mês
                  </TableHead>
                  <TableHead className="w-12 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((a) => (
                  <AtivoRow
                    key={a.id}
                    ativo={a}
                    podeEditar={podeEditar}
                    onSalvar={(vars) => putMut.mutate({ id: a.id, ...vars })}
                    onRemover={() => delMut.mutate(a.id)}
                    salvando={putMut.isPending && putMut.variables?.id === a.id}
                  />
                ))}
              </TableBody>
              <TableFooter className="bg-[var(--bg-app)] border-t border-[var(--border-app)] font-medium">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell
                    className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--text-app-muted)]"
                    colSpan={4}
                  >
                    Depreciação mensal total
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app)]">
                    {brl(depTotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[var(--text-app-muted)] px-1">
        Depreciação mensal = valor pago ÷ vida útil (anos) ÷ 12. Entra
        automaticamente no custo fixo total, junto com as despesas fixas.
      </p>
    </motion.div>
  );
}

function AtivoRow({
  ativo,
  podeEditar,
  onSalvar,
  onRemover,
  salvando,
}: {
  ativo: Ativo;
  podeEditar: boolean;
  onSalvar: (vars: {
    nome?: string;
    dataAquisicao?: string | null;
    valorAquisicao?: number;
    vidaUtilAnos?: number;
  }) => void;
  onRemover: () => void;
  salvando: boolean;
}) {
  // Uncontrolled inputs; parent uses `key={a.id}` to remount when row id changes.
  const dep =
    num(ativo.vidaUtilAnos) > 0
      ? num(ativo.valorAquisicao) / num(ativo.vidaUtilAnos) / 12
      : 0;

  function commitNome(v: string) {
    const n = v.trim();
    if (!n) {
      toast.error("Nome não pode ser vazio");
      return;
    }
    if (n !== ativo.nome) onSalvar({ nome: n });
  }

  function commitData(v: string) {
    if (v !== (ativo.dataAquisicao ?? "")) {
      onSalvar({ dataAquisicao: v || null });
    }
  }

  function commitValor(v: string) {
    const n = num(v);
    if (!(n >= 0)) {
      toast.error("Valor inválido");
      return;
    }
    if (n !== num(ativo.valorAquisicao)) {
      onSalvar({ valorAquisicao: n });
    }
  }

  function commitVida(v: string) {
    const n = num(v);
    if (!(n >= 0)) {
      toast.error("Vida útil inválida");
      return;
    }
    if (n !== num(ativo.vidaUtilAnos)) {
      onSalvar({ vidaUtilAnos: n });
    }
  }

  return (
    <TableRow className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40">
      <TableCell className="px-4 py-1.5">
        <Input
          defaultValue={ativo.nome}
          onBlur={(e) => commitNome(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5">
        <Input
          type="date"
          defaultValue={ativo.dataAquisicao ?? ""}
          onBlur={(e) => commitData(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} font-mono tabular-nums ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={ativo.valorAquisicao ?? 0}
          onBlur={(e) => commitValor(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} text-right font-mono tabular-nums ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5">
        <Input
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          defaultValue={ativo.vidaUtilAnos ?? 0}
          onBlur={(e) => commitVida(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} text-right font-mono tabular-nums ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
        {brl(dep)}
      </TableCell>
      <TableCell className="px-2 text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
          onClick={onRemover}
          disabled={!podeEditar || salvando}
          title="Remover equipamento"
        >
          <Trash2 size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------------
// 4. Insumos
// ----------------------------------------------------------------------------
function InsumosPanel() {
  const podeEditar = useAuth((s) => s.podeEditar());
  const queryClient = useQueryClient();

  const q = useQuery<Insumo[]>({
    queryKey: ["insumos"],
    queryFn: () => apiFetch<Insumo[]>("/api/insumos"),
  });

  const [busca, setBusca] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoUnidade, setNovoUnidade] = useState("un");
  const [novoValor, setNovoValor] = useState("");
  const [novoQtd, setNovoQtd] = useState("");

  const filtrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const lista = q.data ?? [];
    if (!term) return lista;
    return lista.filter((i) => i.nome?.toLowerCase().includes(term));
  }, [q.data, busca]);

  const addMut = useMutation({
    mutationFn: (vars: {
      nome: string;
      unidade: string;
      valorTotal: number;
      quantidade: number;
    }) =>
      apiFetch<Insumo>("/api/insumos", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insumos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      setNovoNome("");
      setNovoUnidade("un");
      setNovoValor("");
      setNovoQtd("");
      toast.success("Insumo adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const putMut = useMutation({
    mutationFn: (vars: {
      id: string;
      nome?: string;
      unidade?: string;
      valorTotal?: number;
      quantidade?: number;
    }) =>
      apiFetch<Insumo>(`/api/insumos/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(vars.nome !== undefined ? { nome: vars.nome } : {}),
          ...(vars.unidade !== undefined ? { unidade: vars.unidade } : {}),
          ...(vars.valorTotal !== undefined
            ? { valorTotal: vars.valorTotal }
            : {}),
          ...(vars.quantidade !== undefined
            ? { quantidade: vars.quantidade }
            : {}),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insumos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Insumo atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/insumos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insumos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Insumo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAdd() {
    const nome = novoNome.trim();
    if (!nome) {
      toast.error("Informe o nome do insumo");
      return;
    }
    addMut.mutate({
      nome,
      unidade: novoUnidade.trim() || "un",
      valorTotal: num(novoValor),
      quantidade: num(novoQtd) || 1,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <Card className="bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none">
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Catálogo de insumos e consumíveis
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {(q.data ?? []).length}{" "}
            {(q.data ?? []).length === 1 ? "item" : "itens"}
          </span>
        </div>

        {/* Search box */}
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)]">
          <div className="relative max-w-sm">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-app-muted)] pointer-events-none"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por nome…"
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        {podeEditar && (
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Nome
              </Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Filme radiográfico…"
                className={inputCls}
              />
            </div>
            <div className="lg:col-span-2">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Unidade
              </Label>
              <Input
                value={novoUnidade}
                onChange={(e) => setNovoUnidade(e.target.value)}
                placeholder="un"
                className={inputCls}
              />
            </div>
            <div className="lg:col-span-3">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Valor total (R$)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="0,00"
                className={`${inputCls} text-right font-mono tabular-nums`}
              />
            </div>
            <div className="lg:col-span-2">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Quantidade
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={novoQtd}
                onChange={(e) => setNovoQtd(e.target.value)}
                placeholder="1"
                className={`${inputCls} text-right font-mono tabular-nums`}
              />
            </div>
            <div className="lg:col-span-1 flex items-end">
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                disabled={addMut.isPending}
                className="w-full bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
              >
                <Plus size={14} />
                {addMut.isPending ? "…" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {q.isLoading ? (
          <TableSkeleton cols={5} />
        ) : q.isError ? (
          <ErrorState
            message={q.error?.message ?? "Falha ao carregar insumos"}
            onRetry={() => q.refetch()}
          />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Package size={22} strokeWidth={1.5} />}
            title="Nenhum insumo cadastrado"
            hint={
              podeEditar
                ? "Cadastre insumos e consumíveis para compor o custo de procedimentos."
                : "Aguarde o gestor cadastrar o catálogo de insumos."
            }
          />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} strokeWidth={1.5} />}
            title="Nenhum insumo encontrado"
            hint={`Nada corresponde a "${busca}". Tente outro termo.`}
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Item
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-24">
                    Unidade
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-32">
                    Valor total (R$)
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-28">
                    Quantidade
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2 w-32">
                    Custo unitário
                  </TableHead>
                  <TableHead className="w-12 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((it) => (
                  <InsumoRow
                    key={it.id}
                    insumo={it}
                    podeEditar={podeEditar}
                    onSalvar={(vars) => putMut.mutate({ id: it.id, ...vars })}
                    onRemover={() => delMut.mutate(it.id)}
                    salvando={putMut.isPending && putMut.variables?.id === it.id}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[var(--text-app-muted)] px-1">
        Custo unitário = valor total ÷ quantidade. Usado para calcular o custo
        de insumos consumidos em cada procedimento.
      </p>
    </motion.div>
  );
}

function InsumoRow({
  insumo,
  podeEditar,
  onSalvar,
  onRemover,
  salvando,
}: {
  insumo: Insumo;
  podeEditar: boolean;
  onSalvar: (vars: {
    nome?: string;
    unidade?: string;
    valorTotal?: number;
    quantidade?: number;
  }) => void;
  onRemover: () => void;
  salvando: boolean;
}) {
  // Uncontrolled inputs; parent uses `key={insumo.id}` to remount when row id changes.
  function commitNome(v: string) {
    const n = v.trim();
    if (!n) {
      toast.error("Nome não pode ser vazio");
      return;
    }
    if (n !== insumo.nome) onSalvar({ nome: n });
  }

  function commitUnidade(v: string) {
    const u = v.trim() || "un";
    if (u !== (insumo.unidade ?? "")) onSalvar({ unidade: u });
  }

  function commitValor(v: string) {
    const n = num(v);
    if (!(n >= 0)) {
      toast.error("Valor inválido");
      return;
    }
    if (n !== num(insumo.valorTotal)) onSalvar({ valorTotal: n });
  }

  function commitQtd(v: string) {
    const n = num(v);
    if (!(n >= 0)) {
      toast.error("Quantidade inválida");
      return;
    }
    if (n !== num(insumo.quantidade)) onSalvar({ quantidade: n });
  }

  const custo =
    num(insumo.quantidade) > 0
      ? num(insumo.valorTotal) / num(insumo.quantidade)
      : 0;

  return (
    <TableRow className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40">
      <TableCell className="px-4 py-1.5">
        <Input
          defaultValue={insumo.nome}
          onBlur={(e) => commitNome(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5">
        <Input
          defaultValue={insumo.unidade ?? ""}
          onBlur={(e) => commitUnidade(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} text-center ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={insumo.valorTotal ?? 0}
          onBlur={(e) => commitValor(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} text-right font-mono tabular-nums ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={insumo.quantidade ?? 0}
          onBlur={(e) => commitQtd(e.currentTarget.value)}
          disabled={!podeEditar || salvando}
          className={`${inputCls} ${cellInputCls} text-right font-mono tabular-nums ${
            podeEditar ? "" : "opacity-70"
          }`}
        />
      </TableCell>
      <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
        {brl(custo)}
      </TableCell>
      <TableCell className="px-2 text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
          onClick={onRemover}
          disabled={!podeEditar || salvando}
          title="Remover insumo"
        >
          <Trash2 size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------------
// Resumo fetcher (returns null when capacidade is missing — HTTP 400)
// ----------------------------------------------------------------------------
async function fetchResumo(): Promise<Resumo | null> {
  return apiFetch<Resumo>("/api/resumo");
}

// ----------------------------------------------------------------------------
// Summary card at the top of the tab
// ----------------------------------------------------------------------------
function ResumoCard() {
  const q = useQuery<Resumo | null>({
    queryKey: ["resumo"],
    queryFn: fetchResumo,
  });

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-20 bg-[var(--bg-app-alt-strong)] rounded-xl"
          />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <Card className="bg-[var(--danger-app-bg)] border-[var(--danger-app-border)] py-0 shadow-none">
        <div className="px-4 py-3 flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="text-[var(--danger-app)] shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <div className="text-sm">
            <div className="font-medium text-[var(--danger-app)]">
              {q.error instanceof ApiHttpError && q.error.status === 400 ? "Revise a configuração para calcular custos" : "Não foi possível carregar o resumo"}
            </div>
            <div className="text-xs text-[var(--danger-app)] mt-0.5">
              {q.error?.message ?? "Tente novamente mais tarde."}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (q.data === null) {
    return (
      <Card className="bg-[var(--warning-app-bg)] border-[var(--warning-app-border)] py-0 shadow-none">
        <div className="px-4 py-3 flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="text-[var(--warning-app)] shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <div className="text-sm">
            <div className="font-medium text-[var(--warning-app-strong)]">
              Configure a capacidade produtiva
            </div>
            <div className="text-xs text-[var(--warning-app)] mt-0.5">
              Sem a capacidade produtiva configurada não é possível calcular o
              custo fixo por minuto. Acesse a sub-aba “Capacidade produtiva”
              abaixo para começar.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (q.data === undefined) return null;

  const r = q.data;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      <StatCard
        label="Custo fixo total / mês"
        value={brl(r.custoFixoTotal)}
        sub={
          r.depreciacaoMensalTotal > 0
            ? `inclui ${brl(r.depreciacaoMensalTotal)} de depreciação`
            : undefined
        }
        icon={<Wallet size={16} strokeWidth={1.75} />}
      />
      <StatCard
        label="Depreciação mensal"
        value={brl(r.depreciacaoMensalTotal)}
        icon={<Package size={16} strokeWidth={1.75} />}
      />
      <StatCard
        label="Horas efetivas / mês"
        value={`${(r.horasEfetivas ?? 0).toFixed(0)}h`}
        icon={<Timer size={16} strokeWidth={1.75} />}
      />
      <StatCard
        label="Custo fixo / minuto"
        value={brl(r.custoFixoPorMinuto)}
        icon={<Gauge size={16} strokeWidth={1.75} />}
        accent
      />
    </motion.div>
  );
}

// ----------------------------------------------------------------------------
// Main exported component — 4 sub-panels via internal Tabs
// ----------------------------------------------------------------------------
export function CustosCapacidadeTab() {
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="p-4 sm:p-6 space-y-5">
        <ResumoCard />

        <Tabs defaultValue="despesas" className="gap-4">
          <TabsList className="bg-[var(--bg-app-alt-strong)] p-1 h-auto flex-wrap">
            <TabsTrigger
              value="despesas"
              className="data-[state=active]:bg-[var(--surface-app)] data-[state=active]:text-[var(--accent-app-text)] data-[state=active]:shadow-sm text-[var(--text-app-muted)] hover:text-[var(--text-app)] text-xs sm:text-sm"
            >
              Despesas fixas
            </TabsTrigger>
            <TabsTrigger
              value="capacidade"
              className="data-[state=active]:bg-[var(--surface-app)] data-[state=active]:text-[var(--accent-app-text)] data-[state=active]:shadow-sm text-[var(--text-app-muted)] hover:text-[var(--text-app)] text-xs sm:text-sm"
            >
              Capacidade produtiva
            </TabsTrigger>
            <TabsTrigger
              value="ativos"
              className="data-[state=active]:bg-[var(--surface-app)] data-[state=active]:text-[var(--accent-app-text)] data-[state=active]:shadow-sm text-[var(--text-app-muted)] hover:text-[var(--text-app)] text-xs sm:text-sm"
            >
              Equipamentos &amp; imobilizado
            </TabsTrigger>
            <TabsTrigger
              value="insumos"
              className="data-[state=active]:bg-[var(--surface-app)] data-[state=active]:text-[var(--accent-app-text)] data-[state=active]:shadow-sm text-[var(--text-app-muted)] hover:text-[var(--text-app)] text-xs sm:text-sm"
            >
              Insumos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="despesas" className="outline-none">
            <DespesasPanel />
          </TabsContent>
          <TabsContent value="capacidade" className="outline-none">
            <CapacidadePanel />
          </TabsContent>
          <TabsContent value="ativos" className="outline-none">
            <AtivosPanel />
          </TabsContent>
          <TabsContent value="insumos" className="outline-none">
            <InsumosPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
