"use client";

/**
 * Event bus simples pra comunicação entre o AppShell (que captura o atalho 'n')
 * e as tabs (que registram handlers pra abrir o dialog/form de "novo item").
 *
 * Uso:
 * - Tab: useNovoAtalho(() => setDialogOpen(true))  // registra handler
 * - AppShell: dispara evento global 'novo-item' quando 'n' é pressionado
 */

const EVENTO = "app:novo-item";

export function dispararNovoItem() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/**
 * Registra um handler que será chamado quando o atalho 'n' for pressionado.
 * Retorna uma função de cleanup. Use dentro de useEffect.
 */
export function onNovoItem(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(EVENTO, listener);
  return () => window.removeEventListener(EVENTO, listener);
}
