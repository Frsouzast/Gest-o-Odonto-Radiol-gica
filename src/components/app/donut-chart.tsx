"use client";

import { useMemo } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string; // hex ou var CSS
}

interface DonutChartProps {
  slices: DonutSlice[];
  tamanho?: number;
  strokeWidth?: number;
  centroLabel?: string;
  centroValor?: string;
}

/**
 * Donut chart SVG puro (sem recharts) — ideal para distribuição de status.
 * Mostra o total no centro e as fatias coloridas ao redor.
 * Tooltip nativo via <title> em cada fatia (acessível).
 */
export function DonutChart({
  slices,
  tamanho = 140,
  strokeWidth = 18,
  centroLabel,
  centroValor,
}: DonutChartProps) {
  const { paths, total } = useMemo(() => {
    const total = slices.reduce((s, x) => s + x.value, 0);
    const raio = (tamanho - strokeWidth) / 2;
    const cx = tamanho / 2;
    const cy = tamanho / 2;
    const circunferencia = 2 * Math.PI * raio;

    if (total === 0) {
      return { paths: [], total: 0 };
    }

    let offset = 0;
    const paths = slices
      .filter((s) => s.value > 0)
      .map((s) => {
        const fracao = s.value / total;
        const comprimento = fracao * circunferencia;
        const gap = circunferencia - comprimento;
        const resultado = {
          key: `${s.label}-${offset}`,
          d: `M ${cx} ${cy} m -${raio} 0 a ${raio} ${raio} 0 1 0 ${raio * 2} 0 a ${raio} ${raio} 0 1 0 -${raio * 2} 0`,
          stroke: s.color,
          strokeDasharray: `${comprimento} ${gap}`,
          strokeDashoffset: -offset,
          label: s.label,
          value: s.value,
          fracao,
        };
        offset += comprimento;
        return resultado;
      });

    return { paths, total };
  }, [slices, tamanho, strokeWidth]);

  if (total === 0) {
    return (
      <div
        className="grid place-items-center text-center text-[var(--text-app-faint)] text-xs"
        style={{ width: tamanho, height: tamanho }}
      >
        Sem dados
      </div>
    );
  }

  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const raio = (tamanho - strokeWidth) / 2;

  return (
    <div className="relative inline-grid place-items-center" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        {/* Track de fundo */}
        <circle
          cx={cx}
          cy={cy}
          r={raio}
          fill="none"
          stroke="var(--bg-app-alt-strong)"
          strokeWidth={strokeWidth}
        />
        {/* Fatias */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {paths.map((p) => (
            <circle
              key={p.key}
              cx={cx}
              cy={cy}
              r={raio}
              fill="none"
              stroke={p.stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={p.strokeDasharray}
              strokeDashoffset={p.strokeDashoffset}
              strokeLinecap="butt"
            >
              <title>
                {p.label}: {p.value} ({(p.fracao * 100).toFixed(1)}%)
              </title>
            </circle>
          ))}
        </g>
      </svg>
      {/* Centro */}
      {(centroLabel || centroValor) && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            {centroValor && (
              <div className="text-xl font-mono tabular-nums font-semibold text-[var(--text-app)] leading-tight">
                {centroValor}
              </div>
            )}
            {centroLabel && (
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-app-faint)]">
                {centroLabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface DonutLegendProps {
  slices: DonutSlice[];
  total: number;
}

/**
 * Legenda lateral pro donut — mostra cor, label, contagem e %.
 */
export function DonutLegend({ slices, total }: DonutLegendProps) {
  if (total === 0) return null;
  return (
    <ul className="space-y-1.5">
      {slices.map((s) => {
        const pct = total > 0 ? (s.value / total) * 100 : 0;
        return (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-[var(--text-app-secondary)] flex-1 truncate">
              {s.label}
            </span>
            <span className="font-mono tabular-nums text-[var(--text-app)] font-medium">
              {s.value}
            </span>
            <span className="font-mono tabular-nums text-[var(--text-app-faint)] text-[10px] w-10 text-right">
              {pct.toFixed(0)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
