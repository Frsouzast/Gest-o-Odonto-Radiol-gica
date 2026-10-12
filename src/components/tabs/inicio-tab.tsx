"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, useAuth } from "@/lib/auth-store";
import { brl, pct, hoje, mesAtual, dataBR, nomeMes } from "@/lib/utils";
import {
  Wallet, CalendarDays, Calculator, Settings2, TrendingUp, TrendingDown,
  Clock, AlertTriangle, ArrowRight, Activity, Users, Receipt, CheckCircle2,
  Building2, Info, type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SetupGuide } from "@/components/app/setup-guide";
import { FluxXMark } from "@/components/app/flux-x-mark";
import { Sparkline, BarSparkline } from "@/components/app/sparkline";
import { DonutChart, DonutLegend, type DonutSlice } from "@/components/app/donut-chart";
import {
  Tooltip as UITooltip,
  TooltipTrigger as UITooltipTrigger,
  TooltipContent as UITooltipContent,
} from "@/components/ui/tooltip";

type AbaId = "inicio" | "custos" | "procedimentos" | "agenda" | "financeiro" | "usuarios";

interface ResumoFinanceiro {
  receitas: number;
  despesas: number;
  resultado: number;
  aReceber: number;
  aPagar: number;
  inadimplencia: number;
  receitaPorOrigem: { origem: string; valor: number }[];
}

interface ResumoCustos {
  custoFixoTotal: number;
  depreciacaoMensalTotal: number;
  horasEfetivas: number;
  custoFixoPorHora: number;
  custoFixoPorMinuto: number;
}

interface MesHistorico {
  mes: string; // "YYYY-MM"
  receitas: number;
  despesas: number;
  resultado: number;
  aReceber: number;
  aPagar: number;
}

interface Agendamento {
  id: string;
  nome: string;
  hora: string | null;
  exame: string | null;
  status: string;
}

interface Procedimento {
  id: string;
  nome: string;
  tempoMinutos: number;
  precoFinal: number | null;
}

interface InicioTabProps {
  onNavegar: (aba: AbaId) => void;
}

export function InicioTab({ onNavegar }: InicioTabProps) {
  const usuario = useAuth((s) => s.usuario);
  const papel = usuario?.papel;
  const podeEditar = papel === "dono" || papel === "financeiro";
  const mes = mesAtual();
  const dataHoje = hoje();

  const financeiroQ = useQuery<ResumoFinanceiro>({
    queryKey: ["financeiro", "resumo", mes],
    queryFn: () => apiFetch(`/api/financeiro/resumo?mes=${mes}`),
    enabled: podeEditar,
    retry: 0,
  });

  const custosQ = useQuery<ResumoCustos>({
    queryKey: ["resumo"],
    queryFn: () => apiFetch(`/api/resumo`),
    enabled: podeEditar,
    retry: 0,
  });

  const agendamentosQ = useQuery<Agendamento[]>({
    queryKey: ["agendamentos", dataHoje],
    queryFn: () => apiFetch(`/api/agendamentos?data=${dataHoje}`),
    retry: 0,
  });

  const procedimentosQ = useQuery<Procedimento[]>({
    queryKey: ["procedimentos"],
    queryFn: () => apiFetch(`/api/procedimentos`),
    retry: 0,
  });

  // Histórico 6 meses — para sparklines
  const historicoQ = useQuery<MesHistorico[]>({
    queryKey: ["financeiro", "historico-6-meses"],
    queryFn: () => apiFetch(`/api/financeiro/historico-6-meses`),
    enabled: podeEditar,
    retry: 0,
  });

  const saudacao = usarSaudacao();
  const primeiroNome = usuario?.nome.split(" ")[0] || "";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero / Saudação */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl bg-[var(--brand-navy)] text-white p-5 sm:p-6 shadow-sm"
      >
        <FluxXMark className="absolute -right-8 -top-12 h-56 w-56 opacity-[0.12]" monochrome />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70 mb-1">
              {saudacao}, {primeiroNome}
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold mb-1">
              Visão geral da clínica
            </h1>
            <p className="text-sm text-white/80">
              {nomeMes(mes)} · {dataBR(dataHoje)}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 border border-white/15">
            <Building2 size={18} />
            <span className="text-xs font-medium uppercase tracking-wide">{usuario?.clinica.nome}</span>
          </div>
        </div>
      </motion.div>

      {podeEditar && <SetupGuide onNavegar={onNavegar} />}

      {/* KPIs principais — Financeiro do mês */}
      {podeEditar && (
        <section>
          <SectionHeader
            icon={Wallet}
            title="Financeiro do mês"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavegar("financeiro")}
                className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
              >
                Ver detalhes <ArrowRight size={14} className="ml-1" />
              </Button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              label="Receitas"
              value={financeiroQ.data?.receitas}
              loading={financeiroQ.isLoading}
              icon={TrendingUp}
              accent="positive"
              descricao="Soma dos valores recebidos (parcial ou total) neste mês. Inclui contas marcadas como 'recebido' ou 'parcial'."
            />
            <KpiCard
              label="Despesas pagas"
              value={financeiroQ.data?.despesas}
              loading={financeiroQ.isLoading}
              icon={TrendingDown}
              accent="negative"
              descricao="Soma das contas a pagar marcadas como 'pago' cujo vencimento cai neste mês."
            />
            <KpiCard
              label="Resultado"
              value={financeiroQ.data?.resultado}
              loading={financeiroQ.isLoading}
              icon={Activity}
              accent={Number(financeiroQ.data?.resultado) >= 0 ? "positive" : "negative"}
              descricao="Receitas menos despesas pagas no mês. Não inclui contas em aberto (use 'A receber' e 'A pagar' para isso)."
            />
            <KpiCard
              label="A receber"
              value={financeiroQ.data?.aReceber}
              loading={financeiroQ.isLoading}
              icon={Receipt}
              descricao="Soma das contas a receber em aberto (status 'aberto', 'vencido' ou 'parcial') em qualquer mês."
            />
            <KpiCard
              label="A pagar"
              value={financeiroQ.data?.aPagar}
              loading={financeiroQ.isLoading}
              icon={Clock}
              descricao="Soma das contas a pagar em aberto (status 'aberto' ou 'vencido') em qualquer mês."
            />
            <KpiCard
              label="Inadimplência"
              value={financeiroQ.data?.inadimplencia}
              loading={financeiroQ.isLoading}
              icon={AlertTriangle}
              accent={Number(financeiroQ.data?.inadimplencia) > 0 ? "warning" : undefined}
              descricao="Soma das contas a receber com status 'vencido' (data de vencimento ultrapassada sem pagamento)."
            />
          </div>
        </section>
      )}

      {/* Grid 2 colunas: Agenda de hoje + Custos/Procedimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda de hoje */}
        <section className="lg:col-span-2">
          <SectionHeader
            icon={CalendarDays}
            title="Agenda de hoje"
            subtitle={
              agendamentosQ.data
                ? `${agendamentosQ.data.length} agendamento(s)`
                : undefined
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavegar("agenda")}
                className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
              >
                Abrir agenda <ArrowRight size={14} className="ml-1" />
              </Button>
            }
          />
          <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl overflow-hidden">
            {agendamentosQ.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full shimmer" />
                ))}
              </div>
            ) : agendamentosQ.data && agendamentosQ.data.length > 0 ? (
              <ul className="divide-y divide-[var(--border-app-subtle)] max-h-72 overflow-y-auto scroll-thin">
                {agendamentosQ.data.slice(0, 8).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-app-alt-strong)] transition-colors"
                  >
                    <div className="w-12 text-center shrink-0">
                      <div className="text-xs font-mono font-semibold text-[var(--accent-app-text)]">
                        {a.hora || "—"}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text-app)] truncate">
                        {a.nome}
                      </div>
                      <div className="text-xs text-[var(--text-app-muted)] truncate">
                        {a.exame || "Exame não informado"}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center">
                <CalendarDays className="mx-auto mb-2 text-[var(--text-app-faint)]" size={28} />
                <p className="text-sm text-[var(--text-app-muted)]">
                  Nenhum agendamento para hoje.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavegar("agenda")}
                  className="mt-3 text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)]"
                >
                  Adicionar na agenda
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Painel direito: Custos + Procedimentos resumidos */}
        <section className="space-y-4">
          {/* Custo por minuto */}
          {podeEditar && <div>
            <SectionHeader
              icon={Settings2}
              title="Custo fixo"
              compact
            />
            <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4">
              {custosQ.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full shimmer" />
                  <Skeleton className="h-4 w-2/3 shimmer" />
                </div>
              ) : custosQ.data ? (
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-app-faint)] mb-0.5">
                      Custo fixo / minuto
                    </div>
                    <div className="text-2xl font-mono tabular-nums font-semibold text-[var(--accent-app-text)]">
                      {brl(custosQ.data.custoFixoPorMinuto)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-app-subtle)]">
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-app-faint)]">Total/mês</div>
                      <div className="text-sm font-mono tabular-nums text-[var(--text-app)]">
                        {brl(custosQ.data.custoFixoTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-app-faint)]">Horas/mês</div>
                      <div className="text-sm font-mono tabular-nums text-[var(--text-app)]">
                        {custosQ.data.horasEfetivas.toFixed(0)}h
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <AlertTriangle className="mx-auto mb-1.5 text-[var(--warning-app)]" size={20} />
                  <p className="text-xs text-[var(--text-app-muted)] mb-2">
                    {custosQ.error?.message ?? "Configure os custos e a capacidade produtiva para calcular preços."}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavegar("custos")}
                    className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
                  >
                    Configurar <ArrowRight size={12} className="ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          }
          {/* Procedimentos cadastrados */}
          <div>
            <SectionHeader
              icon={Calculator}
              title="Procedimentos"
              compact
            />
            <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4">
              {procedimentosQ.isLoading ? (
                <Skeleton className="h-16 w-full shimmer" />
              ) : procedimentosQ.data ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-mono tabular-nums font-semibold text-[var(--text-app)]">
                      {procedimentosQ.data.length}
                    </span>
                    <span className="text-xs text-[var(--text-app-muted)]">
                      {procedimentosQ.data.length === 1 ? "procedimento" : "procedimentos"}
                    </span>
                  </div>
                  {procedimentosQ.data.length > 0 ? (
                    <div className="text-[11px] text-[var(--text-app-muted)]">
                      {procedimentosQ.data.filter((p) => p.precoFinal).length} com preço definido ·{" "}
                      {procedimentosQ.data.filter((p) => !p.precoFinal).length} pendentes
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavegar("procedimentos")}
                      className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs p-0 h-auto"
                    >
                      {podeEditar ? "Criar primeiro procedimento" : "Consultar procedimentos"} <ArrowRight size={12} className="ml-1" />
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Saúde dos Procedimentos — resumo */}
      {podeEditar && (
        <section>
          <SectionHeader
            icon={Calculator}
            title="Saúde dos procedimentos"
            subtitle="preço vs ponto de equilíbrio"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavegar("procedimentos")}
                className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
              >
                Ver detalhes <ArrowRight size={14} className="ml-1" />
              </Button>
            }
          />
          <SaudeProcedimentosCard />
        </section>
      )}

      {/* Tendência 6 meses — Sparklines */}
      {podeEditar && (
        <section>
          <SectionHeader
            icon={TrendingUp}
            title="Tendência dos últimos 6 meses"
            subtitle={historicoQ.data ? `${historicoQ.data.length} meses` : undefined}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavegar("financeiro")}
                className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
              >
                Ver detalhes <ArrowRight size={14} className="ml-1" />
              </Button>
            }
          />
          {historicoQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full shimmer rounded-xl" />
              ))}
            </div>
          ) : historicoQ.data && historicoQ.data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SparklineCard
                label="Receitas"
                valores={historicoQ.data.map((m) => m.receitas)}
                labels={historicoQ.data.map((m) => nomeMes(m.mes))}
                valorAtual={historicoQ.data[historicoQ.data.length - 1]?.receitas ?? 0}
                cor="var(--accent-app)"
                icone={TrendingUp}
              />
              <SparklineCard
                label="Despesas pagas"
                valores={historicoQ.data.map((m) => m.despesas)}
                labels={historicoQ.data.map((m) => nomeMes(m.mes))}
                valorAtual={historicoQ.data[historicoQ.data.length - 1]?.despesas ?? 0}
                cor="var(--warning-app)"
                icone={TrendingDown}
              />
              <SparklineCard
                label="Resultado"
                valores={historicoQ.data.map((m) => m.resultado)}
                labels={historicoQ.data.map((m) => nomeMes(m.mes))}
                valorAtual={historicoQ.data[historicoQ.data.length - 1]?.resultado ?? 0}
                cor="var(--accent-app)"
                corNegativa="var(--danger-app)"
                icone={Activity}
                barras
              />
            </div>
          ) : (
            <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-6 text-center">
              <TrendingUp className="mx-auto mb-2 text-[var(--text-app-faint)]" size={24} />
              <p className="text-sm text-[var(--text-app-muted)]">
                Sem histórico suficiente para mostrar tendência.
              </p>
              <p className="text-[11px] text-[var(--text-app-faint)] mt-1">
                Lance contas a receber/pagar nos meses anteriores para começar a ver o histórico.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Distribuição de status de agendamentos (próximos 30 dias) */}
      <section>
        <SectionHeader
          icon={CalendarDays}
          title="Agendamentos — próximos 30 dias"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavegar("agenda")}
              className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
            >
              Abrir agenda <ArrowRight size={14} className="ml-1" />
            </Button>
          }
        />
        <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4">
          <StatusAgendamentosCard />
        </div>
      </section>

      {/* Linha do tempo: 8 semanas de agendamentos */}
      <section>
        <SectionHeader
          icon={CalendarDays}
          title="Volume de agendamentos — últimas 8 semanas"
          subtitle="tendência semanal"
        />
        <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4">
          <TimelineAgendamentosCard />
        </div>
      </section>

      {/* Fluxo de caixa projetado (30/60/90 dias) */}
      {podeEditar && (
        <section>
          <SectionHeader
            icon={Wallet}
            title="Fluxo de caixa projetado"
            subtitle="contas em aberto por janela"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavegar("financeiro")}
                className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
              >
                Ver detalhes <ArrowRight size={14} className="ml-1" />
              </Button>
            }
          />
          <FluxoCaixaProjetadoCard />
        </section>
      )}

      {/* Atalhos rápidos */}
      <section>
        <SectionHeader icon={Activity} title="Atalhos rápidos" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AtalhoCard
            icon={CalendarDays}
            label="Nova agenda"
            description="Agendar paciente"
            onClick={() => onNavegar("agenda")}
          />
          <AtalhoCard
            icon={Calculator}
            label={podeEditar ? "Novo procedimento" : "Consultar preços"}
            description={podeEditar ? "Calcular preço" : "Valores definidos pela clínica"}
            onClick={() => onNavegar("procedimentos")}
          />
          {podeEditar && (
            <>
              <AtalhoCard
                icon={Wallet}
                label="Lançar conta"
                description="Contas a receber/pagar"
                onClick={() => onNavegar("financeiro")}
              />
              <AtalhoCard
                icon={Settings2}
                label="Custos & capacidade"
                description="Configurar clínica"
                onClick={() => onNavegar("custos")}
              />
            </>
          )}
          {papel === "dono" && (
            <AtalhoCard
              icon={Users}
              label="Adicionar usuário"
              description="Adicionar equipe"
              onClick={() => onNavegar("usuarios")}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1.5" : "mb-3"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={compact ? 14 : 16} className="text-[var(--text-app-muted)] shrink-0" />
        <h2 className={`${compact ? "text-xs" : "text-sm"} font-semibold text-[var(--text-app)] truncate`}>
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-[var(--text-app-faint)]">· {subtitle}</span>
        )}
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
  icon: Icon,
  accent,
  descricao,
}: {
  label: string;
  value: number | undefined;
  loading?: boolean;
  icon: LucideIcon;
  accent?: "positive" | "negative" | "warning";
  descricao?: string;
}) {
  const colorClass =
    accent === "positive"
      ? "text-[var(--accent-app-text)]"
      : accent === "negative"
      ? "text-[var(--danger-app)]"
      : accent === "warning"
      ? "text-[var(--warning-app)]"
      : "text-[var(--text-app)]";

  const labelSpan = (
    <span className="text-[10px] uppercase tracking-wide text-[var(--text-app-faint)] font-medium flex items-center gap-1 cursor-help">
      {label}
      {descricao && (
        <Info size={10} className="text-[var(--text-app-faint)] opacity-60 hover:opacity-100" />
      )}
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-3 sm:p-4 hover:border-[var(--accent-app-soft-border)] hover:shadow-md hover:shadow-[var(--accent-app)]/5 transition-all relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-1.5">
        {descricao ? (
          <UITooltip>
            <UITooltipTrigger asChild>{labelSpan}</UITooltipTrigger>
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
          labelSpan
        )}
        <Icon size={13} className="text-[var(--text-app-faint)]" />
      </div>
      {loading ? (
        <Skeleton className="h-6 w-20 shimmer" />
      ) : (
        <div className={`text-lg sm:text-xl font-mono tabular-nums font-semibold ${colorClass}`}>
          {brl(value ?? 0)}
        </div>
      )}
    </motion.div>
  );
}

function AtalhoCard({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4 text-left hover:border-[var(--accent-app-soft-border)] hover:bg-[var(--accent-app-soft-bg)] hover:shadow-md hover:shadow-[var(--accent-app)]/5 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-app-alt-strong)] group-hover:bg-[var(--accent-app)] group-hover:text-white text-[var(--text-app-muted)] grid place-items-center transition-colors shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--text-app)] group-hover:text-[var(--accent-app-text)] transition-colors">
            {label}
          </div>
          <div className="text-[11px] text-[var(--text-app-muted)] truncate">
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    aguardando: { label: "Aguardando", className: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]" },
    atendido: { label: "Atendido", className: "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]" },
    faltou: { label: "Faltou", className: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]" },
    desmarcou: { label: "Desmarcou", className: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]" },
    remarcado: { label: "Remarcado", className: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]" },
  };
  const s = map[status] || { label: status, className: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]" };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  );
}

function usarSaudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function SparklineCard({
  label,
  valores,
  labels,
  valorAtual,
  cor,
  corNegativa,
  icone: Icon,
  barras = false,
}: {
  label: string;
  valores: number[];
  labels: string[];
  valorAtual: number;
  cor: string;
  corNegativa?: string;
  icone: LucideIcon;
  barras?: boolean;
}) {
  // Tendência: comparar último vs penúltimo
  const n = valores.length;
  const atual = valores[n - 1] ?? 0;
  const anterior = valores[n - 2] ?? 0;
  const delta = atual - anterior;
  const pctDelta = anterior !== 0 ? delta / Math.abs(anterior) : 0;
  const isPositive = delta >= 0;
  const tendenciaCor =
    barras ? (atual >= 0 ? "var(--accent-app-text)" : "var(--danger-app)")
    : isPositive ? "var(--accent-app-text)" : "var(--danger-app)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4 hover:border-[var(--border-app-strong)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icon size={12} className="text-[var(--text-app-faint)]" />
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-app-faint)] font-medium">
              {label}
            </span>
          </div>
          <div className="text-xl font-mono tabular-nums font-semibold text-[var(--text-app)]">
            {brl(valorAtual)}
          </div>
        </div>
        {n >= 2 && (
          <div className={`text-[11px] font-mono tabular-nums ${tendenciaCor}`}>
            {isPositive ? "↑" : "↓"} {pct(Math.abs(pctDelta))}
          </div>
        )}
      </div>
      <div className="mt-1">
        {barras ? (
          <BarSparkline
            valores={valores}
            cor={cor}
            corNegativa={corNegativa || "var(--danger-app)"}
            largura={280}
            altura={40}
          />
        ) : (
          <Sparkline
            valores={valores}
            cor={cor}
            largura={280}
            altura={40}
          />
        )}
      </div>
      {/* Labels dos meses */}
      <div className="flex justify-between mt-1 px-px">
        {labels.map((l, i) => (
          <span
            key={i}
            className={`text-[9px] ${
              i === labels.length - 1
                ? "text-[var(--text-app-secondary)] font-medium"
                : "text-[var(--text-app-faint)]"
            }`}
          >
            {l.split(" ")[0].slice(0, 3)}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// StatusAgendamentosCard — donut chart de distribuição de status dos
// agendamentos dos próximos 30 dias.
// ---------------------------------------------------------------------------
interface ResumoStatus {
  periodoInicio: string;
  periodoFim: string;
  total: number;
  porStatus: { status: string; total: number }[];
}

const STATUS_INFO: Record<
  string,
  { label: string; color: string }
> = {
  aguardando: { label: "Aguardando", color: "var(--text-app-muted)" },
  atendido: { label: "Atendido", color: "var(--accent-app)" },
  faltou: { label: "Faltou", color: "var(--danger-app)" },
  desmarcou: { label: "Desmarcou", color: "var(--text-app-faint)" },
  remarcado: { label: "Remarcado", color: "var(--warning-app)" },
};

function StatusAgendamentosCard() {
  const q = useQuery<ResumoStatus>({
    queryKey: ["agendamentos", "resumo-status"],
    queryFn: () => apiFetch(`/api/agendamentos/resumo-status`),
    retry: 0,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Skeleton className="h-32 w-32 rounded-full shimmer" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <p className="text-sm text-[var(--danger-app)] text-center py-6">
        {q.error instanceof Error ? q.error.message : "Erro ao carregar"}
      </p>
    );
  }

  const data = q.data;
  if (!data || data.total === 0) {
    return (
      <div className="text-center py-6">
        <CalendarDays className="mx-auto mb-2 text-[var(--text-app-faint)]" size={28} />
        <p className="text-sm text-[var(--text-app-muted)]">
          Nenhum agendamento nos próximos 30 dias.
        </p>
      </div>
    );
  }

  const slices: DonutSlice[] = data.porStatus
    .filter((s) => s.total > 0)
    .map((s) => ({
      label: STATUS_INFO[s.status]?.label ?? s.status,
      value: s.total,
      color: STATUS_INFO[s.status]?.color ?? "var(--text-app-faint)",
    }));

  // Garante ordem consistente: aguardando > atendido > faltou > desmarcou > remarcado
  const ordem = ["aguardando", "atendido", "faltou", "desmarcou", "remarcado"];
  const todasSlices: DonutSlice[] = ordem
    .map((status) => {
      const item = data.porStatus.find((x) => x.status === status);
      if (!item || item.total === 0) return null;
      return {
        label: STATUS_INFO[status]?.label ?? status,
        value: item.total,
        color: STATUS_INFO[status]?.color ?? "var(--text-app-faint)",
      };
    })
    .filter((x): x is DonutSlice => x !== null);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <DonutChart
        slices={todasSlices}
        tamanho={140}
        centroValor={String(data.total)}
        centroLabel="total"
      />
      <div className="flex-1 w-full">
        <DonutLegend slices={todasSlices} total={data.total} />
        <div className="mt-3 pt-3 border-t border-[var(--border-app-subtle)] text-[11px] text-[var(--text-app-faint)]">
          Período: {dataBR(data.periodoInicio)} a {dataBR(data.periodoFim)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineAgendamentosCard — barra horizontal das últimas 8 semanas com
// distribuição por status (stacked bar). Sem recharts — SVG puro + grid CSS.
// ---------------------------------------------------------------------------
interface SemanaTimeline {
  semanaInicio: string;
  semanaFim: string;
  label: string;
  total: number;
  porStatus: { status: string; total: number }[];
}

interface TimelineResponse {
  semanas: SemanaTimeline[];
  semanaAtualInicio: string;
}

const STATUS_COR: Record<string, string> = {
  aguardando: "var(--text-app-muted)",
  atendido: "var(--accent-app)",
  faltou: "var(--danger-app)",
  desmarcou: "var(--text-app-faint)",
  remarcado: "var(--warning-app)",
};

const STATUS_COR_LABEL: Record<string, string> = {
  aguardando: "Aguardando",
  atendido: "Atendido",
  faltou: "Faltou",
  desmarcou: "Desmarcou",
  remarcado: "Remarcado",
};

function TimelineAgendamentosCard() {
  const q = useQuery<TimelineResponse>({
    queryKey: ["agendamentos", "historico-8-semanas"],
    queryFn: () => apiFetch(`/api/agendamentos/historico-8-semanas`),
    retry: 0,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full shimmer rounded" />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <p className="text-sm text-[var(--danger-app)] text-center py-4">
        {q.error instanceof Error ? q.error.message : "Erro ao carregar"}
      </p>
    );
  }

  const semanas = q.data?.semanas ?? [];
  if (semanas.length === 0) {
    return (
      <p className="text-sm text-[var(--text-app-muted)] text-center py-6">
        Sem histórico.
      </p>
    );
  }

  const maxTotal = Math.max(...semanas.map((s) => s.total), 1);
  const semanaAtual = q.data?.semanaAtualInicio;

  return (
    <div className="space-y-3">
      {/* Grid das 8 barras */}
      <div className="space-y-1.5">
        {semanas.map((sem) => {
          const isAtual = sem.semanaInicio === semanaAtual;
          const percentuais = sem.porStatus.map((s) => ({
            status: s.status,
            label: STATUS_COR_LABEL[s.status] ?? s.status,
            total: s.total,
            cor: STATUS_COR[s.status] ?? "var(--text-app-faint)",
            pctDoTotal: sem.total > 0 ? (s.total / sem.total) * 100 : 0,
          }));
          const larguraBarra = (sem.total / maxTotal) * 100;
          return (
            <div key={sem.semanaInicio} className="group flex items-center gap-3">
              {/* Label da semana (esquerda) */}
              <div className="w-24 sm:w-28 shrink-0 text-[11px] font-mono text-[var(--text-app-muted)] truncate text-right flex items-center justify-end gap-1.5">
                {isAtual && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-app)]" title="semana atual" />
                )}
                {sem.label}
              </div>
              {/* Barra (centro) — stacked */}
              <div className="flex-1 min-w-0">
                <div className="h-5 bg-[var(--bg-app-alt-strong)] rounded overflow-hidden flex">
                  {sem.total === 0 ? (
                    <div className="flex-1" />
                  ) : (
                    <div
                      className="flex h-full rounded overflow-hidden transition-all duration-500"
                      style={{ width: `${larguraBarra}%` }}
                    >
                      {percentuais
                        .filter((p) => p.total > 0)
                        .map((p, i) => (
                          <div
                            key={p.status}
                            title={`${p.label}: ${p.total}`}
                            style={{
                              width: `${p.pctDoTotal}%`,
                              background: p.cor,
                            }}
                            className={`h-full ${i === 0 ? "" : "border-l border-[var(--surface-app)]/30"}`}
                          />
                        ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Total (direita) */}
              <div className="w-10 shrink-0 text-right text-xs font-mono tabular-nums text-[var(--text-app)] font-medium">
                {sem.total}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 pt-3 border-t border-[var(--border-app-subtle)]">
        {Object.entries(STATUS_COR_LABEL).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5 text-[11px] text-[var(--text-app-muted)]">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: STATUS_COR[status] }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* Tendência simples */}
      {(() => {
        const atual = semanas[semanas.length - 1]?.total ?? 0;
        const anterior = semanas[semanas.length - 2]?.total ?? 0;
        const delta = atual - anterior;
        const isPositive = delta >= 0;
        return (
          <div className="text-[11px] text-[var(--text-app-muted)] flex items-center gap-1">
            <span>Tendência vs semana anterior:</span>
            <span
              className={`font-mono font-medium ${isPositive ? "text-[var(--accent-app-text)]" : "text-[var(--danger-app)]"}`}
            >
              {isPositive ? "↑" : "↓"} {delta >= 0 ? "+" : ""}{delta}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaudeProcedimentosCard — mostra quantos procedimentos estão abaixo do
// ponto de equilíbrio, abaixo do sugerido, ou sem preço definido.
// ---------------------------------------------------------------------------
interface ProcedimentoHealth {
  id: string;
  nome: string;
  precoFinal: number | null;
  custoDireto: number;
  precoSugerido: number;
  pontoEquilibrio: number;
  lucratividadeFinal: number;
  abaixoEquilibrio: boolean;
  abaixoSugerido: boolean;
  semPreco: boolean;
}

interface HealthCheckResponse {
  total: number;
  abaixoEquilibrio: number;
  abaixoSugerido: number;
  semPreco: number;
  procedimentos: ProcedimentoHealth[];
}

function SaudeProcedimentosCard() {
  const q = useQuery<HealthCheckResponse>({
    queryKey: ["procedimentos", "health-check"],
    queryFn: () => apiFetch(`/api/procedimentos/health-check`),
    retry: 0,
  });
  const [filtro, setFiltro] = useState<"todos" | "abaixoEquilibrio" | "abaixoSugerido" | "semPreco">("todos");

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full shimmer rounded-xl" />
        ))}
      </div>
    );
  }

  // Capacidade produtiva não configurada (400) — trata como info vazio
  if (q.isError) {
    return (
      <div className="bg-[var(--bg-app)] border border-[var(--border-app)] rounded-xl p-4 text-center">
        <AlertTriangle className="mx-auto mb-2 text-[var(--warning-app)]" size={20} />
        <p className="text-sm text-[var(--text-app-muted)] mb-2">
          {q.error?.message ?? "Não foi possível conferir os procedimentos. Tente novamente."}
        </p>
      </div>
    );
  }

  const data = q.data;
  if (!data) return null;

  if (data.total === 0) {
    return (
      <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4 text-center">
        <Calculator className="mx-auto mb-2 text-[var(--text-app-faint)]" size={24} />
        <p className="text-sm text-[var(--text-app-muted)]">
          Nenhum procedimento cadastrado ainda.
        </p>
      </div>
    );
  }

  const saudaveis = data.procedimentos.filter((p) => !p.semPreco && !p.abaixoEquilibrio && !p.abaixoSugerido).length;

  // Filtra procedimentos conforme o filtro selecionado
  const procedimentosFiltrados = data.procedimentos.filter((p) => {
    if (filtro === "abaixoEquilibrio") return p.abaixoEquilibrio;
    if (filtro === "abaixoSugerido") return p.abaixoSugerido;
    if (filtro === "semPreco") return p.semPreco;
    return false; // "todos" não mostra lista
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setFiltro(filtro === "todos" ? "todos" : "todos")} className="text-left">
          <HealthStat
            label="Saudáveis"
            value={saudaveis}
            total={data.total}
            cor="text-[var(--accent-app-text)]"
            bg="bg-[var(--accent-app-soft-bg)]"
            icon={CheckCircle2}
          />
        </button>
        <button onClick={() => setFiltro(filtro === "abaixoSugerido" ? "todos" : "abaixoSugerido")} className="text-left">
          <HealthStat
            label="Abaixo do sugerido"
            value={data.abaixoSugerido}
            total={data.total}
            cor="text-[var(--warning-app)]"
            bg={`${filtro === "abaixoSugerido" ? "ring-2 ring-[var(--warning-app)] " : ""}bg-[var(--warning-app-bg)]`}
            icon={TrendingDown}
          />
        </button>
        <button onClick={() => setFiltro(filtro === "abaixoEquilibrio" ? "todos" : "abaixoEquilibrio")} className="text-left">
          <HealthStat
            label="Abaixo do equilíbrio"
            value={data.abaixoEquilibrio}
            total={data.total}
            cor="text-[var(--danger-app)]"
            bg={`${filtro === "abaixoEquilibrio" ? "ring-2 ring-[var(--danger-app)] " : ""}bg-[var(--danger-app-bg)]`}
            icon={AlertTriangle}
          />
        </button>
        <button onClick={() => setFiltro(filtro === "semPreco" ? "todos" : "semPreco")} className="text-left">
          <HealthStat
            label="Sem preço"
            value={data.semPreco}
            total={data.total}
            cor="text-[var(--text-app-muted)]"
            bg={`${filtro === "semPreco" ? "ring-2 ring-[var(--text-app-muted)] " : ""}bg-[var(--bg-app-alt-strong)]`}
            icon={Clock}
          />
        </button>
      </div>

      {/* Lista filtrada de procedimentos com problema */}
      {filtro !== "todos" && procedimentosFiltrados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={`border rounded-lg p-3 max-h-64 overflow-y-auto scroll-thin ${
            filtro === "abaixoEquilibrio"
              ? "bg-[var(--danger-app-bg)] border-[var(--danger-app-border)]"
              : filtro === "abaixoSugerido"
              ? "bg-[var(--warning-app-bg)] border-[var(--warning-app-border)]"
              : "bg-[var(--bg-app)] border-[var(--border-app)]"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h5 className={`text-xs font-semibold flex items-center gap-1.5 ${
              filtro === "abaixoEquilibrio" ? "text-[var(--danger-app)]"
              : filtro === "abaixoSugerido" ? "text-[var(--warning-app)]"
              : "text-[var(--text-app-muted)]"
            }`}>
              {filtro === "abaixoEquilibrio" ? <AlertTriangle size={13} /> : null}
              {filtro === "abaixoEquilibrio" ? "Abaixo do equilíbrio" : filtro === "abaixoSugerido" ? "Abaixo do sugerido" : "Sem preço definido"}
            </h5>
            <button
              onClick={() => setFiltro("todos")}
              className="text-[10px] text-[var(--text-app-muted)] hover:text-[var(--text-app)]"
            >
              ✕ fechar
            </button>
          </div>
          <ul className="space-y-1.5">
            {procedimentosFiltrados.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[var(--text-app)] truncate">{p.nome}</span>
                <span className="font-mono tabular-nums shrink-0">
                  {filtro === "semPreco" ? (
                    <span className="text-[var(--text-app-faint)]">— sem preço —</span>
                  ) : (
                    <>
                      <span className={filtro === "abaixoEquilibrio" ? "text-[var(--danger-app)]" : "text-[var(--warning-app)]"}>
                        {brl(p.precoFinal)}
                      </span>
                      <span className="text-[var(--text-app-faint)] mx-1">vs</span>
                      <span className="text-[var(--text-app-secondary)]">
                        {brl(filtro === "abaixoEquilibrio" ? p.pontoEquilibrio : p.precoSugerido)}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Banner vermelho permanente se houver abaixo do equilíbrio E filtro não está ativo */}
      {filtro === "todos" && data.abaixoEquilibrio > 0 && (
        <div className="bg-[var(--danger-app-bg)] border border-[var(--danger-app-border)] rounded-lg p-3">
          <h5 className="text-xs font-semibold text-[var(--danger-app)] mb-2 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            {data.abaixoEquilibrio} procedimento(s) abaixo do ponto de equilíbrio
          </h5>
          <button
            onClick={() => setFiltro("abaixoEquilibrio")}
            className="text-[11px] text-[var(--danger-app)] hover:underline font-medium"
          >
            Ver lista completa →
          </button>
        </div>
      )}
    </div>
  );
}

function HealthStat({
  label,
  value,
  total,
  cor,
  bg,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  cor: string;
  bg: string;
  icon: typeof Clock;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border border-[var(--border-app)] rounded-xl p-3 ${bg}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-app-muted)] font-medium">
          {label}
        </span>
        <Icon size={13} className="text-[var(--text-app-faint)]" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-mono tabular-nums font-semibold ${cor}`}>
          {value}
        </span>
        <span className="text-[11px] text-[var(--text-app-muted)]">
          / {total} ({pct.toFixed(0)}%)
        </span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// FluxoCaixaProjetadoCard — projeção de saldo em 3 janelas (30/60/90 dias)
// ---------------------------------------------------------------------------
interface JanelaFluxo {
  dias: number;
  label: string;
  recebimentosPrevistos: number;
  pagamentosPrevistos: number;
  saldoProjetado: number;
  quantidadeReceber: number;
  quantidadePagar: number;
}

interface FluxoCaixaResponse {
  janelas: JanelaFluxo[];
  saldoAtualContas: number;
}

function FluxoCaixaProjetadoCard() {
  const q = useQuery<FluxoCaixaResponse>({
    queryKey: ["financeiro", "fluxo-caixa-projetado"],
    queryFn: () => apiFetch(`/api/financeiro/fluxo-caixa-projetado`),
    retry: 0,
  });

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full shimmer rounded-xl" />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <p className="text-sm text-[var(--danger-app)] text-center py-4">
        {q.error instanceof Error ? q.error.message : "Erro ao carregar"}
      </p>
    );
  }

  const data = q.data;
  if (!data || data.janelas.length === 0) {
    return (
      <p className="text-sm text-[var(--text-app-muted)] text-center py-4">
        Sem dados de fluxo de caixa.
      </p>
    );
  }

  const saldoAtual = data.saldoAtualContas;

  return (
    <div className="space-y-3">
      {/* Saldo atual + 3 janelas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Saldo atual (destaque maior) */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`border rounded-xl p-4 col-span-2 sm:col-span-1 ${
            saldoAtual >= 0
              ? "bg-[var(--accent-app-soft-bg)] border-[var(--accent-app-soft-border)]"
              : "bg-[var(--danger-app-bg)] border-[var(--danger-app-border)]"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={12} className="text-[var(--text-app-faint)]" />
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-app-faint)] font-medium">
              Saldo atual
            </span>
          </div>
          <div className={`text-2xl font-mono tabular-nums font-semibold ${saldoAtual >= 0 ? "text-[var(--accent-app-text)]" : "text-[var(--danger-app)]"}`}>
            {brl(saldoAtual)}
          </div>
          <div className="text-[10px] text-[var(--text-app-muted)] mt-0.5">
            recebido − pago
          </div>
        </motion.div>

        {/* 3 janelas projetadas */}
        {data.janelas.map((janela, i) => {
          const saldo = janela.saldoProjetado;
          const corValor = saldo >= 0 ? "text-[var(--accent-app-text)]" : "text-[var(--danger-app)]";
          return (
            <motion.div
              key={janela.dias}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-3 hover:border-[var(--border-app-strong)] hover:shadow-sm transition-all"
            >
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-app-faint)] font-medium mb-1">
                {janela.label}
              </div>
              <div className={`text-lg font-mono tabular-nums font-semibold ${corValor}`}>
                {brl(saldo)}
              </div>
              <div className="text-[10px] text-[var(--text-app-muted)] mt-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--accent-app-text)]">↑ {brl(janela.recebimentosPrevistos)}</span>
                  <span className="text-[var(--text-app-faint)]">{janela.quantidadeReceber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--danger-app)]">↓ {brl(janela.pagamentosPrevistos)}</span>
                  <span className="text-[var(--text-app-faint)]">{janela.quantidadePagar}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Barra visual de projeção cumulativa */}
      <div className="bg-[var(--bg-app)] border border-[var(--border-app-subtle)] rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wide text-[var(--text-app-faint)] font-medium mb-2">
          Projeção cumulativa de saldo
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono tabular-nums text-[var(--text-app-secondary)] w-20 text-right">
            {brl(saldoAtual)}
          </span>
          <div className="flex-1 h-2 bg-[var(--bg-app-alt-strong)] rounded-full overflow-hidden flex">
            {data.janelas.map((j, i) => {
              const cumulativo = saldoAtual + data.janelas.slice(0, i + 1).reduce((s, x) => s + x.saldoProjetado, 0);
              const cor = cumulativo >= 0 ? "var(--accent-app)" : "var(--danger-app)";
              return (
                <div
                  key={j.dias}
                  title={`${j.label}: ${brl(cumulativo)}`}
                  style={{ background: cor, opacity: 0.4 + 0.2 * (i + 1) }}
                  className="flex-1 h-full border-r border-[var(--surface-app)] last:border-r-0"
                />
              );
            })}
          </div>
          <span className="font-mono tabular-nums text-[var(--text-app-secondary)] w-20">
            {brl(saldoAtual + data.janelas.reduce((s, x) => s + x.saldoProjetado, 0))}
          </span>
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] text-[var(--text-app-faint)]">
          <span>hoje</span>
          <span>30d</span>
          <span>60d</span>
          <span>90d</span>
        </div>
      </div>
    </div>
  );
}
