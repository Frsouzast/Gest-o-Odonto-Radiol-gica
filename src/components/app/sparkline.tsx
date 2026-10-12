"use client";

import { useMemo } from "react";

interface SparklineProps {
  valores: number[];
  cor?: string; // hex ou var CSS
  largura?: number;
  altura?: number;
  strokeWidth?: number;
  preencher?: boolean;
}

/**
 * Mini gráfico de linha (sparkline) sem dependências externas.
 * SVG puro com gradient fill opcional.
 * Ideal para KPI cards mostrando tendência de 6 meses.
 */
export function Sparkline({
  valores,
  cor = "var(--accent-app)",
  largura = 120,
  altura = 36,
  strokeWidth = 1.5,
  preencher = true,
}: SparklineProps) {
  const { path, areaPath, gradientId } = useMemo(() => {
    const id = `spark-${Math.random().toString(36).slice(2, 9)}`;
    if (!valores || valores.length === 0) {
      return { path: "", areaPath: "", gradientId: id };
    }
    const n = valores.length;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const range = max - min || 1;
    const padX = 1;
    const padY = 4;
    const stepX = (largura - padX * 2) / Math.max(n - 1, 1);
    const escalaY = (v: number) =>
      altura - padY - ((v - min) / range) * (altura - padY * 2);

    const pontos = valores.map((v, i) => [padX + i * stepX, escalaY(v)] as const);

    // Path linha
    const linePath = pontos
      .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
      .join(" ");

    // Path área (fechada embaixo)
    const areaP = `${linePath} L ${pontos[pontos.length - 1][0]} ${altura} L ${pontos[0][0]} ${altura} Z`;

    return { path: linePath, areaPath: areaP, gradientId: id };
  }, [valores, largura, altura]);

  if (!valores || valores.length === 0) return null;

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {preencher && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={cor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={cor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Último ponto destacado */}
      {valores.length > 1 && (() => {
        const n = valores.length;
        const min = Math.min(...valores);
        const max = Math.max(...valores);
        const range = max - min || 1;
        const padX = 1;
        const padY = 4;
        const stepX = (largura - padX * 2) / Math.max(n - 1, 1);
        const escalaY = (v: number) =>
          altura - padY - ((v - min) / range) * (altura - padY * 2);
        const lastX = padX + (n - 1) * stepX;
        const lastY = escalaY(valores[n - 1]);
        return <circle cx={lastX} cy={lastY} r={1.8} fill={cor} />;
      })()}
    </svg>
  );
}

interface BarSparklineProps {
  valores: number[];
  cor?: string;
  corNegativa?: string;
  largura?: number;
  altura?: number;
}

/**
 * Mini gráfico de barras — bom pra resultados que podem ser negativos.
 * Barra verde se positiva, vermelha se negativa (com base zero).
 */
export function BarSparkline({
  valores,
  cor = "var(--accent-app)",
  corNegativa = "var(--danger-app)",
  largura = 120,
  altura = 36,
}: BarSparklineProps) {
  const bars = useMemo(() => {
    if (!valores || valores.length === 0) return [];
    const n = valores.length;
    const max = Math.max(...valores.map((v) => Math.abs(v))) || 1;
    const gap = 1.5;
    const barWidth = (largura - (n - 1) * gap) / n;
    const zeroY = altura / 2;
    return valores.map((v, i) => {
      const h = (Math.abs(v) / max) * (altura / 2 - 2);
      return {
        x: i * (barWidth + gap),
        y: v >= 0 ? zeroY - h : zeroY,
        width: barWidth,
        height: h,
        fill: v >= 0 ? cor : corNegativa,
        opacity: 0.45 + 0.55 * ((i + 1) / n),
      };
    });
  }, [valores, cor, corNegativa, largura, altura]);

  if (bars.length === 0) return null;

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        x2={largura}
        y1={altura / 2}
        y2={altura / 2}
        stroke="var(--border-app)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.width}
          height={Math.max(b.height, 1)}
          fill={b.fill}
          opacity={b.opacity}
          rx={0.5}
        />
      ))}
    </svg>
  );
}
