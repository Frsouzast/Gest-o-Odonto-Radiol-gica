"use client";

import { useState, useEffect, useCallback } from "react";
import { encerrarSessao, useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  Settings2,
  LogOut,
  Users,
  Calculator,
  CalendarDays,
  LayoutDashboard,
  Wallet,
  UserCog,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { CORES_DISPONIVEIS, setCorDestaque } from "./theme-applier";
import { toast } from "sonner";
import { CustosCapacidadeTab } from "@/components/tabs/custos-capacidade-tab";
import { ProcedimentosTab } from "@/components/tabs/procedimentos-tab";
import { AgendaTab } from "@/components/tabs/agenda-tab";
import { FinanceiroTab } from "@/components/tabs/financeiro-tab";
import { InicioTab } from "@/components/tabs/inicio-tab";
import { UsuariosTab } from "@/components/tabs/usuarios-tab";
import { CommandPalette } from "./command-palette";
import { ConfigClinicaDialog } from "./config-clinica-dialog";
import { PWAInstallPrompt } from "./pwa-install-prompt";
import { dispararNovoItem } from "@/lib/atalhos";
import { FluxXMark } from "./flux-x-mark";

type Papel = "dono" | "financeiro" | "recepcao";
type AbaId =
  | "inicio"
  | "custos"
  | "procedimentos"
  | "agenda"
  | "financeiro"
  | "usuarios";

interface Aba {
  id: AbaId;
  label: string;
  icon: LucideIcon;
  papeisPermitidos: Papel[];
  atalho?: string; // ex "1", "2"...
}

const ABAS: Aba[] = [
  { id: "inicio", label: "Início", icon: LayoutDashboard, papeisPermitidos: ["dono", "financeiro", "recepcao"], atalho: "1" },
  { id: "custos", label: "Custos & Capacidade", icon: Settings2, papeisPermitidos: ["dono", "financeiro"], atalho: "2" },
  { id: "procedimentos", label: "Procedimentos", icon: Calculator, papeisPermitidos: ["dono", "financeiro", "recepcao"], atalho: "3" },
  { id: "agenda", label: "Agenda", icon: CalendarDays, papeisPermitidos: ["dono", "financeiro", "recepcao"], atalho: "4" },
  { id: "financeiro", label: "Financeiro", icon: Wallet, papeisPermitidos: ["dono", "financeiro"], atalho: "5" },
  { id: "usuarios", label: "Usuários", icon: UserCog, papeisPermitidos: ["dono"], atalho: "6" },
];

export function AppShell() {
  const usuario = useAuth((s) => s.usuario);
  const setSessao = useAuth((s) => s.setSessao);
  const [logoutPending, setLogoutPending] = useState(false);
  const podeEditar = useAuth((s) => s.podeEditar());
  const { theme, setTheme } = useTheme();
  const [abaSolicitada, setAba] = useState<AbaId>("inicio");
  const aba = usuario && ABAS.some((item) => item.id === abaSolicitada && item.papeisPermitidos.includes(usuario.papel)) ? abaSolicitada : "inicio";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Atalhos de teclado: Ctrl+1..6 troca de aba; Ctrl+K abre palette
  const irParaAba = useCallback((id: AbaId) => {
    if (!usuario || !ABAS.some((item) => item.id === id && item.papeisPermitidos.includes(usuario.papel))) return;
    setAba(id);
  }, [usuario]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Não interfere se estiver digitando em input/textarea/select
      const t = e.target as HTMLElement;
      const emInput = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      // Ctrl+K abre palette mesmo dentro de inputs (MAS o Electron/React KeyDown não cancela default de search)
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((p) => !p);
        return;
      }
      if (emInput) return;
      if ((e.ctrlKey || e.metaKey) && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        const alvo = ABAS.find((a) => a.atalho === e.key);
        if (alvo && usuario && alvo.papeisPermitidos.includes(usuario.papel)) {
          irParaAba(alvo.id);
        }
      }
      // 'n' dispara "novo item" na aba ativa (agenda, procedimento, etc.)
      // A aba decide o que fazer (abrir dialog, focar form, etc.)
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Abas que suportam "novo": agenda, procedimentos, financeiro
        if (["agenda", "procedimentos", "financeiro"].includes(aba)) {
          e.preventDefault();
          dispararNovoItem();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [usuario, irParaAba, aba]);

  if (!usuario) return null;

  const abasVisiveis = ABAS.filter((a) =>
    a.papeisPermitidos.includes(usuario.papel)
  );

  // Se a aba atual não for permitida pro papel, volta pra primeira permitida
  const abaAtualEhPermitida = abasVisiveis.some((a) => a.id === aba);
  const abaEfetiva = abaAtualEhPermitida ? aba : abasVisiveis[0].id;
  const abaInfo = ABAS.find((a) => a.id === abaEfetiva);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="sticky top-0 z-30 bg-[var(--surface-app)]/95 backdrop-blur-md border-b border-[var(--border-app)]">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--brand-film)] border border-[var(--border-app)] grid place-items-center shrink-0">
              <FluxXMark className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text-app)] truncate flex items-center gap-1.5">
                {usuario.clinica.nome}
                <span className="hidden sm:inline text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]">
                  {papelLabel(usuario.papel)}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-app-muted)] truncate">
                {usuario.nome} · {usuario.email}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Botão de busca / Command Palette (Ctrl+K) */}
            <button
              onClick={() => setPaletteOpen(true)}
              title="Busca global (Ctrl+K)"
              aria-label="Busca global (Ctrl+K)"
              className="group hidden sm:flex items-center gap-2 h-9 px-2.5 rounded-md text-[var(--text-app-faint)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] transition-colors text-xs"
            >
              <Search size={14} />
              <span>Buscar…</span>
              <kbd className="ml-1 inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] rounded">
                ⌘K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              title="Busca global (Ctrl+K)"
              aria-label="Busca global (Ctrl+K)"
              className="sm:hidden text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)] h-9 w-9 p-0"
            >
              <Search size={16} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)] h-9 w-9 p-0"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Alternar tema claro/escuro"
              aria-label="Alternar tema claro/escuro"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme === "dark" ? "moon" : "sun"}
                  initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                </motion.span>
              </AnimatePresence>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)] h-9 w-9 p-0"
                  title="Cor de destaque"
                  aria-label="Cor de destaque"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-1 ring-[var(--border-app-strong)] shadow-inner"
                    style={{ background: `var(--accent-app)` }}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[var(--surface-app)] border-[var(--border-app)]">
                <DropdownMenuLabel className="text-[var(--text-app-muted)] text-xs">
                  Cor de destaque
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--border-app)]" />
                {CORES_DISPONIVEIS.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => {
                      setCorDestaque(c.id);
                      toast.success(`Cor: ${c.nome}`);
                    }}
                    className="text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] cursor-pointer"
                  >
                    <span
                      className="w-4 h-4 rounded-full mr-2 ring-1 ring-[var(--border-app-strong)]"
                      style={{ background: c.swatch }}
                    />
                    {c.nome}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] gap-2 h-9"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--brand-navy)] text-white text-[10px] font-semibold grid place-items-center shrink-0">
                    {usuario.nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                  </span>
                  <span className="hidden sm:inline text-xs font-medium">{usuario.nome.split(" ")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[var(--surface-app)] border-[var(--border-app)] min-w-56">
                <DropdownMenuLabel className="text-[var(--text-app)] font-normal py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{usuario.nome}</span>
                    <span className="text-[11px] text-[var(--text-app-muted)]">{usuario.email}</span>
                    <span className="text-[11px] text-[var(--accent-app-text)] mt-0.5">
                      {papelLabel(usuario.papel)} · {usuario.clinica.nome}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--border-app)]" />
                {podeEditar && (
                  <DropdownMenuItem
                    onClick={() => setConfigOpen(true)}
                    className="text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] cursor-pointer"
                  >
                    <Settings size={14} className="mr-2" />
                    Configurações da clínica
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setPaletteOpen(true)}
                  className="text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] cursor-pointer sm:hidden"
                >
                  <Search size={14} className="mr-2" />
                  Buscar (Ctrl+K)
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--border-app)] sm:hidden" />
                <DropdownMenuItem
                  disabled={logoutPending}
                  onClick={async () => {
                    setLogoutPending(true);
                    try { await encerrarSessao(); toast.success("Sessão encerrada"); }
                    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível sair. Tente novamente."); }
                    finally { setLogoutPending(false); }
                  }}
                  className="text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)] cursor-pointer"
                >
                  <LogOut size={14} className="mr-2" />
                  {logoutPending ? "Saindo..." : "Sair"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs de navegação */}
        <nav className="px-2 sm:px-4 flex gap-0.5 overflow-x-auto scroll-thin border-t border-[var(--border-app-subtle)]">
          {abasVisiveis.map((a) => {
            const ativa = abaEfetiva === a.id;
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                title={a.atalho ? `${a.label} (Ctrl+${a.atalho})` : a.label}
                aria-label={a.label}
                className={`group relative flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 sm:px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
                  ativa
                    ? "border-[var(--accent-app)] text-[var(--accent-app-text)]"
                    : "border-transparent text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app)]/50"
                }`}
              >
                <Icon
                  size={15}
                  className={ativa ? "text-[var(--accent-app-text)]" : "text-[var(--text-app-faint)] group-hover:text-[var(--text-app-muted)]"}
                />
                <span>{a.label}</span>
                {ativa && (
                  <motion.span
                    layoutId="aba-indicator"
                    className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--accent-app)] rounded-t-full"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Skip-to-content link for keyboard users — hidden until focused */}
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[var(--accent-app)] focus:text-white focus:text-sm focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <main id="conteudo-principal" className="flex-1 min-h-0 overflow-hidden bg-[var(--bg-app)] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={abaEfetiva}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto scroll-thin"
          >
            {abaEfetiva === "inicio" && <InicioTab onNavegar={irParaAba} />}
            {abaEfetiva === "custos" && <CustosCapacidadeTab />}
            {abaEfetiva === "procedimentos" && <ProcedimentosTab />}
            {abaEfetiva === "agenda" && <AgendaTab />}
            {abaEfetiva === "financeiro" && <FinanceiroTab />}
            {abaEfetiva === "usuarios" && <UsuariosTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer com atalhos de teclado - discreto */}
      <footer className="hidden md:flex items-center justify-between gap-4 px-4 sm:px-6 py-1.5 bg-[var(--surface-app)] border-t border-[var(--border-app-subtle)] text-[10px] text-[var(--text-app-faint)]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] font-mono">Ctrl</kbd>
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] font-mono">K</kbd>
            <span>buscar</span>
          </span>
          <span className="text-[var(--text-app-faint)]">·</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] font-mono">Ctrl</kbd>
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] font-mono">1–6</kbd>
            <span>trocar de aba</span>
          </span>
          <span className="text-[var(--text-app-faint)]">·</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)] font-mono">n</kbd>
            <span>novo item</span>
          </span>
          <span className="text-[var(--text-app-faint)]">·</span>
          <span>{abaInfo?.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-app-faint)]">Flux-X Odonto · v2.2</span>
        </div>
      </footer>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavegar={irParaAba}
      />

      {/* Configurações da clínica */}
      <ConfigClinicaDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        onClinicaAtualizada={(nomeAtualizado) => {
          // Atualiza o nome da clínica no store de sessão sem deslogar
          if (usuario) {
            setSessao(
              {
                ...usuario,
                clinica: { ...usuario.clinica, nome: nomeAtualizado },
              }
            );
          }
        }}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}

function papelLabel(p: "dono" | "financeiro" | "recepcao") {
  return p === "dono" ? "Dono(a)" : p === "financeiro" ? "Financeiro" : "Recepção";
}
