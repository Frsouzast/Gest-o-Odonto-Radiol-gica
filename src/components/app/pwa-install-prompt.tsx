"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { FluxXMark } from "./flux-x-mark";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA Install Prompt — mostra um banner discreto no canto inferior
 * quando o browser detecta que o app é instalável (antes do beforeinstallprompt).
 * Algumas condições precisam ser atendidas:
 * - manifest.json válido com icons
 * - HTTPS (ou localhost)
 * - Service worker registrado (mesmo que vazio)
 * - Usuário engajou com a página por pelo menos 30s
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("pwa-install-dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after 3s delay for non-intrusive UX
      setTimeout(() => setVisible(true), 3000);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    try {
      sessionStorage.setItem("pwa-install-dismissed", "1");
    } catch {}
  }

  if (dismissed || !visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-40 bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl shadow-lg p-4 max-w-xs"
        >
          <button
            onClick={handleDismiss}
            aria-label="Fechar"
            className="absolute top-2 right-2 text-[var(--text-app-faint)] hover:text-[var(--text-app)]"
          >
            <X size={14} />
          </button>
          <div className="flex items-start gap-3 pr-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--brand-film)] border border-[var(--border-app)] grid place-items-center shrink-0">
              <FluxXMark className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-app)] mb-0.5">
                Instalar app
              </h4>
              <p className="text-[11px] text-[var(--text-app-muted)] mb-2">
                Adicione à tela inicial para acessar o Flux-X com mais facilidade.
              </p>
              <button
                onClick={handleInstall}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)] transition-colors"
              >
                Instalar agora
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
