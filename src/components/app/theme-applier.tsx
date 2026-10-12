"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Lê a preferência de cor de destaque (Flux-X/azul/violeta) do localStorage e
 * aplica via `data-accent` no <html>. O claro/escuro é controlado pelo
 * next-themes (classe `.dark`).
 */
export function ThemeApplier() {
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    try {
      const cor = localStorage.getItem("corDestaque") || "flux";
      root.dataset.accent = cor;
    } catch {
      root.dataset.accent = "flux";
    }
  }, [theme]);

  return null;
}

export const CORES_DISPONIVEIS = [
  { id: "flux", swatch: "#087a9d", nome: "Flux-X" },
  { id: "blue", swatch: "#176da0", nome: "Azul radiográfico" },
  { id: "purple", swatch: "#7969bd", nome: "Violeta digital" },
] as const;

export function setCorDestaque(cor: string) {
  try {
    localStorage.setItem("corDestaque", cor);
  } catch {}
  document.documentElement.dataset.accent = cor;
}
