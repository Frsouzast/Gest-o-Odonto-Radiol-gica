"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth-store";
import { pricingSetupIssue, type Capacidade } from "@/lib/engine";
import { Button } from "@/components/ui/button";

type Procedure = { tempoMinutos: number; precoFinal: number | null };
export function SetupGuide({ onNavegar }: { onNavegar: (aba: "custos" | "procedimentos" | "usuarios") => void }) {
  const costs = useQuery<{ valor: number }[]>({ queryKey: ["despesas"], queryFn: () => apiFetch("/api/despesas"), retry: false });
  const assets = useQuery<{ valorAquisicao: number; vidaUtilAnos: number }[]>({ queryKey: ["ativos"], queryFn: () => apiFetch("/api/ativos"), retry: false });
  const capacity = useQuery<Capacidade | null>({ queryKey: ["capacidade"], queryFn: () => apiFetch("/api/capacidade"), retry: false });
  const procedures = useQuery<Procedure[]>({ queryKey: ["procedimentos"], queryFn: () => apiFetch("/api/procedimentos"), retry: false });
  const queries = [costs, assets, capacity, procedures];
  const failed = queries.some((q) => q.isError);
  const loading = queries.some((q) => q.isPending);
  const hasCosts = Boolean(costs.data?.length || assets.data?.length);
  const hasCapacity = capacity.data != null && pricingSetupIssue([{ valor: 0 }], capacity.data) === null;
  const steps = [
    { title: "1. Informe os custos mensais", hint: "Aluguel, salários, energia e outros custos que a clínica mantém. Cadastre também os equipamentos, quando houver.", done: hasCosts, aba: "custos" as const },
    { title: "2. Configure o tempo de atendimento", hint: "Em Custos & Capacidade, abra Capacidade produtiva. Informe dias, horas, salas ou aparelhos e ocupação: quanto do tempo disponível é realmente usado.", done: hasCapacity, aba: "custos" as const },
    { title: "3. Cadastre um procedimento", hint: "Informe duração, materiais, custo do laudo e percentuais. Lucro desejado é a parte do preço que deve sobrar depois dos custos e taxas.", done: Boolean(procedures.data?.some((p) => p.tempoMinutos > 0)), aba: "procedimentos" as const },
    { title: "4. Confira e defina o primeiro preço", hint: "Compare o preço sugerido com seus custos reais. O valor final é escolhido pela clínica; o cálculo não garante lucro se os dados estiverem incompletos.", done: hasCosts && hasCapacity && Boolean(procedures.data?.some((p) => p.tempoMinutos > 0 && p.precoFinal != null && p.precoFinal > 0)), aba: "procedimentos" as const },
  ];
  return <section aria-labelledby="setup-title" className="rounded-xl border border-[var(--border-app)] bg-[var(--surface-app)] p-4 sm:p-5 space-y-3">
    <h2 id="setup-title" className="font-semibold text-[var(--text-app)]">Comece por aqui: do custo ao primeiro preço</h2>
    <p className="text-sm text-[var(--text-app-muted)]">Siga estes passos sem apagar ou substituir o que você já cadastrou.</p>
    {failed ? <div role="alert" className="text-sm text-[var(--text-app-muted)]">Não foi possível conferir a configuração. Não vamos considerar dados ausentes como zero. <Button variant="outline" onClick={() => { queries.forEach((q) => { void q.refetch(); }); }}>Tentar novamente</Button></div>
      : loading ? <p role="status" className="text-sm text-[var(--text-app-muted)]">Conferindo sua configuração…</p>
      : <><p className="text-sm text-[var(--text-app-muted)]">{steps.filter((s) => s.done).length} de 4 etapas básicas preenchidas. Isso não substitui a conferência dos valores.</p>
        <ol className="grid sm:grid-cols-2 gap-3">{steps.map((s) => <li key={s.title} className="rounded-lg border border-[var(--border-app)] p-3 space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-app)]">{s.title}</h3><p className="text-xs text-[var(--text-app-muted)]">{s.hint}</p>
          <div className="flex items-center justify-between gap-2"><span className="text-xs text-[var(--text-app-muted)]">{s.done ? "Preenchido — revise quando necessário" : "Ainda falta preencher"}</span><Button variant="outline" size="sm" aria-label={`${s.done ? "Revisar" : "Configurar"}: ${s.title}`} onClick={() => onNavegar(s.aba)}>{s.done ? "Revisar" : "Configurar"}</Button></div>
        </li>)}</ol></>}
    <p className="text-xs text-[var(--text-app-muted)]">Equipe: o dono cadastra pessoas em Usuários → Adicionar e escolhe Tipo de acesso: Financeiro ou Recepção. A opção Nova clínica na tela de entrada cria o dono de uma clínica nova.</p>
  </section>;
}
