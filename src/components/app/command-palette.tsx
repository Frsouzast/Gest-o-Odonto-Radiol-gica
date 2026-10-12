"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth-store";
import { brl, dataBR } from "@/lib/utils";
import {
  Search, Calculator, Building2, CalendarDays, Receipt,
  CornerDownLeft, ArrowUp, ArrowDown, type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type AbaId = "inicio" | "custos" | "procedimentos" | "agenda" | "financeiro" | "usuarios";

interface ResultadoBusca {
  procedimentos: { id: string; nome: string; tempoMinutos: number; precoFinal: number | null }[];
  convenios: { id: string; nome: string; responsavel: string | null }[];
  agendamentos: {
    id: string;
    nome: string;
    data: string;
    hora: string | null;
    exame: string | null;
    status: string;
  }[];
  contasReceber: {
    id: string;
    pacienteNome: string | null;
    valorFaturado: number;
    dataExame: string;
    status: string;
  }[];
}

interface ItemBusca {
  id: string;
  titulo: string;
  subtitulo: string;
  categoria: string;
  icone: LucideIcon;
  abaDestino: AbaId;
  badge?: string;
  badgeColor?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavegar: (aba: AbaId) => void;
}

export function CommandPalette({ open, onOpenChange, onNavegar }: CommandPaletteProps) {
  return open ? <CommandPaletteContent open={open} onOpenChange={onOpenChange} onNavegar={onNavegar} /> : null;
}

function CommandPaletteContent({ open, onOpenChange, onNavegar }: CommandPaletteProps) {
  const [consulta, setConsulta] = useState("");
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const buscaQ = useQuery<ResultadoBusca>({
    queryKey: ["busca", consulta],
    queryFn: () => apiFetch(`/api/busca?q=${encodeURIComponent(consulta)}`),
    enabled: open && consulta.trim().length >= 2,
    retry: 0,
  });

  // Flat list of items, grouped by category
  const itens = useMemo<ItemBusca[]>(() => {
    const r = buscaQ.data;
    if (!r) return [];
    const itens: ItemBusca[] = [];
    if (r.procedimentos.length > 0) {
      r.procedimentos.forEach((p) =>
        itens.push({
          id: p.id,
          titulo: p.nome,
          subtitulo: `${p.tempoMinutos} min${p.precoFinal ? ` · ${brl(p.precoFinal)}` : ""}`,
          categoria: "Procedimentos",
          icone: Calculator,
          abaDestino: "procedimentos",
        })
      );
    }
    if (r.convenios.length > 0) {
      r.convenios.forEach((c) =>
        itens.push({
          id: c.id,
          titulo: c.nome,
          subtitulo: c.responsavel ? `Resp.: ${c.responsavel}` : "Convênio",
          categoria: "Convênios",
          icone: Building2,
          abaDestino: "financeiro",
        })
      );
    }
    if (r.agendamentos.length > 0) {
      r.agendamentos.forEach((a) =>
        itens.push({
          id: a.id,
          titulo: a.nome,
          subtitulo: `${dataBR(a.data)}${a.hora ? ` · ${a.hora}` : ""}${a.exame ? ` · ${a.exame}` : ""}`,
          categoria: "Agendamentos",
          icone: CalendarDays,
          abaDestino: "agenda",
          badge: statusLabel(a.status),
          badgeColor: statusColor(a.status),
        })
      );
    }
    if (r.contasReceber.length > 0) {
      r.contasReceber.forEach((c) =>
        itens.push({
          id: c.id,
          titulo: c.pacienteNome || "(sem paciente)",
          subtitulo: `${dataBR(c.dataExame)} · ${brl(c.valorFaturado)}`,
          categoria: "Contas a receber",
          icone: Receipt,
          abaDestino: "financeiro",
          badge: c.status,
          badgeColor: statusContaColor(c.status),
        })
      );
    }
    return itens;
  }, [buscaQ.data]);

  // Ao abrir, este componente é montado com consulta e seleção vazias.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Navegação por teclado
  const navegarLista = useCallback(
    (delta: number) => {
      setIndiceSelecionado((prev) => {
        const total = itens.length;
        if (total === 0) return 0;
        return (prev + delta + total) % total;
      });
    },
    [itens.length]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        navegarLista(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        navegarLista(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = itens[indiceSelecionado];
        if (item) {
          onNavegar(item.abaDestino);
          onOpenChange(false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [itens, indiceSelecionado, navegarLista, onNavegar, onOpenChange]
  );

  // Agrupar itens por categoria
  const itensAgrupados = useMemo(() => {
    const grupos = new Map<string, ItemBusca[]>();
    itens.forEach((item) => {
      const arr = grupos.get(item.categoria) || [];
      arr.push(item);
      grupos.set(item.categoria, arr);
    });
    return Array.from(grupos.entries());
  }, [itens]);

  // Índice global para highlight
  let idxGlobal = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          onClick={() => onOpenChange(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-[var(--surface-app)] border border-[var(--border-app)] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-app-subtle)]">
              <Search size={18} className="text-[var(--text-app-muted)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={consulta}
                onChange={(e) => {
                  setConsulta(e.target.value);
                  setIndiceSelecionado(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Buscar procedimentos, convênios, pacientes, agendamentos…"
                className="flex-1 bg-transparent outline-none text-sm text-[var(--text-app)] placeholder:text-[var(--text-app-faint)]"
              />
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-app-faint)] bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] rounded">
                ESC
              </kbd>
            </div>

            {/* Resultados */}
            <div className="max-h-[55vh] overflow-y-auto scroll-thin">
              {consulta.trim().length < 2 ? (
                <div className="px-4 py-10 text-center">
                  <Search size={28} className="mx-auto mb-2 text-[var(--text-app-faint)]" />
                  <p className="text-sm text-[var(--text-app-muted)]">
                    Digite pelo menos 2 caracteres para buscar.
                  </p>
                </div>
              ) : buscaQ.isLoading ? (
                <div className="px-4 py-6 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-[var(--bg-app-alt-strong)] rounded-md animate-pulse" />
                  ))}
                </div>
              ) : buscaQ.isError ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-[var(--danger-app)]">
                    {buscaQ.error instanceof Error ? buscaQ.error.message : "Erro ao buscar."}
                  </p>
                </div>
              ) : itens.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Search size={28} className="mx-auto mb-2 text-[var(--text-app-faint)]" />
                  <p className="text-sm text-[var(--text-app-muted)]">
                    Nenhum resultado para “{consulta}”.
                  </p>
                </div>
              ) : (
                <ul className="py-1.5">
                  {itensAgrupados.map(([categoria, lista]) => (
                    <li key={categoria}>
                      <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-app-faint)]">
                        {categoria}
                      </div>
                      <ul>
                        {lista.map((item) => {
                          idxGlobal++;
                          const selecionado = idxGlobal === indiceSelecionado;
                          const Icon = item.icone;
                          const idxAtual = idxGlobal;
                          return (
                            <li key={`${item.categoria}-${item.id}`}>
                              <button
                                onMouseEnter={() => setIndiceSelecionado(idxAtual)}
                                onClick={() => {
                                  onNavegar(item.abaDestino);
                                  onOpenChange(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                                  selecionado
                                    ? "bg-[var(--accent-app-soft-bg)]"
                                    : "hover:bg-[var(--bg-app-alt-strong)]"
                                }`}
                              >
                                <span
                                  className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
                                    selecionado
                                      ? "bg-[var(--accent-app)] text-white"
                                      : "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]"
                                  }`}
                                >
                                  <Icon size={15} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className={`text-sm font-medium truncate ${selecionado ? "text-[var(--accent-app-text)]" : "text-[var(--text-app)]"}`}>
                                    {item.titulo}
                                  </div>
                                  <div className="text-xs text-[var(--text-app-muted)] truncate">
                                    {item.subtitulo}
                                  </div>
                                </div>
                                {item.badge && (
                                  <span
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${item.badgeColor || ""}`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                                {selecionado && (
                                  <CornerDownLeft size={13} className="text-[var(--accent-app-text)] shrink-0" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer com dicas */}
            <div className="px-4 py-2 border-t border-[var(--border-app-subtle)] flex items-center justify-between gap-3 text-[10px] text-[var(--text-app-faint)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center w-5 h-5 bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] rounded">
                    <ArrowUp size={10} />
                  </kbd>
                  <kbd className="inline-flex items-center justify-center w-5 h-5 bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] rounded">
                    <ArrowDown size={10} />
                  </kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center px-1.5 h-5 bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] rounded font-mono">
                    ↵
                  </kbd>
                  abrir
                </span>
              </div>
              <span className="hidden sm:inline">{itens.length} resultado(s)</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    aguardando: "Aguardando",
    atendido: "Atendido",
    faltou: "Faltou",
    desmarcou: "Desmarcou",
    remarcado: "Remarcado",
  };
  return map[status] || status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    aguardando: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]",
    atendido: "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
    faltou: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]",
    desmarcou: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]",
    remarcado: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]",
  };
  return map[status] || "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]";
}

function statusContaColor(status: string): string {
  const map: Record<string, string> = {
    aberto: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]",
    recebido: "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
    vencido: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]",
    parcial: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]",
    cancelado: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-faint)]",
  };
  return map[status] || "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]";
}
