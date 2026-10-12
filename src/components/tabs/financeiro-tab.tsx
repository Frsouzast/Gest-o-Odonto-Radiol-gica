"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  LayoutGrid,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  FileWarning,
  ScrollText,
  TrendingUp,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  Landmark,
  Inbox,
  Pencil,
  Save,
  CalendarDays,
  Banknote,
  Info,
  Receipt,
  BadgeCheck,
  Clock,
  Download,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { apiFetch, useAuth } from "@/lib/auth-store";
import { brl, pct, num, hoje, mesAtual, dataBR, cn, nomeMes } from "@/lib/utils";
import { exportarCSV, imprimirTabela, fmtBRL, fmtPct } from "@/lib/export";
import { onNovoItem } from "@/lib/atalhos";
import {
  Tooltip as UITooltip,
  TooltipTrigger as UITooltipTrigger,
  TooltipContent as UITooltipContent,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
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
// Types — mirror T2-e / T2-f API contracts (Prisma camelCase)
// ---------------------------------------------------------------------------
interface Procedimento {
  id: string;
  clinicaId: string;
  nome: string;
}

interface Convenio {
  id: string;
  clinicaId: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
  prazoMedioDias: number;
  ativo: boolean;
  criadoEm: string;
}

interface ConvenioTabelaPreco {
  id: string;
  convenioId: string;
  procedimentoId: string;
  valor: number;
  vigenciaInicio: string;
  criadoEm: string;
  procedimentoNome: string;
}

interface DespesaRecorrente {
  id: string;
  clinicaId: string;
  descricao: string;
  categoria: string | null;
  fornecedor: string | null;
  valor: number;
  diaVencimento: number;
  ativa: boolean;
}

interface ContaReceber {
  id: string;
  clinicaId: string;
  pacienteNome: string | null;
  procedimentoId: string | null;
  convenioId: string | null;
  dentistaSolicitante: string | null;
  dataExame: string;
  valorFaturado: number;
  valorPago: number | null;
  vencimento: string | null;
  status: string;
  dataRecebimento: string | null;
  loteId: string | null;
  criadoEm: string;
  convenioNome: string | null;
  procedimentoNome: string | null;
}

interface ContaPagar {
  id: string;
  clinicaId: string;
  descricao: string;
  categoria: string | null;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  status: string;
  dataPagamento: string | null;
  recorrenteId: string | null;
  criadoEm: string;
}

interface Glosa {
  id: string;
  contaReceberId: string;
  valor: number;
  motivo: string | null;
  status: string;
  valorRecuperado: number | null;
  criadoEm: string;
  pacienteNome: string | null;
  valorFaturado: number | null;
  dataExame: string | null;
  convenioNome: string | null;
  // Campos extras adicionados pelo backend em T7:
  diasEmRecurso: number;  // dias desde criadoEm (0 se não estiver em_recurso)
  atrasada: boolean;      // true quando status === 'em_recurso' && diasEmRecurso > 30
}

interface FinanceiroResumo {
  receitas: number;
  despesas: number;
  resultado: number;
  aReceber: number;
  aPagar: number;
  inadimplencia: number;
  receitaPorOrigem: { origem: string; valor: number }[];
}

interface DRE {
  receitaBruta: number;
  glosas: number;
  impostos: number;
  receitaLiquida: number;
  custosVariaveis: number;
  margemContribuicao: number;
  despesasFixas: number;
  resultadoOperacional: number;
}

interface GrupoRentabilidade {
  chave: string;
  receita: number;
  custo: number;
  quantidade: number;
  resultado: number;
  margem: number;
  ticketMedio: number;
}

interface RentabilidadePorEquipamento {
  equipamento: string;
  quantidade: number;
  receitaTotal: number;
  custoTotal: number;
  receitaPorHora: number;
  lucroPorHora: number;
  horas: number;
}

interface FluxoProjetado {
  dias: number;
  recebimentosPrevistos: number;
  pagamentosPrevistos: number;
  saldoProjetado: number;
}

interface Conciliacao {
  recebidoSistema: number;
  entradasBanco: number;
  diferencaEntradas: number;
  pagoSistema: number;
  saidasBanco: number;
  diferencaSaidas: number;
}

interface LoteFaturamento {
  id: string;
  clinicaId: string;
  convenioId: string;
  periodoInicio: string;
  periodoFim: string;
  quantidade: number;
  valor: number;
  usuarioId: string | null;
  fechadoEm: string;
  convenioNome: string | null;
}

interface MovimentoBancario {
  id: string;
  clinicaId: string;
  data: string;
  descricao: string | null;
  valor: number;
  conciliado: boolean;
}

interface ProducaoConvenio extends ContaReceber {
  pendencias: string[];
}

// ---------------------------------------------------------------------------
// Status configs (matches original FinanceiroModule.jsx, ported to *-app vars)
// ---------------------------------------------------------------------------
const STATUS_RECEBER: Record<string, { label: string; badge: string; descricao: string }> = {
  aberto: {
    label: "Em aberto",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]",
    descricao: "Aguardando pagamento do paciente ou convênio.",
  },
  recebido: {
    label: "Recebido",
    badge:
      "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
    descricao: "Pagamento recebido integralmente.",
  },
  vencido: {
    label: "Vencido",
    badge: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]",
    descricao: "Data de vencimento ultrapassada sem pagamento.",
  },
  parcial: {
    label: "Parcial",
    badge: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]",
    descricao: "Parte do valor foi recebido; resto ainda pendente.",
  },
  cancelado: {
    label: "Cancelado",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-faint)]",
    descricao: "Lançamento cancelado (não entra em relatórios).",
  },
};

const STATUS_PAGAR: Record<string, { label: string; badge: string; descricao: string }> = {
  aberto: {
    label: "Em aberto",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]",
    descricao: "Aguardando pagamento ao fornecedor.",
  },
  pago: {
    label: "Pago",
    badge:
      "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
    descricao: "Conta quitada integralmente.",
  },
  vencido: {
    label: "Vencido",
    badge: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]",
    descricao: "Vencimento ultrapassado sem pagamento.",
  },
  cancelado: {
    label: "Cancelado",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-faint)]",
    descricao: "Conta cancelada (não entra em relatórios).",
  },
};

const STATUS_GLOSA: Record<string, { label: string; badge: string; descricao: string }> = {
  glosada: {
    label: "Glosada",
    badge: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]",
    descricao: "Convênio recusou parte do valor faturado.",
  },
  em_recurso: {
    label: "Em recurso",
    badge: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]",
    descricao: "Clínica contestou a glosa; aguardando resposta do convênio.",
  },
  recuperada: {
    label: "Recuperada",
    badge:
      "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
    descricao: "Valor recuperado após recurso da clínica.",
  },
  perdida: {
    label: "Perdida",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-faint)]",
    descricao: "Recurso da clínica não aceito; valor definitivamente perdido.",
  },
};

// ---------------------------------------------------------------------------
// Shared style helpers (mirror T3-b / T3-c / T3-d)
// ---------------------------------------------------------------------------
const inputCls =
  "bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] placeholder:text-[var(--text-app-faint)] focus-visible:border-[var(--accent-app)] focus-visible:ring-[var(--accent-app)]/25";

const selectCls =
  "bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] focus-visible:border-[var(--accent-app)] focus-visible:ring-[var(--accent-app)]/25";

const cardCls =
  "bg-[var(--surface-app)] border-[var(--border-app)] py-0 shadow-none";

// ---------------------------------------------------------------------------
// Small UI primitives
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  warning,
  danger,
  descricao,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  warning?: boolean;
  danger?: boolean;
  descricao?: string;
}) {
  const labelEl = (
    <div className="text-[11px] uppercase tracking-wide text-[var(--text-app-muted)] truncate flex items-center gap-1">
      {label}
      {descricao && (
        <Info
          size={10}
          className="text-[var(--text-app-faint)] opacity-60 hover:opacity-100 shrink-0"
        />
      )}
    </div>
  );
  return (
    <Card className={`${cardCls} hover:shadow-md hover:shadow-[var(--accent-app)]/5 transition-all relative overflow-hidden`}>
      <div className="px-4 py-3 flex items-start gap-3 relative">
        {icon && (
          <div
            className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
              accent
                ? "bg-[var(--accent-app-soft-bg)] text-[var(--accent-app-text)]"
                : danger
                ? "bg-[var(--danger-app-bg)] text-[var(--danger-app)]"
                : warning
                ? "bg-[var(--warning-app-bg)] text-[var(--warning-app)]"
                : "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]"
            }`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {descricao ? (
            <UITooltip>
              <UITooltipTrigger asChild>
                <span className="cursor-help inline-flex">{labelEl}</span>
              </UITooltipTrigger>
              <UITooltipContent
                side="bottom"
                className="bg-[var(--text-app)] text-[var(--bg-app)] text-xs max-w-[200px] border-none"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold">{label}</div>
                  <div className="text-[11px] opacity-90">{descricao}</div>
                </div>
              </UITooltipContent>
            </UITooltip>
          ) : (
            labelEl
          )}
          <div
            className={`text-xl font-mono tabular-nums ${
              accent
                ? "text-[var(--accent-app-text)]"
                : danger
                ? "text-[var(--danger-app)]"
                : warning
                ? "text-[var(--warning-app)]"
                : "text-[var(--text-app)]"
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
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="mb-4">
        <div className="w-14 h-14 rounded-full bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)] grid place-items-center border border-[var(--border-app)]">
          {icon}
        </div>
      </div>
      <div className="text-sm font-semibold text-[var(--text-app)]">{title}</div>
      {hint && (
        <div className="text-xs text-[var(--text-app-muted)] mt-1.5 max-w-sm leading-relaxed">
          {hint}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[var(--danger-app)]/5 scale-150 blur-sm" />
        <div className="relative w-12 h-12 rounded-full bg-[var(--danger-app-bg)] text-[var(--danger-app)] grid place-items-center border border-[var(--danger-app-border)]">
          <AlertTriangle size={22} strokeWidth={1.5} />
        </div>
      </div>
      <div className="text-sm font-semibold text-[var(--text-app)]">Erro ao carregar</div>
      <div className="text-xs text-[var(--text-app-muted)] max-w-md leading-relaxed">
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
    </motion.div>
  );
}

function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-20 bg-[var(--bg-app-alt-strong)] rounded-xl"
        />
      ))}
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="px-4 py-3 space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
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

// ---------------------------------------------------------------------------
// Month picker — sticky at top of each sub-tab
// ---------------------------------------------------------------------------
function mudarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthPicker({
  mes,
  setMes,
}: {
  mes: string;
  setMes: (m: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-[var(--bg-app)] py-2 flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setMes(mudarMes(mes, -1))}
        className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
        title="Mês anterior"
      >
        <ChevronLeft size={16} />
      </Button>
      <input
        type="month"
        value={mes}
        onChange={(e) => setMes(e.target.value)}
        className={`border ${selectCls} rounded-md px-2.5 py-1 text-sm h-8`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setMes(mudarMes(mes, 1))}
        className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
        title="Próximo mês"
      >
        <ChevronRight size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMes(mesAtual())}
        className="h-8 text-[11px] text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
      >
        Hoje
      </Button>
    </div>
  );
}

// Reusable status badge com tooltip explicativo
function StatusBadge({
  status,
  config,
}: {
  status: string;
  config: Record<string, { label: string; badge: string; descricao?: string }>;
}) {
  const st = config[status] ?? { label: status, badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]" };
  const badge = (
    <span
      className={`text-[11px] rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap cursor-help ${st.badge}`}
    >
      {st.label}
    </span>
  );
  if (!st.descricao) return badge;
  return (
    <UITooltip>
      <UITooltipTrigger asChild>{badge}</UITooltipTrigger>
      <UITooltipContent
        side="top"
        className="bg-[var(--text-app)] text-[var(--bg-app)] text-xs max-w-[220px] border-none"
      >
        <div className="space-y-0.5">
          <div className="font-semibold">{st.label}</div>
          <div className="text-[11px] opacity-90">{st.descricao}</div>
        </div>
      </UITooltipContent>
    </UITooltip>
  );
}

// Chart tooltip styled with our app vars
function ChartTooltipBox({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color?: string }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-md px-3 py-2 text-xs shadow-lg">
      {label && (
        <div className="font-medium text-[var(--text-app)] mb-0.5">
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 text-[var(--text-app-secondary)]"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-[2px] inline-block"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="font-mono tabular-nums text-[var(--text-app)]">
            {formatter ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab — Tabs with 9 sub-panels
// ---------------------------------------------------------------------------
export function FinanceiroTab() {
  const podeEditar = useAuth((s) => s.podeEditar());
  const [subTab, setSubTab] = useState("dashboard");

  return (
    <div className="h-full overflow-y-auto scroll-thin p-4 sm:p-6 bg-[var(--bg-app)]">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-1.5 mb-4 text-[var(--accent-app-text)]">
          <Wallet size={16} />
          <span className="text-sm font-medium">Financeiro</span>
        </div>

        <Tabs value={subTab} onValueChange={setSubTab}>
          <TabsList className="flex-wrap h-auto bg-[var(--surface-app)] border border-[var(--border-app)] p-1 gap-0.5">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <LayoutGrid size={13} /> Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="receber"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <ArrowDownCircle size={13} /> Contas a receber
            </TabsTrigger>
            <TabsTrigger
              value="pagar"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <ArrowUpCircle size={13} /> Contas a pagar
            </TabsTrigger>
            <TabsTrigger
              value="convenios"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <Building2 size={13} /> Convênios
            </TabsTrigger>
            <TabsTrigger
              value="glosas"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <FileWarning size={13} /> Glosas
            </TabsTrigger>
            <TabsTrigger
              value="dre"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <ScrollText size={13} /> DRE
            </TabsTrigger>
            <TabsTrigger
              value="rentabilidade"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <TrendingUp size={13} /> Rentabilidade
            </TabsTrigger>
            <TabsTrigger
              value="lotes"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <PackageCheck size={13} /> Lotes
            </TabsTrigger>
            <TabsTrigger
              value="conciliacao"
              className="data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white data-[state=active]:shadow-sm text-[var(--text-app-secondary)]"
            >
              <Landmark size={13} /> Conciliação
            </TabsTrigger>
          </TabsList>

          {/* Only render the active panel — avoids mounting all 9 sub-tabs at once */}
          <AnimatePresence mode="wait">
            <motion.div
              key={subTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="mt-4 space-y-4"
            >
              {subTab === "dashboard" && <DashboardPanel />}
              {subTab === "receber" && <ContasReceberPanel podeEditar={podeEditar} />}
              {subTab === "pagar" && <ContasPagarPanel podeEditar={podeEditar} />}
              {subTab === "convenios" && <ConveniosPanel podeEditar={podeEditar} />}
              {subTab === "glosas" && <GlosasPanel podeEditar={podeEditar} />}
              {subTab === "dre" && <DREPanel />}
              {subTab === "rentabilidade" && <RentabilidadePanel />}
              {subTab === "lotes" && <LotesPanel podeEditar={podeEditar} />}
              {subTab === "conciliacao" && <ConciliacaoPanel podeEditar={podeEditar} />}
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Dashboard
// ---------------------------------------------------------------------------
function DashboardPanel() {
  const [mes, setMes] = useState<string>(mesAtual());

  const q = useQuery<FinanceiroResumo>({
    queryKey: ["financeiro", "resumo", mes],
    queryFn: () =>
      apiFetch<FinanceiroResumo>(
        `/api/financeiro/resumo?mes=${encodeURIComponent(mes)}`
      ),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <MonthPicker mes={mes} setMes={setMes} />

      {q.isLoading ? (
        <StatSkeleton />
      ) : q.isError ? (
        <ErrorState
          message={q.error?.message ?? "Falha ao carregar resumo"}
          onRetry={() => q.refetch()}
        />
      ) : !q.data ? null : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            label="Receitas do mês"
            value={brl(q.data.receitas)}
            icon={<ArrowDownCircle size={16} />}
            accent
            descricao="Soma dos valores recebidos (parcial ou total) neste mês."
          />
          <StatCard
            label="Despesas pagas"
            value={brl(q.data.despesas)}
            icon={<ArrowUpCircle size={16} />}
            descricao="Contas a pagar marcadas como 'pago' com vencimento neste mês."
          />
          <StatCard
            label="Resultado"
            value={brl(q.data.resultado)}
            sub={q.data.resultado >= 0 ? "Positivo" : "Negativo"}
            icon={<TrendingUp size={16} />}
            accent={q.data.resultado >= 0}
            danger={q.data.resultado < 0}
            descricao="Receitas menos despesas pagas. Não inclui contas em aberto."
          />
          <StatCard
            label="A receber"
            value={brl(q.data.aReceber)}
            icon={<Receipt size={16} />}
            descricao="Soma das contas a receber em aberto (status 'aberto', 'vencido' ou 'parcial')."
          />
          <StatCard
            label="A pagar"
            value={brl(q.data.aPagar)}
            icon={<Banknote size={16} />}
            descricao="Soma das contas a pagar em aberto (status 'aberto' ou 'vencido')."
          />
          <StatCard
            label="Inadimplência"
            value={brl(q.data.inadimplencia)}
            sub={
              q.data.inadimplencia > 0 ? "Contas vencidas" : "Sem atrasos"
            }
            icon={<AlertTriangle size={16} />}
            danger={q.data.inadimplencia > 0}
            descricao="Soma das contas a receber com status 'vencido' (data ultrapassada sem pagamento)."
          />
        </div>
      )}

      {/* Bar chart: receita por origem */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Receita por origem
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {q.data?.receitaPorOrigem.length ?? 0} origem(ns)
          </span>
        </div>
        {q.isLoading ? (
          <Skeleton className="m-4 h-64 shimmer rounded-md" />
        ) : !q.data || q.data.receitaPorOrigem.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid size={22} strokeWidth={1.5} />}
            title="Sem receitas neste mês"
            hint="Lançamentos de contas a receber marcados como recebido/parcial alimentam este gráfico."
          />
        ) : (
          <div className="p-4" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={q.data.receitaPorOrigem}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-app)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--text-app-muted)" }}
                  tickFormatter={(v) => `R$${v}`}
                  stroke="var(--border-app)"
                />
                <YAxis
                  type="category"
                  dataKey="origem"
                  width={120}
                  tick={{ fontSize: 11, fill: "var(--text-app-secondary)" }}
                  stroke="var(--border-app)"
                />
                <Tooltip
                  content={<ChartTooltipBox formatter={brl} />}
                  cursor={{ fill: "var(--bg-app-alt-strong)", opacity: 0.3 }}
                />
                <Bar dataKey="valor" name="Receita" radius={[0, 4, 4, 0]}>
                  {q.data.receitaPorOrigem.map((_, i) => (
                    <Cell
                      key={i}
                      fill="var(--accent-app)"
                      fillOpacity={0.85 - i * 0.08}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 2. Contas a receber
// ---------------------------------------------------------------------------
function ContasReceberPanel({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState<string>(mesAtual());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [convenioFilter, setConvenioFilter] = useState<string>("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [glosaConta, setGlosaConta] = useState<ContaReceber | null>(null);

  // Atalho 'n' abre o dialog de novo lançamento (só se pode editar)
  useEffect(() => {
    if (!podeEditar) return;
    return onNovoItem(() => setNovoOpen(true));
  }, [podeEditar]);

  const PAGE_SIZE = 20;
  const [paginaReceber, setPaginaReceber] = useState(0);

  interface ContasReceberPaginado {
    rows: ContaReceber[];
    total: number;
    hasMore: boolean;
  }

  const contasQ = useQuery<ContasReceberPaginado>({
    queryKey: [
      "contas-receber",
      { mes, status: statusFilter, convenioId: convenioFilter, pagina: paginaReceber },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("mes", mes);
      if (statusFilter) params.set("status", statusFilter);
      if (convenioFilter) params.set("convenioId", convenioFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(paginaReceber * PAGE_SIZE));
      return apiFetch<ContasReceberPaginado>(`/api/contas-receber?${params.toString()}`);
    },
  });

  const contas = contasQ.data?.rows ?? [];
  const contasTotal = contasQ.data?.total ?? 0;
  const contasHasMore = contasQ.data?.hasMore ?? false;

  // Wrappers que resetam a paginação quando filtros mudam
  const trocarMes = (novo: string) => {
    setMes(novo);
    setPaginaReceber(0);
  };
  const trocarStatus = (novo: string) => {
    setStatusFilter(novo);
    setPaginaReceber(0);
  };
  const trocarConvenio = (novo: string) => {
    setConvenioFilter(novo);
    setPaginaReceber(0);
  };

  const conveniosQ = useQuery<Convenio[]>({
    queryKey: ["convenios"],
    queryFn: () => apiFetch<Convenio[]>("/api/convenios"),
  });

  const procQ = useQuery<Procedimento[]>({
    queryKey: ["procedimentos"],
    queryFn: () => apiFetch<Procedimento[]>("/api/procedimentos"),
  });

  // Mutations
  const invalidateContas = () => {
    queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "resumo"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "dre"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "rentabilidade"] });
    queryClient.invalidateQueries({
      queryKey: ["financeiro", "rentabilidade-equipamento"],
    });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "conciliacao"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "fluxo-projetado"] });
    queryClient.invalidateQueries({ queryKey: ["glosas"] });
  };

  const marcarRecebidoMut = useMutation({
    mutationFn: (vars: { id: string; valorFaturado: number }) =>
      apiFetch<ContaReceber>(`/api/contas-receber/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "recebido",
          valorPago: vars.valorFaturado,
          dataRecebimento: hoje(),
        }),
      }),
    onSuccess: () => {
      invalidateContas();
      toast.success("Conta marcada como recebida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ContaReceber>(`/api/contas-receber/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelado" }),
      }),
    onSuccess: () => {
      invalidateContas();
      toast.success("Conta cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/contas-receber/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateContas();
      toast.success("Lançamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <MonthPicker mes={mes} setMes={trocarMes} />

      {/* Filters */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Status
            </Label>
            <select
              value={statusFilter}
              onChange={(e) => trocarStatus(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="">Todos</option>
              <option value="aberto">Em aberto</option>
              <option value="recebido">Recebido</option>
              <option value="vencido">Vencido</option>
              <option value="parcial">Parcial</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="flex-1">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Convênio
            </Label>
            <select
              value={convenioFilter}
              onChange={(e) => trocarConvenio(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="">Todos</option>
              {(conveniosQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            {podeEditar && (
              <Button
                type="button"
                size="sm"
                onClick={() => setNovoOpen(true)}
                className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-9"
              >
                <Plus size={14} /> Novo lançamento
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className={cardCls}>
        <div className="px-4 py-2 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Lançamentos do mês
            </h3>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              {contasTotal}{" "}
              {contasTotal === 1 ? "item" : "itens"}
              {contasTotal > contas.length && (
                <span className="text-[var(--text-app-faint)] ml-1">
                  · mostrando {contas.length}
                </span>
              )}
            </span>
          </div>
          {contas.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportarCSV(
                    contas,
                    `contas-receber-${mes}`,
                    [
                      { chave: "pacienteNome", label: "Paciente" },
                      { chave: "procedimentoNome", label: "Procedimento" },
                      { chave: "convenioNome", label: "Convênio" },
                      { chave: "dentistaSolicitante", label: "Dentista" },
                      { chave: "dataExame", label: "Data exame", format: (v) => dataBR(v as string) },
                      { chave: "valorFaturado", label: "Faturado", format: (v) => fmtBRL(v) },
                      { chave: "valorPago", label: "Pago", format: (v) => fmtBRL(v) },
                      { chave: "status", label: "Status" },
                    ]
                  )
                }
                className="h-7 text-[11px] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <Download size={12} className="mr-1" /> CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  imprimirTabela(
                    "Contas a Receber",
                    `${nomeMes(mes)} · ${contasTotal} lançamento(s)`,
                    [
                      { label: "Paciente" },
                      { label: "Procedimento" },
                      { label: "Convênio" },
                      { label: "Data", format: (r) => dataBR(r.dataExame as string) },
                      { label: "Faturado", format: (r) => fmtBRL(r.valorFaturado as number) },
                      { label: "Pago", format: (r) => fmtBRL(r.valorPago as number | null) },
                      { label: "Status" },
                    ],
                    contas as unknown as Record<string, unknown>[]
                  )
                }
                className="h-7 text-[11px] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <Printer size={12} className="mr-1" /> Imprimir
              </Button>
            </div>
          )}
        </div>

        {contasQ.isLoading ? (
          <TableSkeleton cols={6} />
        ) : contasQ.isError ? (
          <ErrorState
            message={contasQ.error?.message ?? "Falha ao carregar"}
            onRetry={() => contasQ.refetch()}
          />
        ) : contas.length === 0 ? (
          <EmptyState
            icon={<ArrowDownCircle size={22} strokeWidth={1.5} />}
            title="Nenhum lançamento neste mês"
            hint={
              podeEditar
                ? "Use \"Novo lançamento\" para registrar uma conta a receber."
                : "Aguarde o gestor lançar as contas."
            }
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin">
            <Table className="text-sm">
              <TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">
                <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Paciente / Procedimento
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Convênio / Dentista
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Data exame
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Faturado
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Pago
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Status
                  </TableHead>
                  <TableHead className="w-32 px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.map((c) => (
                  <TableRow
                    key={c.id}
                    className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40"
                  >
                    <TableCell className="px-4 py-2 align-top">
                      <div className="text-sm text-[var(--text-app)] truncate max-w-[180px]">
                        {c.pacienteNome || "—"}
                      </div>
                      <div className="text-[11px] text-[var(--text-app-muted)] truncate max-w-[180px]">
                        {c.procedimentoNome || "sem procedimento"}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top">
                      <div className="text-sm text-[var(--text-app-secondary)] truncate max-w-[120px]">
                        {c.convenioNome || "Particular"}
                      </div>
                      <div className="text-[11px] text-[var(--text-app-muted)] truncate max-w-[120px]">
                        {c.dentistaSolicitante || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-sm text-[var(--text-app-secondary)]">
                      {dataBR(c.dataExame)}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-right font-mono tabular-nums text-[var(--text-app)]">
                      {brl(num(c.valorFaturado))}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-right font-mono tabular-nums text-[var(--text-app-muted)]">
                      {c.valorPago != null ? brl(num(c.valorPago)) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top">
                      <StatusBadge
                        status={c.status}
                        config={STATUS_RECEBER}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top">
                      <div className="flex items-center gap-1 justify-end">
                        {podeEditar && (c.status === "aberto" || c.status === "vencido" || c.status === "parcial") && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              marcarRecebidoMut.mutate({
                                id: c.id,
                                valorFaturado: num(c.valorFaturado),
                              })
                            }
                            disabled={
                              marcarRecebidoMut.isPending &&
                              marcarRecebidoMut.variables?.id === c.id
                            }
                            className="h-7 text-[11px] text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)]"
                            title="Marcar recebido"
                          >
                            <BadgeCheck size={13} /> receber
                          </Button>
                        )}
                        {podeEditar && c.status !== "cancelado" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setGlosaConta(c)}
                            className="h-7 text-[11px] text-[var(--warning-app)] hover:bg-[var(--warning-app-bg)]"
                            title="Adicionar glosa"
                          >
                            <FileWarning size={13} /> glosa
                          </Button>
                        )}
                        {podeEditar && c.status !== "cancelado" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelarMut.mutate(c.id)}
                            disabled={
                              cancelarMut.isPending &&
                              cancelarMut.variables === c.id
                            }
                            className="h-7 text-[11px] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
                            title="Cancelar"
                          >
                            Cancelar
                          </Button>
                        )}
                        {podeEditar && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-[var(--text-app)]">
                                  Remover lançamento?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-[var(--text-app-muted)]">
                                  Esta ação não pode ser desfeita. A conta a
                                  receber de {c.pacienteNome || "(sem paciente)"}{" "}
                                  será removida permanentemente (glosas
                                  vinculadas em cascata).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMut.mutate(c.id)}
                                  className="bg-[var(--danger-app)] text-white hover:bg-[var(--danger-app)]/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginação */}
        {contasTotal > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-[var(--border-app-subtle)] text-xs">
            <span className="text-[var(--text-app-muted)]">
              Página {paginaReceber + 1} de {Math.ceil(contasTotal / PAGE_SIZE)} ·{" "}
              {contasTotal} {contasTotal === 1 ? "item" : "itens"} no total
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaginaReceber((p) => Math.max(0, p - 1))}
                disabled={paginaReceber === 0}
                className="h-7 text-[11px] bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <ChevronLeft size={12} /> Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaginaReceber((p) => p + 1)}
                disabled={!contasHasMore}
                className="h-7 text-[11px] bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                Próxima <ChevronRight size={12} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* New lançamento dialog */}
      {novoOpen && (
        <NovoLancamentoReceberDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          convenios={conveniosQ.data ?? []}
          procedimentos={procQ.data ?? []}
          onSaved={() => {
            invalidateContas();
            setNovoOpen(false);
          }}
        />
      )}

      {/* Glosa dialog */}
      {glosaConta && (
        <GlosaDialog
          conta={glosaConta}
          onClose={() => setGlosaConta(null)}
          onSaved={() => {
            invalidateContas();
            setGlosaConta(null);
          }}
        />
      )}
    </motion.div>
  );
}

// New lançamento dialog with auto-fill valorFaturado from precoVigente
function NovoLancamentoReceberDialog({
  open,
  onOpenChange,
  convenios,
  procedimentos,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  convenios: Convenio[];
  procedimentos: Procedimento[];
  onSaved: () => void;
}) {
  const [pacienteNome, setPacienteNome] = useState("");
  const [procedimentoId, setProcedimentoId] = useState("");
  const [convenioId, setConvenioId] = useState("");
  const [dentistaSolicitante, setDentistaSolicitante] = useState("");
  const [dataExame, setDataExame] = useState<string>(hoje());
  const [vencimento, setVencimento] = useState<string>(hoje());
  const [valorFaturado, setValorFaturado] = useState<string>("");
  const [valorAutoFilled, setValorAutoFilled] = useState<boolean>(false);

  // Reset convenioId + valorFaturado when convenio changes
  function changeConvenio(v: string) {
    setConvenioId(v);
    setValorFaturado("");
    setValorAutoFilled(false);
  }

  function changeProcedimento(v: string) {
    setProcedimentoId(v);
    setValorFaturado("");
    setValorAutoFilled(false);
  }

  function changeDataExame(v: string) {
    setDataExame(v);
    setValorFaturado("");
    setValorAutoFilled(false);
  }

  // Try to find precoVigente client-side from procedimentos + convenios lists.
  // We can't read the tabela-de-precos here without an extra query; the
  // backend will fill valorFaturado when undefined, so we just leave empty
  // and show "(vazio = usar tabela)" hint. If user types, we send as is.
  function handleSubmit() {
    const trimmedPaciente = pacienteNome.trim();
    if (!trimmedPaciente) {
      toast.error("Informe o nome do paciente");
      return;
    }
    if (!dataExame) {
      toast.error("Informe a data do exame");
      return;
    }
    const body: Record<string, unknown> = {
      pacienteNome: trimmedPaciente,
      dataExame,
      vencimento: vencimento || null,
    };
    if (procedimentoId) body.procedimentoId = procedimentoId;
    if (convenioId) body.convenioId = convenioId;
    if (dentistaSolicitante.trim()) body.dentistaSolicitante = dentistaSolicitante.trim();
    if (valorFaturado !== "") {
      const v = num(valorFaturado);
      if (!(v >= 0)) {
        toast.error("Valor faturado inválido");
        return;
      }
      body.valorFaturado = v;
    }
    // If convenioId + procedimentoId + dataExame present and valorFaturado
    // empty, the backend will look up the preço vigente. If no preço
    // cadastrado, the backend returns 400.

    apiFetch<ContaReceber>("/api/contas-receber", {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then(() => {
        toast.success("Lançamento criado");
        onSaved();
        // reset form
        setPacienteNome("");
        setProcedimentoId("");
        setConvenioId("");
        setDentistaSolicitante("");
        setDataExame(hoje());
        setVencimento(hoje());
        setValorFaturado("");
        setValorAutoFilled(false);
      })
      .catch((e: Error) => toast.error(e.message));
  }

  // Hint about whether valor will come from tabela
  const hintValor =
    convenioId && procedimentoId && valorFaturado === ""
      ? "(vazio = buscar preço vigente na tabela do convênio)"
      : convenioId
      ? "(vazio = usar tabela)"
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            Novo lançamento — conta a receber
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end">
          <div className="col-span-2">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Paciente
            </Label>
            <Input
              value={pacienteNome}
              onChange={(e) => setPacienteNome(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Procedimento
            </Label>
            <select
              value={procedimentoId}
              onChange={(e) => changeProcedimento(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="">—</option>
              {procedimentos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Convênio
            </Label>
            <select
              value={convenioId}
              onChange={(e) => changeConvenio(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="">Particular</option>
              {convenios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Dentista solicitante
            </Label>
            <Input
              value={dentistaSolicitante}
              onChange={(e) => setDentistaSolicitante(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Data do exame
            </Label>
            <Input
              type="date"
              value={dataExame}
              onChange={(e) => changeDataExame(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Vencimento
            </Label>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Valor faturado {hintValor}
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valorFaturado}
              onChange={(e) => {
                setValorFaturado(e.target.value);
                setValorAutoFilled(false);
              }}
              placeholder={convenioId ? "auto" : "0,00"}
              className={`${inputCls} font-mono tabular-nums text-right`}
            />
            {valorAutoFilled && (
              <p className="text-[10px] text-[var(--accent-app-text)] mt-0.5">
                valor preenchido pela tabela do convênio
              </p>
            )}
          </div>
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
            onClick={handleSubmit}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
          >
            Salvar lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Glosa dialog
function GlosaDialog({
  conta,
  onClose,
  onSaved,
}: {
  conta: ContaReceber;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [valor, setValor] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  function handleSubmit() {
    const v = num(valor);
    if (!(v >= 0)) {
      toast.error("Informe um valor de glosa válido");
      return;
    }
    apiFetch<Glosa>(`/api/contas-receber/${conta.id}/glosa`, {
      method: "POST",
      body: JSON.stringify({
        valor: v,
        motivo: motivo.trim() || undefined,
      }),
    })
      .then(() => {
        toast.success("Glosa registrada");
        onSaved();
      })
      .catch((e: Error) => toast.error(e.message));
  }

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            Adicionar glosa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-[var(--text-app-muted)] bg-[var(--bg-app)] rounded-md p-2.5">
            <div className="text-[var(--text-app)]">
              {conta.pacienteNome || "(sem paciente)"}
            </div>
            <div>
              {conta.procedimentoNome || "sem procedimento"} ·{" "}
              {conta.convenioNome || "Particular"}
            </div>
            <div className="font-mono tabular-nums text-[var(--text-app)]">
              {brl(num(conta.valorFaturado))}
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Valor glosado (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              autoFocus
              className={`${inputCls} font-mono tabular-nums text-right`}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Motivo
            </Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Item não autorizado, cobrança indevida…"
              className={inputCls}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="bg-[var(--warning-app)] text-white hover:bg-[var(--warning-app)]/90"
          >
            Registrar glosa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Contas a pagar
// ---------------------------------------------------------------------------
function ContasPagarPanel({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState<string>(mesAtual());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [novoOpen, setNovoOpen] = useState(false);

  // Atalho 'n' abre o dialog de nova conta a pagar
  useEffect(() => {
    if (!podeEditar) return;
    return onNovoItem(() => setNovoOpen(true));
  }, [podeEditar]);

  const PAGE_SIZE_PAGAR = 20;
  const [paginaPagar, setPaginaPagar] = useState(0);

  interface ContasPagarPaginado {
    rows: ContaPagar[];
    total: number;
    hasMore: boolean;
  }

  const contasQ = useQuery<ContasPagarPaginado>({
    queryKey: ["contas-pagar", { mes, status: statusFilter, pagina: paginaPagar }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("mes", mes);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", String(PAGE_SIZE_PAGAR));
      params.set("offset", String(paginaPagar * PAGE_SIZE_PAGAR));
      return apiFetch<ContasPagarPaginado>(`/api/contas-pagar?${params.toString()}`);
    },
  });

  const contasPagar = contasQ.data?.rows ?? [];
  const contasPagarTotal = contasQ.data?.total ?? 0;
  const contasPagarHasMore = contasQ.data?.hasMore ?? false;

  const trocarMesPagar = (novo: string) => {
    setMes(novo);
    setPaginaPagar(0);
  };
  const trocarStatusPagar = (novo: string) => {
    setStatusFilter(novo);
    setPaginaPagar(0);
  };

  // Despesas recorrentes sub-section
  const recorrentesQ = useQuery<DespesaRecorrente[]>({
    queryKey: ["despesas-recorrentes"],
    queryFn: () =>
      apiFetch<DespesaRecorrente[]>("/api/despesas-recorrentes"),
  });

  const invalidateContas = () => {
    queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "resumo"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "dre"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "conciliacao"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "fluxo-projetado"] });
  };

  const marcarPagoMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ContaPagar>(`/api/contas-pagar/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "pago", dataPagamento: hoje() }),
      }),
    onSuccess: () => {
      invalidateContas();
      toast.success("Conta marcada como paga");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ContaPagar>(`/api/contas-pagar/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelado" }),
      }),
    onSuccess: () => {
      invalidateContas();
      toast.success("Conta cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/contas-pagar/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateContas();
      toast.success("Conta removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gerarRecorrentesMut = useMutation({
    mutationFn: () =>
      apiFetch<{ gerados: number }>(`/api/despesas-recorrentes/gerar`, {
        method: "POST",
        body: JSON.stringify({ mes }),
      }),
    onSuccess: (data) => {
      invalidateContas();
      toast.success(
        `${data.gerados} lançamento(s) gerado(s) para ${mes}.`
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <MonthPicker mes={mes} setMes={trocarMesPagar} />

      {/* Filters + actions */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Status
            </Label>
            <select
              value={statusFilter}
              onChange={(e) => trocarStatusPagar(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="">Todos</option>
              <option value="aberto">Em aberto</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            {podeEditar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => gerarRecorrentesMut.mutate()}
                disabled={
                  gerarRecorrentesMut.isPending ||
                  (recorrentesQ.data ?? []).length === 0
                }
                className="bg-transparent border-[var(--border-app)] text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] h-9"
                title="Gera lançamentos de despesas recorrentes para o mês selecionado"
              >
                <RefreshCw size={13} /> Gerar recorrentes
              </Button>
            )}
            {podeEditar && (
              <Button
                type="button"
                size="sm"
                onClick={() => setNovoOpen(true)}
                className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-9"
              >
                <Plus size={14} /> Nova conta
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className={cardCls}>
        <div className="px-4 py-2 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Contas do mês
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {contasPagarTotal}{" "}
            {contasPagarTotal === 1 ? "item" : "itens"}
            {contasPagarTotal > contasPagar.length && (
              <span className="text-[var(--text-app-faint)] ml-1">
                · mostrando {contasPagar.length}
              </span>
            )}
          </span>
        </div>

        {contasQ.isLoading ? (
          <TableSkeleton cols={5} />
        ) : contasQ.isError ? (
          <ErrorState
            message={contasQ.error?.message ?? "Falha ao carregar"}
            onRetry={() => contasQ.refetch()}
          />
        ) : contasPagar.length === 0 ? (
          <EmptyState
            icon={<ArrowUpCircle size={22} strokeWidth={1.5} />}
            title="Nenhuma conta neste mês"
            hint={
              podeEditar
                ? "Use \"Nova conta\" ou gere as despesas recorrentes do mês."
                : "Aguarde o gestor lançar as contas."
            }
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin">
            <Table className="text-sm">
              <TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">
                <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Descrição / Fornecedor
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Categoria
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Valor
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Vencimento
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Status
                  </TableHead>
                  <TableHead className="w-28 px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasPagar.map((c) => (
                  <TableRow
                    key={c.id}
                    className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40"
                  >
                    <TableCell className="px-4 py-2 align-top">
                      <div className="text-sm text-[var(--text-app)] truncate max-w-[200px]">
                        {c.descricao}
                      </div>
                      <div className="text-[11px] text-[var(--text-app-muted)] truncate max-w-[200px]">
                        {c.fornecedor || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-sm text-[var(--text-app-secondary)]">
                      {c.categoria || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-right font-mono tabular-nums text-[var(--text-app)]">
                      {brl(num(c.valor))}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-sm text-[var(--text-app-secondary)]">
                      {dataBR(c.vencimento)}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top">
                      <StatusBadge status={c.status} config={STATUS_PAGAR} />
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top">
                      <div className="flex items-center gap-1 justify-end">
                        {podeEditar && c.status === "aberto" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => marcarPagoMut.mutate(c.id)}
                            disabled={
                              marcarPagoMut.isPending &&
                              marcarPagoMut.variables === c.id
                            }
                            className="h-7 text-[11px] text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)]"
                            title="Marcar pago"
                          >
                            <BadgeCheck size={13} /> pagar
                          </Button>
                        )}
                        {podeEditar && c.status !== "cancelado" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelarMut.mutate(c.id)}
                            disabled={
                              cancelarMut.isPending &&
                              cancelarMut.variables === c.id
                            }
                            className="h-7 text-[11px] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
                            title="Cancelar"
                          >
                            Cancelar
                          </Button>
                        )}
                        {podeEditar && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-[var(--text-app)]">
                                  Remover conta?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-[var(--text-app-muted)]">
                                  A conta a pagar "{c.descricao}" será removida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMut.mutate(c.id)}
                                  className="bg-[var(--danger-app)] text-white hover:bg-[var(--danger-app)]/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginação */}
        {contasPagarTotal > PAGE_SIZE_PAGAR && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-[var(--border-app-subtle)] text-xs">
            <span className="text-[var(--text-app-muted)]">
              Página {paginaPagar + 1} de {Math.ceil(contasPagarTotal / PAGE_SIZE_PAGAR)} ·{" "}
              {contasPagarTotal} {contasPagarTotal === 1 ? "item" : "itens"} no total
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaginaPagar((p) => Math.max(0, p - 1))}
                disabled={paginaPagar === 0}
                className="h-7 text-[11px] bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <ChevronLeft size={12} /> Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaginaPagar((p) => p + 1)}
                disabled={!contasPagarHasMore}
                className="h-7 text-[11px] bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                Próxima <ChevronRight size={12} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Despesas recorrentes sub-section */}
      <DespesasRecorrentesPanel podeEditar={podeEditar} recorrentesQ={recorrentesQ} invalidateContas={invalidateContas} />

      {/* New conta dialog */}
      {novoOpen && (
        <NovaContaPagarDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          onSaved={() => {
            invalidateContas();
            setNovoOpen(false);
          }}
        />
      )}
    </motion.div>
  );
}

function DespesasRecorrentesPanel({
  podeEditar,
  recorrentesQ,
  invalidateContas,
}: {
  podeEditar: boolean;
  recorrentesQ: ReturnType<typeof useQuery<DespesaRecorrente[]>>;
  invalidateContas: () => void;
}) {
  const queryClient = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["despesas-recorrentes"] });
    invalidateContas();
  };

  const addMut = useMutation({
    mutationFn: (vars: {
      descricao: string;
      categoria?: string;
      fornecedor?: string;
      valor: number;
      diaVencimento: number;
    }) =>
      apiFetch<DespesaRecorrente>("/api/despesas-recorrentes", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Despesa recorrente adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/despesas-recorrentes/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Despesa recorrente removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className={cardCls}>
      <div className="px-4 py-2 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-[var(--text-app-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Despesas recorrentes
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {(recorrentesQ.data ?? []).length}{" "}
            {(recorrentesQ.data ?? []).length === 1 ? "cadastro" : "cadastros"}
          </span>
        </div>
        {podeEditar && (
          <Button
            type="button"
            size="sm"
            onClick={() => setNovoOpen(true)}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
          >
            <Plus size={14} /> Nova
          </Button>
        )}
      </div>

      {recorrentesQ.isLoading ? (
        <TableSkeleton cols={5} />
      ) : recorrentesQ.isError ? (
        <ErrorState
          message={recorrentesQ.error?.message ?? "Falha ao carregar"}
          onRetry={() => recorrentesQ.refetch()}
        />
      ) : (recorrentesQ.data ?? []).length === 0 ? (
        <EmptyState
          icon={<RefreshCw size={22} strokeWidth={1.5} />}
          title="Nenhuma despesa recorrente cadastrada"
          hint={
            podeEditar
              ? "Cadastre aqui contas que se repetem todo mês (aluguel, internet, software). Depois use \"Gerar recorrentes\" para replicá-las no mês."
              : "Aguarde o gestor cadastrar despesas recorrentes."
          }
        />
      ) : (
        <div className="max-h-72 overflow-y-auto scroll-thin">
          <Table className="text-sm">
            <TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">
              <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                  Descrição
                </TableHead>
                <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                  Categoria / Fornecedor
                </TableHead>
                <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                  Valor
                </TableHead>
                <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                  Dia venc.
                </TableHead>
                <TableHead className="w-12 px-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recorrentesQ.data ?? []).map((r) => (
                <TableRow
                  key={r.id}
                  className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40"
                >
                  <TableCell className="px-4 py-2 text-sm text-[var(--text-app)]">
                    {r.descricao}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-sm text-[var(--text-app-secondary)]">
                    <div>{r.categoria || "—"}</div>
                    <div className="text-[11px] text-[var(--text-app-muted)]">
                      {r.fornecedor || ""}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app)]">
                    {brl(num(r.valor))}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
                    {r.diaVencimento}
                  </TableCell>
                  <TableCell className="px-2 text-center">
                    {podeEditar ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
                            title="Remover"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-[var(--text-app)]">
                              Remover despesa recorrente?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-[var(--text-app-muted)]">
                              A despesa recorrente "{r.descricao}" será removida. Os
                              lançamentos já gerados em meses anteriores não serão
                              afetados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]">
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => delMut.mutate(r.id)}
                              className="bg-[var(--danger-app)] text-white hover:bg-[var(--danger-app)]/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {novoOpen && (
        <NovaDespesaRecorrenteDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          onSaved={() => {
            setNovoOpen(false);
          }}
          onAdd={addMut.mutate}
          pending={addMut.isPending}
        />
      )}
    </Card>
  );
}

function NovaDespesaRecorrenteDialog({
  open,
  onOpenChange,
  onSaved,
  onAdd,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  onAdd: (vars: {
    descricao: string;
    categoria?: string;
    fornecedor?: string;
    valor: number;
    diaVencimento: number;
  }) => void;
  pending: boolean;
}) {
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("5");

  function handleSubmit() {
    const desc = descricao.trim();
    if (!desc) {
      toast.error("Informe a descrição");
      return;
    }
    const v = num(valor);
    if (!(v >= 0)) {
      toast.error("Valor inválido");
      return;
    }
    const dia = num(diaVencimento);
    if (!(dia >= 1 && dia <= 31)) {
      toast.error("Dia de vencimento inválido (1-31)");
      return;
    }
    onAdd({
      descricao: desc,
      categoria: categoria.trim() || undefined,
      fornecedor: fornecedor.trim() || undefined,
      valor: v,
      diaVencimento: dia,
    });
    // Reset
    setDescricao("");
    setCategoria("");
    setFornecedor("");
    setValor("");
    setDiaVencimento("5");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            Nova despesa recorrente
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
          <div className="col-span-2">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Descrição
            </Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={inputCls}
              placeholder="Ex.: Aluguel, Energia…"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Categoria
            </Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Fornecedor
            </Label>
            <Input
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Valor (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`${inputCls} font-mono tabular-nums text-right`}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Dia vencimento
            </Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={diaVencimento}
              onChange={(e) => setDiaVencimento(e.target.value)}
              className={`${inputCls} font-mono tabular-nums text-right`}
            />
          </div>
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
            onClick={handleSubmit}
            disabled={pending}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaContaPagarDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState<string>(hoje());

  function handleSubmit() {
    const desc = descricao.trim();
    if (!desc) {
      toast.error("Informe a descrição");
      return;
    }
    const v = num(valor);
    if (!(v >= 0)) {
      toast.error("Valor inválido");
      return;
    }
    if (!vencimento) {
      toast.error("Informe o vencimento");
      return;
    }
    apiFetch<ContaPagar>("/api/contas-pagar", {
      method: "POST",
      body: JSON.stringify({
        descricao: desc,
        categoria: categoria.trim() || undefined,
        fornecedor: fornecedor.trim() || undefined,
        valor: v,
        vencimento,
      }),
    })
      .then(() => {
        toast.success("Conta criada");
        onSaved();
        // reset
        setDescricao("");
        setCategoria("");
        setFornecedor("");
        setValor("");
        setVencimento(hoje());
      })
      .catch((e: Error) => toast.error(e.message));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            Nova conta a pagar
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Descrição
            </Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Categoria
            </Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={inputCls}
              placeholder="aluguel, materiais…"
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Fornecedor
            </Label>
            <Input
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Valor (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`${inputCls} font-mono tabular-nums text-right`}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Vencimento
            </Label>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className={inputCls}
            />
          </div>
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
            onClick={handleSubmit}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 4. Convênios
// ---------------------------------------------------------------------------
function ConveniosPanel({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [editConv, setEditConv] = useState<Convenio | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Atalho 'n' abre o dialog de novo convênio
  useEffect(() => {
    if (!podeEditar) return;
    return onNovoItem(() => setNovoOpen(true));
  }, [podeEditar]);

  const q = useQuery<Convenio[]>({
    queryKey: ["convenios"],
    queryFn: () => apiFetch<Convenio[]>("/api/convenios"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["convenios"] });
    queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro"] });
  };

  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/convenios/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
      toast.success("Convênio removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-4"
    >
      {/* List */}
      <Card className={`${cardCls} self-start`}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[var(--text-app-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Convênios
            </h3>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              {(q.data ?? []).length}
            </span>
          </div>
          {podeEditar && (
            <Button
              type="button"
              size="sm"
              onClick={() => setNovoOpen(true)}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
            >
              <Plus size={14} /> Novo
            </Button>
          )}
        </div>

        {q.isLoading ? (
          <div className="space-y-2 px-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-12 w-full bg-[var(--bg-app-alt-strong)]"
              />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState
            message={q.error?.message ?? "Falha ao carregar"}
            onRetry={() => q.refetch()}
          />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Building2 size={22} strokeWidth={1.5} />}
            title="Nenhum convênio cadastrado"
            hint={
              podeEditar
                ? "Cadastre os convênios com que sua clínica trabalha e a tabela de preços."
                : "Aguarde o gestor cadastrar convênios."
            }
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin py-1">
            {(q.data ?? []).map((c) => {
              const active = c.id === selectedId;
              return (
                <div
                  key={c.id}
                  className={`group flex items-center border-l-2 ${
                    active
                      ? "bg-[var(--accent-app-soft-bg)] border-[var(--accent-app)]"
                      : "border-transparent hover:bg-[var(--bg-app-alt-strong)]/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(active ? null : c.id)}
                    className="flex-1 text-left px-3 py-2 text-sm text-[var(--text-app)]"
                  >
                    <div className="truncate">{c.nome}</div>
                    <div className="text-[11px] text-[var(--text-app-muted)]">
                      {c.responsavel || "—"} · {c.prazoMedioDias}d
                    </div>
                  </button>
                  {podeEditar && (
                    <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditConv(c)}
                        className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)]"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
                            title="Remover"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-[var(--text-app)]">
                              Remover convênio?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-[var(--text-app-muted)]">
                              O convênio "{c.nome}" será removido. Contas a
                              receber vinculadas manterão o registro histórico
                              mas perderão o nome do convênio.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]">
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => delMut.mutate(c.id)}
                              className="bg-[var(--danger-app)] text-white hover:bg-[var(--danger-app)]/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Detail (tabela de preços) */}
      <div>
        {!selectedId ? (
          <Card className={cardCls}>
            <EmptyState
              icon={<Building2 size={22} strokeWidth={1.5} />}
              title="Selecione um convênio"
              hint="Clique em um convênio à esquerda para ver a tabela de preços por procedimento com vigência."
            />
          </Card>
        ) : (
          <ConvenioPrecosPanel
            convenioId={selectedId}
            podeEditar={podeEditar}
          />
        )}
      </div>

      {/* New dialog */}
      {novoOpen && (
        <ConvenioFormDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          onSaved={() => {
            invalidate();
            setNovoOpen(false);
          }}
        />
      )}

      {/* Edit dialog */}
      {editConv && (
        <ConvenioFormDialog
          open
          onOpenChange={(v) => {
            if (!v) setEditConv(null);
          }}
          convenio={editConv}
          onSaved={() => {
            invalidate();
            setEditConv(null);
          }}
        />
      )}
    </motion.div>
  );
}

function ConvenioPrecosPanel({
  convenioId,
  podeEditar,
}: {
  convenioId: string;
  podeEditar: boolean;
}) {
  const queryClient = useQueryClient();
  const [novoPrecoOpen, setNovoPrecoOpen] = useState(false);

  const precosQ = useQuery<ConvenioTabelaPreco[]>({
    queryKey: ["convenios", convenioId, "precos"],
    queryFn: () =>
      apiFetch<ConvenioTabelaPreco[]>(`/api/convenios/${convenioId}/precos`),
  });

  const procQ = useQuery<Procedimento[]>({
    queryKey: ["procedimentos"],
    queryFn: () => apiFetch<Procedimento[]>("/api/procedimentos"),
  });

  const addMut = useMutation({
    mutationFn: (vars: {
      procedimentoId: string;
      valor: number;
      vigenciaInicio: string;
    }) =>
      apiFetch<ConvenioTabelaPreco>(
        `/api/convenios/${convenioId}/precos`,
        {
          method: "POST",
          body: JSON.stringify(vars),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["convenios", convenioId, "precos"],
      });
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Nova vigência adicionada");
      setNovoPrecoOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className={cardCls}>
      <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-[var(--text-app-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Tabela de preços
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {(precosQ.data ?? []).length}{" "}
            {(precosQ.data ?? []).length === 1 ? "registro" : "registros"}
          </span>
        </div>
        {podeEditar && (
          <Button
            type="button"
            size="sm"
            onClick={() => setNovoPrecoOpen(true)}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
          >
            <Plus size={14} /> Nova vigência
          </Button>
        )}
      </div>

      {precosQ.isLoading ? (
        <TableSkeleton cols={3} />
      ) : precosQ.isError ? (
        <ErrorState
          message={precosQ.error?.message ?? "Falha ao carregar"}
          onRetry={() => precosQ.refetch()}
        />
      ) : (precosQ.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Receipt size={22} strokeWidth={1.5} />}
          title="Nenhum preço cadastrado"
          hint={
            podeEditar
              ? "Cadastre valores por procedimento com data de vigência. Novas vigências preservam o valor para exames antigos."
              : "Aguarde o gestor cadastrar a tabela de preços."
          }
        />
      ) : (
        <div className="max-h-96 overflow-y-auto scroll-thin">
          <Table className="text-sm">
            <TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">
              <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                  Procedimento
                </TableHead>
                <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                  Valor
                </TableHead>
                <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                  Vigente desde
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(precosQ.data ?? []).map((p) => (
                <TableRow
                  key={p.id}
                  className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40"
                >
                  <TableCell className="px-4 py-2 text-sm text-[var(--text-app)]">
                    {p.procedimentoNome}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app)]">
                    {brl(num(p.valor))}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right text-sm text-[var(--text-app-muted)]">
                    {dataBR(p.vigenciaInicio)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {novoPrecoOpen && (
        <NovoPrecoDialog
          open={novoPrecoOpen}
          onOpenChange={setNovoPrecoOpen}
          procedimentos={procQ.data ?? []}
          onAdd={addMut.mutate}
          pending={addMut.isPending}
        />
      )}
    </Card>
  );
}

function NovoPrecoDialog({
  open,
  onOpenChange,
  procedimentos,
  onAdd,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  procedimentos: Procedimento[];
  onAdd: (vars: {
    procedimentoId: string;
    valor: number;
    vigenciaInicio: string;
  }) => void;
  pending: boolean;
}) {
  const [procedimentoId, setProcedimentoId] = useState("");
  const [valor, setValor] = useState("");
  const [vigenciaInicio, setVigenciaInicio] = useState<string>(hoje());

  function handleSubmit() {
    if (!procedimentoId) {
      toast.error("Selecione um procedimento");
      return;
    }
    const v = num(valor);
    if (!(v >= 0)) {
      toast.error("Valor inválido");
      return;
    }
    if (!vigenciaInicio) {
      toast.error("Informe a data de vigência");
      return;
    }
    onAdd({ procedimentoId, valor: v, vigenciaInicio });
    setProcedimentoId("");
    setValor("");
    setVigenciaInicio(hoje());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            Nova vigência de preço
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2.5 items-end">
          <div className="col-span-3 sm:col-span-1">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Procedimento
            </Label>
            <select
              value={procedimentoId}
              onChange={(e) => setProcedimentoId(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="">—</option>
              {procedimentos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Valor (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`${inputCls} font-mono tabular-nums text-right`}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Vigente desde
            </Label>
            <Input
              type="date"
              value={vigenciaInicio}
              onChange={(e) => setVigenciaInicio(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-app-muted)]">
          Nova vigência sempre é inserida (nunca sobrescreve). Exames antigos
          mantêm o valor da tabela vigente à época em que foram feitos.
        </p>
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
            onClick={handleSubmit}
            disabled={pending}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
          >
            {pending ? "Salvando…" : "Salvar vigência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvenioFormDialog({
  open,
  onOpenChange,
  convenio,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  convenio?: Convenio;
  onSaved: () => void;
}) {
  const isEdit = !!convenio;
  const [nome, setNome] = useState<string>(convenio?.nome ?? "");
  const [cnpj, setCnpj] = useState<string>(convenio?.cnpj ?? "");
  const [telefone, setTelefone] = useState<string>(convenio?.telefone ?? "");
  const [email, setEmail] = useState<string>(convenio?.email ?? "");
  const [responsavel, setResponsavel] = useState<string>(
    convenio?.responsavel ?? ""
  );
  const [prazoMedioDias, setPrazoMedioDias] = useState<string>(
    String(convenio?.prazoMedioDias ?? 30)
  );

  function handleSubmit() {
    const trimmed = nome.trim();
    if (!trimmed) {
      toast.error("Informe o nome do convênio");
      return;
    }
    const prazo = num(prazoMedioDias);
    const body: Record<string, unknown> = {
      nome: trimmed,
      cnpj: cnpj.trim() || undefined,
      telefone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      responsavel: responsavel.trim() || undefined,
      prazoMedioDias: prazo,
    };
    const url = isEdit
      ? `/api/convenios/${convenio!.id}`
      : "/api/convenios";
    const method = isEdit ? "PUT" : "POST";
    apiFetch<Convenio>(url, { method, body: JSON.stringify(body) })
      .then(() => {
        toast.success(isEdit ? "Convênio atualizado" : "Convênio criado");
        onSaved();
      })
      .catch((e: Error) => toast.error(e.message));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            {isEdit ? "Editar convênio" : "Novo convênio"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-end">
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Nome
            </Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              CNPJ
            </Label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Telefone
            </Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              E-mail
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Responsável
            </Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Prazo médio (dias)
            </Label>
            <Input
              type="number"
              min="0"
              value={prazoMedioDias}
              onChange={(e) => setPrazoMedioDias(e.target.value)}
              className={`${inputCls} font-mono tabular-nums text-right`}
            />
          </div>
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
            onClick={handleSubmit}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
          >
            <Save size={14} /> {isEdit ? "Salvar" : "Criar convênio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 5. Glosas
// ---------------------------------------------------------------------------
function GlosasPanel({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");

  const q = useQuery<Glosa[]>({
    queryKey: ["glosas", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString();
      return apiFetch<Glosa[]>(
        `/api/glosas${qs ? `?${qs}` : ""}`
      );
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["glosas"] });
    queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "resumo"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "dre"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro", "conciliacao"] });
  };

  const updMut = useMutation({
    mutationFn: (vars: {
      id: string;
      status?: string;
      valorRecuperado?: number;
    }) =>
      apiFetch<Glosa>(`/api/glosas/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(vars.status ? { status: vars.status } : {}),
          ...(vars.valorRecuperado !== undefined
            ? { valorRecuperado: vars.valorRecuperado }
            : {}),
        }),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Glosa atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalGlosado = useMemo(
    () => (q.data ?? []).reduce((s, g) => s + num(g.valor), 0),
    [q.data]
  );

  // Glosas atrasadas = em_recurso há >30 dias (campo calculado pelo backend)
  const glosasAtrasadas = useMemo(
    () => (q.data ?? []).filter((g) => g.atrasada),
    [q.data]
  );
  const totalAtrasado = useMemo(
    () => glosasAtrasadas.reduce((s, g) => s + num(g.valor), 0),
    [glosasAtrasadas]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total glosado (todas pendências)"
          value={brl(totalGlosado)}
          icon={<FileWarning size={16} />}
          danger
        />
        <StatCard
          label="Quantidade de glosas"
          value={String((q.data ?? []).length)}
          icon={<Receipt size={16} />}
        />
        <StatCard
          label="Atrasadas (>30 dias em recurso)"
          value={String(glosasAtrasadas.length)}
          icon={<AlertTriangle size={16} />}
          danger={glosasAtrasadas.length > 0}
        />
        <StatCard
          label="Filtro atual"
          value={
            statusFilter
              ? STATUS_GLOSA[statusFilter]?.label ?? statusFilter
              : "Todas"
          }
          icon={<CheckCircle2 size={16} />}
          accent
        />
      </div>

      {/* Banner de alerta — glosas atrasadas */}
      {glosasAtrasadas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--danger-app-bg)] border border-[var(--danger-app-border)] rounded-xl p-4 flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--danger-app)] text-white grid place-items-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[var(--danger-app)] mb-0.5">
              {glosasAtrasadas.length} {glosasAtrasadas.length === 1 ? "glosa atrasada" : "glosas atrasadas"} — total {brl(totalAtrasado)}
            </h4>
            <p className="text-xs text-[var(--text-app-secondary)]">
              Glosas em recurso há mais de 30 dias precisam de follow-up. Considere marcar como perdida ou entrar em contato com o convênio.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter("em_recurso")}
            className="text-[var(--danger-app)] hover:bg-[var(--danger-app-bg-strong)] shrink-0 text-xs h-8"
          >
            Filtrar
          </Button>
        </motion.div>
      )}

      {/* Filter */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Status
            </Label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="">Todas</option>
              <option value="glosada">Glosada</option>
              <option value="em_recurso">Em recurso</option>
              <option value="recuperada">Recuperada</option>
              <option value="perdida">Perdida</option>
            </select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => q.refetch()}
            className="h-9 text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
          >
            <RefreshCw size={13} /> Atualizar
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className={cardCls}>
        <div className="px-4 py-2 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-app)]">
            Glosas
          </h3>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {(q.data ?? []).length}{" "}
            {(q.data ?? []).length === 1 ? "item" : "itens"}
          </span>
        </div>

        {q.isLoading ? (
          <TableSkeleton cols={5} />
        ) : q.isError ? (
          <ErrorState
            message={q.error?.message ?? "Falha ao carregar"}
            onRetry={() => q.refetch()}
          />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} strokeWidth={1.5} />}
            title="Nenhuma glosa registrada"
            hint={"Glosas são criadas a partir da aba \"Contas a receber\" (botão \"glosa\"). Quando uma conta tem desconto do convênio, registre aqui e acompanhe o recurso."}
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin">
            <Table className="text-sm">
              <TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">
                <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Paciente / Convênio
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Motivo
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Faturado
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Glosado
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Recuperado
                  </TableHead>
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Status
                  </TableHead>
                  <TableHead className="w-40 px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((g) => (
                  <TableRow
                    key={g.id}
                    className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40"
                  >
                    <TableCell className="px-4 py-2 align-top">
                      <div className="text-sm text-[var(--text-app)] truncate max-w-[160px]">
                        {g.pacienteNome || "—"}
                      </div>
                      <div className="text-[11px] text-[var(--text-app-muted)] truncate max-w-[160px]">
                        {g.convenioNome || "Particular"}
                      </div>
                      <div className="text-[11px] text-[var(--text-app-muted)]">
                        {g.dataExame ? dataBR(g.dataExame) : ""}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-sm text-[var(--text-app-secondary)] max-w-[200px]">
                      {g.motivo || "sem motivo informado"}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-right font-mono tabular-nums text-[var(--text-app-muted)]">
                      {g.valorFaturado != null ? brl(num(g.valorFaturado)) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-right font-mono tabular-nums text-[var(--danger-app)]">
                      {brl(num(g.valor))}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top text-right font-mono tabular-nums text-[var(--accent-app-text)]">
                      {g.valorRecuperado != null ? brl(num(g.valorRecuperado)) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={g.status} config={STATUS_GLOSA} />
                        {g.status === "em_recurso" && (
                          <span
                            title={`Desde ${dataBR((g.criadoEm || "").slice(0, 10))} — ${g.diasEmRecurso} dia(s) em recurso`}
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded w-fit ${
                              g.atrasada
                                ? "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]"
                                : g.diasEmRecurso > 15
                                ? "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]"
                                : "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]"
                            }`}
                          >
                            <Clock size={9} />
                            {g.diasEmRecurso}d
                            {g.atrasada && " · atrasada"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 align-top">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        {podeEditar && g.status === "glosada" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updMut.mutate({
                                id: g.id,
                                status: "em_recurso",
                              })
                            }
                            disabled={
                              updMut.isPending &&
                              updMut.variables?.id === g.id
                            }
                            className="h-7 text-[11px] text-[var(--warning-app)] hover:bg-[var(--warning-app-bg)]"
                          >
                            Entrar com recurso
                          </Button>
                        )}
                        {podeEditar && g.status === "em_recurso" && (
                          <>
                            <RecuperarGlosaButton
                              glosa={g}
                              disabled={
                                updMut.isPending &&
                                updMut.variables?.id === g.id
                              }
                              onRecuperar={(valor) =>
                                updMut.mutate({
                                  id: g.id,
                                  status: "recuperada",
                                  valorRecuperado: valor,
                                })
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updMut.mutate({
                                  id: g.id,
                                  status: "perdida",
                                })
                              }
                              disabled={
                                updMut.isPending &&
                                updMut.variables?.id === g.id
                              }
                              className="h-7 text-[11px] text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
                            >
                              Perdida
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// Recuperar glosa button — opens dialog to inform valor recuperado
function RecuperarGlosaButton({
  glosa,
  disabled,
  onRecuperar,
}: {
  glosa: Glosa;
  disabled: boolean;
  onRecuperar: (valor: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState<string>(String(glosa.valor ?? ""));

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="h-7 text-[11px] text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)]"
      >
        Recuperada
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-app)]">
              Valor recuperado da glosa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-app-muted)] bg-[var(--bg-app)] rounded-md p-2.5">
              Valor original glosado:{" "}
              <span className="font-mono tabular-nums text-[var(--danger-app)]">
                {brl(num(glosa.valor))}
              </span>
            </div>
            <Label className="text-[11px] text-[var(--text-app-muted)] block">
              Valor recuperado (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`${inputCls} font-mono tabular-nums text-right`}
              autoFocus
            />
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
                const v = num(valor);
                if (!(v >= 0)) {
                  toast.error("Valor inválido");
                  return;
                }
                onRecuperar(v);
                setOpen(false);
              }}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// 6. DRE
// ---------------------------------------------------------------------------
function DREPanel() {
  const usuario = useAuth((s) => s.usuario);
  const [mes, setMes] = useState<string>(mesAtual());

  const q = useQuery<DRE>({
    queryKey: ["financeiro", "dre", mes],
    queryFn: () =>
      apiFetch<DRE>(`/api/financeiro/dre?mes=${encodeURIComponent(mes)}`),
  });

  // Waterfall layout — base / sub / subtotal / total
  const linhas = useMemo(() => {
    if (!q.data) return [];
    const d = q.data;
    return [
      { label: "Receita bruta", valor: d.receitaBruta, tipo: "base" as const },
      { label: "(−) Glosas", valor: -d.glosas, tipo: "sub" as const },
      { label: "(−) Impostos", valor: -d.impostos, tipo: "sub" as const },
      {
        label: "= Receita líquida",
        valor: d.receitaLiquida,
        tipo: "subtotal" as const,
      },
      {
        label: "(−) Custos variáveis",
        valor: -d.custosVariaveis,
        tipo: "sub" as const,
      },
      {
        label: "= Margem de contribuição",
        valor: d.margemContribuicao,
        tipo: "subtotal" as const,
      },
      {
        label: "(−) Despesas fixas",
        valor: -d.despesasFixas,
        tipo: "sub" as const,
      },
      {
        label: "= Resultado operacional",
        valor: d.resultadoOperacional,
        tipo: "total" as const,
      },
    ];
  }, [q.data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <MonthPicker mes={mes} setMes={setMes} />

      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-[var(--text-app-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              DRE gerencial
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-app-muted)] hidden sm:inline">
              visão cascata
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!q.data}
              onClick={() => {
                if (!q.data) return;
                exportarCSV(
                  [{ ...q.data, mes }],
                  `dre-${mes}`,
                  [
                    { chave: "mes", label: "Mês" },
                    { chave: "receitaBruta", label: "Receita bruta", format: (v) => fmtBRL(v) },
                    { chave: "glosas", label: "Glosas", format: (v) => fmtBRL(v) },
                    { chave: "impostos", label: "Impostos", format: (v) => fmtBRL(v) },
                    { chave: "receitaLiquida", label: "Receita líquida", format: (v) => fmtBRL(v) },
                    { chave: "custosVariaveis", label: "Custos variáveis", format: (v) => fmtBRL(v) },
                    { chave: "margemContribuicao", label: "Margem de contribuição", format: (v) => fmtBRL(v) },
                    { chave: "despesasFixas", label: "Despesas fixas", format: (v) => fmtBRL(v) },
                    { chave: "resultadoOperacional", label: "Resultado operacional", format: (v) => fmtBRL(v) },
                  ]
                );
              }}
              className="h-7 text-[11px] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
            >
              <Download size={12} className="mr-1" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!q.data}
              onClick={() => {
                if (!q.data) return;
                imprimirTabela(
                  "DRE Gerencial",
                  `${nomeMes(mes)} · ${usuario?.clinica.nome ?? ""}`,
                  [
                    { label: "Linha" },
                    { label: "Valor (R$)", format: (r) => fmtBRL(r.valor) },
                  ],
                  linhas.map((l) => ({ linha: l.label, valor: l.valor })),
                  "var(--accent-app)"
                );
              }}
              className="h-7 text-[11px] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
            >
              <Printer size={12} className="mr-1" /> Imprimir
            </Button>
          </div>
        </div>

        {q.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-full bg-[var(--bg-app-alt-strong)] rounded-md"
              />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState
            message={q.error?.message ?? "Falha ao carregar DRE"}
            onRetry={() => q.refetch()}
          />
        ) : !q.data ? null : (
          <div className="max-w-lg">
            {linhas.map((l, i) => {
              const isSubtotal = l.tipo === "subtotal";
              const isTotal = l.tipo === "total";
              const isSub = l.tipo === "sub";
              const valor = l.valor;
              const isPositive = valor >= 0;
              return (
                <div
                  key={i}
                  className={`flex justify-between items-center px-4 py-3 ${
                    isTotal
                      ? "bg-[var(--accent-app-soft-bg)]"
                      : isSubtotal
                      ? "bg-[var(--bg-app)]"
                      : ""
                  } ${
                    i > 0 ? "border-t border-[var(--border-app-subtle)]" : ""
                  } ${isSub ? "pl-8" : ""}`}
                >
                  <span
                    className={`text-sm ${
                      isTotal
                        ? "font-semibold text-[var(--text-app)]"
                        : isSubtotal
                        ? "font-medium text-[var(--text-app)]"
                        : isSub
                        ? "text-[var(--text-app-muted)]"
                        : "text-[var(--text-app)]"
                    }`}
                  >
                    {l.label}
                  </span>
                  <span
                    className={`font-mono tabular-nums text-sm ${
                      isTotal
                        ? valor >= 0
                          ? "text-[var(--accent-app-text)] font-semibold"
                          : "text-[var(--danger-app)] font-semibold"
                        : isSubtotal
                        ? "font-medium text-[var(--text-app)]"
                        : isSub
                        ? valor < 0
                          ? "text-[var(--danger-app)]"
                          : "text-[var(--text-app-muted)]"
                        : isPositive
                        ? "text-[var(--text-app)]"
                        : "text-[var(--danger-app)]"
                    }`}
                  >
                    {brl(valor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[var(--text-app-muted)] px-1">
        A DRE gerencial mostra o resultado operacional do mês: receita bruta
        menos glosas e impostos = receita líquida; menos custos variáveis =
        margem de contribuição; menos despesas fixas = resultado operacional.
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 7. Rentabilidade
// ---------------------------------------------------------------------------
function RentabilidadePanel() {
  const [mes, setMes] = useState<string>(mesAtual());
  const [agrupar, setAgrupar] = useState<string>("procedimento");

  const rentQ = useQuery<GrupoRentabilidade[]>({
    queryKey: ["financeiro", "rentabilidade", mes, agrupar],
    queryFn: () =>
      apiFetch<GrupoRentabilidade[]>(
        `/api/financeiro/rentabilidade?mes=${encodeURIComponent(
          mes
        )}&agrupar=${encodeURIComponent(agrupar)}`
      ),
    enabled: agrupar !== "equipamento",
  });

  const equipQ = useQuery<RentabilidadePorEquipamento[]>({
    queryKey: ["financeiro", "rentabilidade-equipamento", mes],
    queryFn: () =>
      apiFetch<RentabilidadePorEquipamento[]>(
        `/api/financeiro/rentabilidade-equipamento?mes=${encodeURIComponent(
          mes
        )}`
      ),
    enabled: agrupar === "equipamento",
  });

  const fluxoQ = useQuery<FluxoProjetado>({
    queryKey: ["financeiro", "fluxo-projetado", 30],
    queryFn: () =>
      apiFetch<FluxoProjetado>(`/api/financeiro/fluxo-projetado?dias=30`),
  });

  // Bar chart data — top 10 grupos por resultado
  const chartData = useMemo(() => {
    const arr = (rentQ.data ?? []).slice();
    arr.sort((a, b) => b.resultado - a.resultado);
    return arr.slice(0, 10);
  }, [rentQ.data]);

  const totalResultado = useMemo(
    () => (rentQ.data ?? []).reduce((s, g) => s + g.resultado, 0),
    [rentQ.data]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <MonthPicker mes={mes} setMes={setMes} />

      {/* Agrupar buttons */}
      <div className="flex gap-1 flex-wrap">
        {[
          { id: "procedimento", label: "Por exame" },
          { id: "convenio", label: "Por convênio" },
          { id: "dentista", label: "Por dentista" },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setAgrupar(o.id)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              agrupar === o.id
                ? "bg-[var(--accent-app)] text-white"
                : "border border-[var(--border-app)] text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Resultado total + Bar chart */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Resultado total do mês"
          value={brl(totalResultado)}
          icon={<TrendingUp size={16} />}
          accent={totalResultado >= 0}
          danger={totalResultado < 0}
        />
        <StatCard
          label="Grupos analisados"
          value={String((rentQ.data ?? []).length)}
          icon={<LayoutGrid size={16} />}
        />
        <StatCard
          label="Agrupamento"
          value={
            agrupar === "convenio"
              ? "Convênio"
              : agrupar === "dentista"
              ? "Dentista"
              : "Procedimento"
          }
          icon={<ScrollText size={16} />}
        />
      </div>

      {/* Bar chart top 10 por resultado */}
      {agrupar !== "equipamento" && (
        <Card className={cardCls}>
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Top 10 grupos por resultado
            </h3>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              verde = lucro, vermelho = prejuízo
            </span>
          </div>
          {rentQ.isLoading ? (
            <Skeleton className="m-4 h-64 shimmer rounded-md" />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={22} strokeWidth={1.5} />}
              title="Sem dados faturados neste mês"
              hint="Marque contas a receber como recebido/parcial para alimentar a análise de rentabilidade."
            />
          ) : (
            <div className="p-4" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 80 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-app)"
                  />
                  <XAxis
                    dataKey="chave"
                    tick={{ fontSize: 10, fill: "var(--text-app-muted)" }}
                    stroke="var(--border-app)"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-app-muted)" }}
                    stroke="var(--border-app)"
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <Tooltip
                    content={<ChartTooltipBox formatter={brl} />}
                    cursor={{ fill: "var(--bg-app-alt-strong)", opacity: 0.3 }}
                  />
                  <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
                    {chartData.map((g, i) => (
                      <Cell
                        key={i}
                        fill={
                          g.resultado >= 0
                            ? "var(--accent-app)"
                            : "var(--danger-app)"
                        }
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}

      {/* Main table */}
      {agrupar !== "equipamento" && (
        <Card className={cardCls}>
          <div className="px-4 py-2 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-app)]">
                Rentabilidade por{" "}
                {agrupar === "convenio"
                  ? "convênio"
                  : agrupar === "dentista"
                  ? "dentista"
                  : "exame"}
              </h3>
              <span className="text-[11px] text-[var(--text-app-muted)]">
                {(rentQ.data ?? []).length}{" "}
                {(rentQ.data ?? []).length === 1 ? "grupo" : "grupos"}
              </span>
            </div>
            {(rentQ.data ?? []).length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportarCSV(
                      rentQ.data ?? [],
                      `rentabilidade-${agrupar}-${mes}`,
                      [
                        { chave: "chave", label: agrupar === "convenio" ? "Convênio" : agrupar === "dentista" ? "Dentista" : "Procedimento" },
                        { chave: "quantidade", label: "Quantidade" },
                        { chave: "receita", label: "Receita", format: (v) => fmtBRL(v) },
                        { chave: "custo", label: "Custo", format: (v) => fmtBRL(v) },
                        { chave: "resultado", label: "Resultado", format: (v) => fmtBRL(v) },
                        { chave: "margem", label: "Margem", format: (v) => fmtPct(v) },
                        { chave: "ticketMedio", label: "Ticket médio", format: (v) => fmtBRL(v) },
                      ]
                    )
                  }
                  className="h-7 text-[11px] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
                >
                  <Download size={12} className="mr-1" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    imprimirTabela(
                      `Rentabilidade por ${agrupar}`,
                      `${nomeMes(mes)} · ${rentQ.data?.length ?? 0} grupo(s)`,
                      [
                        { label: agrupar === "convenio" ? "Convênio" : agrupar === "dentista" ? "Dentista" : "Procedimento" },
                        { label: "Qtd", format: (r) => String(r.quantidade ?? 0) },
                        { label: "Receita", format: (r) => fmtBRL(r.receita as number) },
                        { label: "Custo", format: (r) => fmtBRL(r.custo as number) },
                        { label: "Resultado", format: (r) => fmtBRL(r.resultado as number) },
                        { label: "Margem", format: (r) => fmtPct(r.margem as number) },
                        { label: "Ticket médio", format: (r) => fmtBRL(r.ticketMedio as number) },
                      ],
                      (rentQ.data ?? []) as unknown as Record<string, unknown>[]
                    )
                  }
                  className="h-7 text-[11px] border-[var(--border-app)] text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
                >
                  <Printer size={12} className="mr-1" /> Imprimir
                </Button>
              </div>
            )}
          </div>

          {rentQ.isLoading ? (
            <TableSkeleton cols={7} />
          ) : rentQ.isError ? (
            <ErrorState
              message={rentQ.error?.message ?? "Falha ao carregar"}
              onRetry={() => rentQ.refetch()}
            />
          ) : (rentQ.data ?? []).length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={22} strokeWidth={1.5} />}
              title="Sem dados faturados neste mês"
            />
          ) : (
            <div className="max-h-96 overflow-y-auto scroll-thin">
              <Table className="text-sm">
                <TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">
                  <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                    <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                      {agrupar === "convenio"
                        ? "Convênio"
                        : agrupar === "dentista"
                        ? "Dentista"
                        : "Exame"}
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                      Qtd
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                      Receita
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                      Custo
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                      Resultado
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                      Margem
                    </TableHead>
                    <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                      Ticket médio
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rentQ.data ?? [])
                    .slice()
                    .sort((a, b) => b.resultado - a.resultado)
                    .map((d, i) => (
                      <TableRow
                        key={i}
                        className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40"
                      >
                        <TableCell className="px-4 py-2 text-sm text-[var(--text-app)] truncate max-w-[200px]">
                          {d.chave}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
                          {d.quantidade}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app)]">
                          {brl(d.receita)}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app-muted)]">
                          {brl(d.custo)}
                        </TableCell>
                        <TableCell
                          className={`px-4 py-2 text-right font-mono tabular-nums ${
                            d.resultado >= 0
                              ? "text-[var(--accent-app-text)]"
                              : "text-[var(--danger-app)]"
                          }`}
                        >
                          {brl(d.resultado)}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
                          {pct(d.margem)}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
                          {brl(d.ticketMedio)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Rentabilidade por equipamento */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--text-app-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Rentabilidade por equipamento (R$/hora)
            </h3>
          </div>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            {(equipQ.data ?? []).length}{" "}
            {(equipQ.data ?? []).length === 1 ? "equipamento" : "equipamentos"}
          </span>
        </div>

        {equipQ.isLoading ? (
          <TableSkeleton cols={6} />
        ) : equipQ.isError ? (
          <ErrorState
            message={equipQ.error?.message ?? "Falha ao carregar"}
            onRetry={() => equipQ.refetch()}
          />
        ) : (equipQ.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Clock size={22} strokeWidth={1.5} />}
            title="Nenhum exame vinculado a um equipamento neste mês"
            hint={"Associe um equipamento a cada procedimento na aba \"Procedimentos\" para calcular a rentabilidade por hora de uso."}
          />
        ) : (
          <div className="max-h-72 overflow-y-auto scroll-thin">
            <Table className="text-sm">
              <TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">
                <TableRow className="border-[var(--border-app)] hover:bg-transparent">
                  <TableHead className="text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Equipamento
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Exames
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Horas
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Receita
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Receita/h
                  </TableHead>
                  <TableHead className="text-right text-[var(--text-app-muted)] text-[11px] uppercase tracking-wide font-normal px-4 py-2">
                    Lucro/h
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(equipQ.data ?? []).map((e, i) => (
                  <TableRow
                    key={i}
                    className="border-t border-[var(--border-app-subtle)] hover:bg-[var(--bg-app)]/40"
                  >
                    <TableCell className="px-4 py-2 text-sm text-[var(--text-app)]">
                      {e.equipamento}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
                      {e.quantidade}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app-secondary)]">
                      {e.horas.toFixed(1)}h
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--text-app)]">
                      {brl(e.receitaTotal)}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-[var(--accent-app-text)]">
                      {brl(e.receitaPorHora)}
                    </TableCell>
                    <TableCell
                      className={`px-4 py-2 text-right font-mono tabular-nums ${
                        e.lucroPorHora >= 0
                          ? "text-[var(--accent-app-text)]"
                          : "text-[var(--danger-app)]"
                      }`}
                    >
                      {brl(e.lucroPorHora)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Fluxo de caixa projetado */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-[var(--text-app-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Fluxo de caixa projetado (30 dias)
            </h3>
          </div>
          <span className="text-[11px] text-[var(--text-app-muted)]">
            contas a receber/pagar em aberto
          </span>
        </div>
        {fluxoQ.isLoading ? (
          <div className="p-4 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-20 bg-[var(--bg-app-alt-strong)] rounded-md"
              />
            ))}
          </div>
        ) : fluxoQ.isError ? (
          <ErrorState
            message={fluxoQ.error?.message ?? "Falha ao carregar"}
            onRetry={() => fluxoQ.refetch()}
          />
        ) : !fluxoQ.data ? null : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Recebimentos previstos"
              value={brl(fluxoQ.data.recebimentosPrevistos)}
              icon={<ArrowDownCircle size={16} />}
              accent
            />
            <StatCard
              label="Pagamentos previstos"
              value={brl(fluxoQ.data.pagamentosPrevistos)}
              icon={<ArrowUpCircle size={16} />}
              danger
            />
            <StatCard
              label="Saldo projetado"
              value={brl(fluxoQ.data.saldoProjetado)}
              sub={
                fluxoQ.data.saldoProjetado >= 0
                  ? "caixa positivo"
                  : "caixa negativo"
              }
              icon={<TrendingUp size={16} />}
              accent={fluxoQ.data.saldoProjetado >= 0}
              danger={fluxoQ.data.saldoProjetado < 0}
            />
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 8. Lotes
// ---------------------------------------------------------------------------
function LotesPanel({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [expandedLote, setExpandedLote] = useState<string | null>(null);
  const [fecharOpen, setFecharOpen] = useState(false);

  const lotesQ = useQuery<LoteFaturamento[]>({
    queryKey: ["lotes"],
    queryFn: () => apiFetch<LoteFaturamento[]>("/api/lotes"),
  });

  const conveniosQ = useQuery<Convenio[]>({
    queryKey: ["convenios"],
    queryFn: () => apiFetch<Convenio[]>("/api/convenios"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lotes"] });
    queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro"] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Header actions */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PackageCheck size={16} className="text-[var(--text-app-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Lotes de faturamento
            </h3>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              {(lotesQ.data ?? []).length}{" "}
              {(lotesQ.data ?? []).length === 1 ? "lote" : "lotes"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => lotesQ.refetch()}
              className="h-8 text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
            >
              <RefreshCw size={13} /> Atualizar
            </Button>
            {podeEditar && (
              <Button
                type="button"
                size="sm"
                onClick={() => setFecharOpen(true)}
                className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
              >
                <Plus size={14} /> Fechar novo lote
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Lista de lotes */}
      <Card className={cardCls}>
        {lotesQ.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-12 w-full bg-[var(--bg-app-alt-strong)] rounded-md"
              />
            ))}
          </div>
        ) : lotesQ.isError ? (
          <ErrorState
            message={lotesQ.error?.message ?? "Falha ao carregar"}
            onRetry={() => lotesQ.refetch()}
          />
        ) : (lotesQ.data ?? []).length === 0 ? (
          <EmptyState
            icon={<PackageCheck size={22} strokeWidth={1.5} />}
            title="Nenhum lote fechado ainda"
            hint={
              podeEditar
                ? "Use \"Fechar novo lote\" para agrupar contas a receber de um convênio em um período e enviá-las para faturamento."
                : "Aguarde o gestor fechar o primeiro lote."
            }
          />
        ) : (
          <div className="divide-y divide-[var(--border-app-subtle)]">
            {(lotesQ.data ?? []).map((l) => {
              const expanded = expandedLote === l.id;
              return (
                <div key={l.id} className="px-4">
                  <button
                    type="button"
                    onClick={() => setExpandedLote(expanded ? null : l.id)}
                    className="w-full flex items-center gap-3 py-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--text-app)] truncate">
                        {l.convenioNome || "—"}
                      </div>
                      <div className="text-[11px] text-[var(--text-app-muted)] truncate">
                        {dataBR(l.periodoInicio)} – {dataBR(l.periodoFim)} ·{" "}
                        {l.quantidade} exames · fechado em{" "}
                        {dataBR(l.fechadoEm.slice(0, 10))}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-sm text-[var(--accent-app-text)] shrink-0">
                      {brl(num(l.valor))}
                    </span>
                    <ChevronRight
                      size={14}
                      className={`text-[var(--text-app-muted)] shrink-0 transition-transform ${
                        expanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  {expanded && (
                    <LoteContas loteId={l.id} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Fechar novo lote dialog */}
      {fecharOpen && (
        <FecharLoteDialog
          open={fecharOpen}
          onOpenChange={setFecharOpen}
          convenios={conveniosQ.data ?? []}
          onSaved={() => {
            invalidate();
            setFecharOpen(false);
          }}
        />
      )}
    </motion.div>
  );
}

// Lote contas (expanded view)
function LoteContas({ loteId }: { loteId: string }) {
  const q = useQuery<ContaReceber[]>({
    queryKey: ["lotes", loteId, "contas"],
    queryFn: () =>
      apiFetch<ContaReceber[]>(`/api/lotes/${loteId}/contas`),
  });

  if (q.isLoading) {
    return (
      <div className="pb-3 space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-8 w-full bg-[var(--bg-app-alt-strong)] rounded-md"
          />
        ))}
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="pb-3 text-xs text-[var(--danger-app)]">
        {(q.error as Error)?.message ?? "Falha ao carregar contas"}
      </div>
    );
  }
  if ((q.data ?? []).length === 0) {
    return (
      <div className="pb-3 text-xs text-[var(--text-app-muted)]">
        Nenhuma conta vinculada.
      </div>
    );
  }

  return (
    <div className="pb-3 space-y-1">
      {(q.data ?? []).map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2 text-xs bg-[var(--bg-app)] rounded-md px-3 py-1.5"
        >
          <div className="flex-1 min-w-0">
            <span className="text-[var(--text-app-secondary)]">
              {c.pacienteNome || "(sem paciente)"}
            </span>
            <span className="text-[var(--text-app-faint)] mx-1">·</span>
            <span className="text-[var(--text-app-muted)]">
              {c.procedimentoNome || "sem procedimento"}
            </span>
          </div>
          <span className="font-mono tabular-nums text-[var(--text-app)] shrink-0">
            {brl(num(c.valorFaturado))}
          </span>
        </div>
      ))}
    </div>
  );
}

// Fechar lote dialog — ver produção + fechar
function FecharLoteDialog({
  open,
  onOpenChange,
  convenios,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  convenios: Convenio[];
  onSaved: () => void;
}) {
  const [convenioSel, setConvenioSel] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState<string>(
    hoje().slice(0, 8) + "01"
  );
  const [periodoFim, setPeriodoFim] = useState<string>(hoje());
  const [producao, setProducao] = useState<ProducaoConvenio[] | null>(null);
  const [loadingProducao, setLoadingProducao] = useState(false);
  const [fechando, setFechando] = useState(false);

  function verProducao() {
    if (!convenioSel) {
      toast.error("Selecione um convênio");
      return;
    }
    if (!periodoInicio || !periodoFim) {
      toast.error("Informe o período");
      return;
    }
    setLoadingProducao(true);
    apiFetch<ProducaoConvenio[]>(
      `/api/convenios/${convenioSel}/producao?periodoInicio=${periodoInicio}&periodoFim=${periodoFim}`
    )
      .then((data) => setProducao(data))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoadingProducao(false));
  }

  function fecharLote() {
    if (!convenioSel) {
      toast.error("Selecione um convênio");
      return;
    }
    setFechando(true);
    apiFetch<LoteFaturamento>(`/api/convenios/${convenioSel}/lotes`, {
      method: "POST",
      body: JSON.stringify({ periodoInicio, periodoFim }),
    })
      .then(() => {
        toast.success("Lote fechado");
        setProducao(null);
        onSaved();
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setFechando(false));
  }

  const semPendencia = producao
    ? producao.filter((p) => p.pendencias.length === 0)
    : [];
  const comPendencia = producao
    ? producao.filter((p) => p.pendencias.length > 0)
    : [];
  const valorTotal = semPendencia.reduce(
    (s, p) => s + num(p.valorFaturado),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            Fechar novo lote de faturamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Convênio
              </Label>
              <select
                value={convenioSel}
                onChange={(e) => {
                  setConvenioSel(e.target.value);
                  setProducao(null);
                }}
                className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
              >
                <option value="">Selecione o convênio</option>
                {convenios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Início
              </Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => {
                  setPeriodoInicio(e.target.value);
                  setProducao(null);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                Fim
              </Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => {
                  setPeriodoFim(e.target.value);
                  setProducao(null);
                }}
                className={inputCls}
              />
            </div>
            <Button
              type="button"
              onClick={verProducao}
              disabled={!convenioSel || loadingProducao}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-9"
            >
              {loadingProducao ? "Carregando…" : "Ver produção"}
            </Button>
          </div>

          {producao && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-[var(--text-app-muted)]">
                {semPendencia.length} exame(s) pronto(s) para faturar ·{" "}
                {comPendencia.length} com pendência
              </p>

              {comPendencia.length > 0 && (
                <div className="bg-[var(--warning-app-bg)] border border-[var(--warning-app-border)] rounded-lg p-2.5 text-xs text-[var(--warning-app)] space-y-1 max-h-40 overflow-y-auto scroll-thin">
                  {comPendencia.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-1">
                      <span className="text-[var(--text-app-secondary)]">
                        {p.pacienteNome || "(sem paciente)"}
                      </span>
                      <span className="text-[var(--text-app-muted)]">—</span>
                      {p.pendencias.map((pp, i) => (
                        <span
                          key={i}
                          className="inline-block text-[10px] bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)] rounded-full px-1.5 py-0.5"
                        >
                          {pp}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {semPendencia.length > 0 && (
                <div className="flex items-center justify-between bg-[var(--accent-app-soft-bg)] rounded-lg p-3 gap-3 flex-wrap">
                  <div className="text-sm text-[var(--accent-app-text)]">
                    <span className="font-mono tabular-nums">
                      {semPendencia.length}
                    </span>{" "}
                    exames ·{" "}
                    <span className="font-mono tabular-nums font-semibold">
                      {brl(valorTotal)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={fecharLote}
                    disabled={fechando}
                    className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
                  >
                    <PackageCheck size={13} />{" "}
                    {fechando ? "Fechando…" : "Fechar lote"}
                  </Button>
                </div>
              )}

              {semPendencia.length === 0 && (
                <div className="text-xs text-[var(--warning-app)] bg-[var(--warning-app-bg)] rounded-md p-2.5">
                  Nenhum exame pronto para faturar neste período (todos com
                  pendência). Resolva as pendências antes de fechar o lote.
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
            >
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 9. Conciliação bancária
// ---------------------------------------------------------------------------
function ConciliacaoPanel({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState<string>(mesAtual());
  const [novoOpen, setNovoOpen] = useState(false);

  const concQ = useQuery<Conciliacao>({
    queryKey: ["financeiro", "conciliacao", mes],
    queryFn: () =>
      apiFetch<Conciliacao>(
        `/api/financeiro/conciliacao?mes=${encodeURIComponent(mes)}`
      ),
  });

  const movQ = useQuery<MovimentoBancario[]>({
    queryKey: ["movimentos-bancarios", mes],
    queryFn: () =>
      apiFetch<MovimentoBancario[]>(
        `/api/movimentos-bancarios?mes=${encodeURIComponent(mes)}`
      ),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["financeiro", "conciliacao"] });
    queryClient.invalidateQueries({ queryKey: ["movimentos-bancarios"] });
  };

  const delMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/movimentos-bancarios/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Movimento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entradaDiff = concQ.data
    ? Math.abs(concQ.data.diferencaEntradas) < 0.01
    : true
  const saidaDiff = concQ.data
    ? Math.abs(concQ.data.diferencaSaidas) < 0.01
    : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <MonthPicker mes={mes} setMes={setMes} />

      {/* Conciliation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Entradas */}
        <Card className={cardCls}>
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center gap-2">
            <ArrowDownCircle
              size={16}
              className="text-[var(--accent-app-text)]"
            />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Entradas
            </h3>
          </div>
          {concQ.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-6 w-full bg-[var(--bg-app-alt-strong)]"
                />
              ))}
            </div>
          ) : concQ.isError ? (
            <ErrorState
              message={concQ.error?.message ?? "Falha ao carregar"}
              onRetry={() => concQ.refetch()}
            />
          ) : !concQ.data ? null : (
            <div className="p-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-app-muted)]">
                  Sistema (recebido)
                </span>
                <span className="font-mono tabular-nums text-[var(--text-app)]">
                  {brl(concQ.data.recebidoSistema)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-app-muted)]">
                  Extrato bancário
                </span>
                <span className="font-mono tabular-nums text-[var(--text-app)]">
                  {brl(concQ.data.entradasBanco)}
                </span>
              </div>
              <div
                className={`flex justify-between text-sm pt-1 border-t border-[var(--border-app-subtle)] font-medium ${
                  entradaDiff
                    ? "text-[var(--accent-app-text)]"
                    : "text-[var(--danger-app)]"
                }`}
              >
                <span>Diferença</span>
                <span className="font-mono tabular-nums">
                  {brl(concQ.data.diferencaEntradas)}
                </span>
              </div>
              {!entradaDiff && (
                <p className="text-[11px] text-[var(--danger-app)] mt-1">
                  Diferença detectada — verifique recebimentos não lançados no
                  sistema ou lançamentos bancários faltantes.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Saídas */}
        <Card className={cardCls}>
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center gap-2">
            <ArrowUpCircle
              size={16}
              className="text-[var(--danger-app)]"
            />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Saídas
            </h3>
          </div>
          {concQ.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-6 w-full bg-[var(--bg-app-alt-strong)]"
                />
              ))}
            </div>
          ) : concQ.isError ? (
            <ErrorState
              message={concQ.error?.message ?? "Falha ao carregar"}
              onRetry={() => concQ.refetch()}
            />
          ) : !concQ.data ? null : (
            <div className="p-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-app-muted)]">
                  Sistema (pago)
                </span>
                <span className="font-mono tabular-nums text-[var(--text-app)]">
                  {brl(concQ.data.pagoSistema)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-app-muted)]">
                  Extrato bancário
                </span>
                <span className="font-mono tabular-nums text-[var(--text-app)]">
                  {brl(concQ.data.saidasBanco)}
                </span>
              </div>
              <div
                className={`flex justify-between text-sm pt-1 border-t border-[var(--border-app-subtle)] font-medium ${
                  saidaDiff
                    ? "text-[var(--accent-app-text)]"
                    : "text-[var(--danger-app)]"
                }`}
              >
                <span>Diferença</span>
                <span className="font-mono tabular-nums">
                  {brl(concQ.data.diferencaSaidas)}
                </span>
              </div>
              {!saidaDiff && (
                <p className="text-[11px] text-[var(--danger-app)] mt-1">
                  Diferença detectada — verifique contas pagas no sistema sem
                  débito bancário ou vice-versa.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Movimentos bancários */}
      <Card className={cardCls}>
        <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Landmark size={16} className="text-[var(--text-app-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--text-app)]">
              Extrato lançado manualmente
            </h3>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              {(movQ.data ?? []).length}{" "}
              {(movQ.data ?? []).length === 1 ? "movimento" : "movimentos"}
            </span>
          </div>
          {podeEditar && (
            <Button
              type="button"
              size="sm"
              onClick={() => setNovoOpen(true)}
              className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] h-8"
            >
              <Plus size={14} /> Lançar movimento
            </Button>
          )}
        </div>

        {movQ.isLoading ? (
          <TableSkeleton cols={4} />
        ) : movQ.isError ? (
          <ErrorState
            message={movQ.error?.message ?? "Falha ao carregar"}
            onRetry={() => movQ.refetch()}
          />
        ) : (movQ.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Landmark size={22} strokeWidth={1.5} />}
            title="Nenhum movimento lançado neste mês"
            hint={
              podeEditar
                ? "Lance entradas e saídas do extrato bancário para fazer a conciliação."
                : "Aguarde o gestor lançar movimentos."
            }
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-thin divide-y divide-[var(--border-app-subtle)]">
            {(movQ.data ?? []).map((m) => {
              const valor = num(m.valor);
              const isEntrada = valor >= 0;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-app)]/40"
                >
                  <span className="text-xs text-[var(--text-app-muted)] w-20 shrink-0">
                    {dataBR(m.data)}
                  </span>
                  <span className="flex-1 text-sm text-[var(--text-app)] truncate">
                    {m.descricao || "(sem descrição)"}
                  </span>
                  <span
                    className={`font-mono tabular-nums text-sm shrink-0 ${
                      isEntrada
                        ? "text-[var(--accent-app-text)]"
                        : "text-[var(--danger-app)]"
                    }`}
                  >
                    {brl(valor)}
                  </span>
                  {podeEditar && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[var(--text-app-muted)] hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[var(--surface-app)] border-[var(--border-app)]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-[var(--text-app)]">
                            Remover movimento?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-[var(--text-app-muted)]">
                            O movimento{" "}
                            "{m.descricao || "(sem descrição)"}" de{" "}
                            {brl(valor)} será removido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-transparent border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]">
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => delMut.mutate(m.id)}
                            className="bg-[var(--danger-app)] text-white hover:bg-[var(--danger-app)]/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {novoOpen && (
        <NovoMovimentoDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          onSaved={() => {
            invalidate();
            setNovoOpen(false);
          }}
        />
      )}
    </motion.div>
  );
}

function NovoMovimentoDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<string>(hoje());
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<string>("entrada");
  const [valor, setValor] = useState("");

  function handleSubmit() {
    if (!data) {
      toast.error("Informe a data");
      return;
    }
    const v = num(valor);
    if (!(v >= 0)) {
      toast.error("Valor inválido");
      return;
    }
    const valorFinal = tipo === "saida" ? -Math.abs(v) : Math.abs(v);
    apiFetch<MovimentoBancario>("/api/movimentos-bancarios", {
      method: "POST",
      body: JSON.stringify({
        data,
        descricao: descricao.trim() || undefined,
        valor: valorFinal,
      }),
    })
      .then(() => {
        toast.success("Movimento lançado");
        onSaved();
        // reset
        setData(hoje());
        setDescricao("");
        setTipo("entrada");
        setValor("");
      })
      .catch((e: Error) => toast.error(e.message));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-app)]">
            Lançar movimento bancário
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Data
            </Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Descrição
            </Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: TED recebida, taxa bancária…"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Tipo
            </Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={`w-full h-9 rounded-md border px-2.5 text-sm ${selectCls}`}
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
              Valor (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className={`${inputCls} font-mono tabular-nums text-right`}
            />
          </div>
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
            onClick={handleSubmit}
            className="bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
