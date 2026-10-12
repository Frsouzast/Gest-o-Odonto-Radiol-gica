"use client";

import { toast } from "sonner";

/**
 * Converte um array de objetos em CSV (separador `;` para compatibilidade com Excel PT-BR)
 * e dispara o download no navegador.
 */
type ColunaCSV<T extends object> = {
  chave: keyof T;
  label: string;
  format?: (v: T[keyof T]) => string;
};

export function exportarCSV<T extends object>(
  dados: T[],
  nomeArquivo: string,
  colunas?: ColunaCSV<T>[]
): void {
  if (!dados || dados.length === 0) {
    toast.error("Não há dados para exportar.");
    return;
  }

  const cols: ColunaCSV<T>[] =
    colunas ||
    Object.keys(dados[0]).map((k) => ({ chave: k as keyof T, label: k }));
  const escapeCSV = (v: string) => {
    if (v == null) return "";
    if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const formatRow = (row: T) =>
    cols.map((c) => {
      const raw = row[c.chave];
      const val = c.format ? c.format(raw) : raw == null ? "" : String(raw);
      return escapeCSV(val);
    }).join(";");

  const header = cols.map((c) => escapeCSV(c.label)).join(";");
  const body = dados.map(formatRow).join("\r\n");
  const csv = `\ufeff${header}\r\n${body}`; // BOM UTF-8 p/ Excel ler acentos

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`CSV exportado: ${nomeArquivo}.csv`);
}

/**
 * Abre uma janela de impressão (PDF via Ctrl+P do navegador) com um título
 * e uma tabela HTML formatada. Mais confiável que jsPDF — usa o motor do
 * próprio navegador para quebrar páginas e respeitar o tema.
 */
export function imprimirTabela(
  titulo: string,
  subtitulo: string,
  colunas: { label: string; format?: (row: Record<string, unknown>) => string }[],
  dados: Record<string, unknown>[],
  accentColor: string = "#087a9d"
): void {
  if (!dados || dados.length === 0) {
    toast.error("Não há dados para imprimir.");
    return;
  }

  const dataHora = new Date().toLocaleString("pt-BR");
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${titulo}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #183247; margin: 24px; }
  h1 { color: ${accentColor}; font-size: 20px; margin: 0 0 4px; }
  .sub { color: #617a8c; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: ${accentColor}; color: white; text-align: left; padding: 6px 8px; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #dbe7ee; }
  tr:nth-child(even) td { background: #f6fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .footer { margin-top: 24px; color: #617a8c; font-size: 10px; border-top: 1px solid #dbe7ee; padding-top: 8px; }
  @page { margin: 1.5cm; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${titulo}</h1>
  <p class="sub">${subtitulo}</p>
  <table>
    <thead><tr>${colunas.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
    <tbody>
      ${dados
        .map(
          (row) =>
            `<tr>${colunas
              .map((c) => {
                const v = c.format ? c.format(row) : "";
                const isNumeric = /^[\d.,\-+\sR$%]+$/.test(v);
                return `<td${isNumeric ? ' class="num"' : ""}>${v}</td>`;
              })
              .join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>
  <div class="footer">Gerado por Flux-X Odonto · ${dataHora}</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 200); };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    toast.error("Popup bloqueado. Permita popups para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  toast.success("Abrindo janela de impressão…");
}

export const fmtBRL = (v: unknown) =>
  typeof v === "number" && isFinite(v)
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export const fmtData = (v: unknown) => {
  if (typeof v !== "string" || !v) return "—";
  const s = v.slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
};

export const fmtPct = (v: unknown) =>
  typeof v === "number" && isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
