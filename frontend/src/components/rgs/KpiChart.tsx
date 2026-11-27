import { useState } from "react";
import type { RgsKpi } from "../../types/rgs";
import { formatDate } from "../../lib/format";

const W = 320;
const H = 150;
const PAD = { l: 36, r: 14, t: 16, b: 26 };

function fmt(k: RgsKpi, v: number): string {
  if (k.unit === "%") return `${v}%`;
  return k.unit ? `${v} ${k.unit}` : String(v);
}

function nice(v: number): number {
  if (v <= 5) return Math.max(1, Math.ceil(v));
  const step = 10 ** Math.floor(Math.log10(v)) / 2;
  return Math.ceil(v / step) * step;
}

export function KpiChart({
  k, points,
}: {
  k: RgsKpi;
  points: { date: string; value: number | null }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const lo = Math.min(0, k.goal, ...values);
  const top = Math.max(k.goal, ...values, k.unit === "%" ? 100 : 1);
  const hi = k.unit === "%" ? Math.max(100, top) : nice(top * 1.15);
  const x = (i: number) => points.length < 2
    ? (PAD.l + W - PAD.r) / 2
    : PAD.l + (i * (W - PAD.l - PAD.r)) / (points.length - 1);
  const y = (v: number) => PAD.t + ((hi - v) * (H - PAD.t - PAD.b)) / (hi - lo || 1);
  const path = points
    .map((p, i) => (p.value == null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(" L ");
  const last = [...points].reverse().find((p) => p.value != null);
  const hovered = hover == null ? null : points[hover];
  const step = points.length > 1 ? (W - PAD.l - PAD.r) / (points.length - 1) : W;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`${k.label}: ${points.map((p) => `${formatDate(p.date)} — ${p.value == null ? "нет данных" : fmt(k, p.value)}`).join("; ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {[lo, hi].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)}
              stroke="var(--color-line)" strokeWidth={1}
            />
            <text
              x={PAD.l - 6} y={y(v) + 3} textAnchor="end"
              className="fill-faint text-[10px] tabular-nums"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}
        <line
          x1={PAD.l} x2={W - PAD.r} y1={y(k.goal)} y2={y(k.goal)}
          stroke="var(--color-pos)" strokeWidth={1.5} strokeDasharray="4 3"
        />
        <text
          x={W - PAD.r} y={y(k.goal) - 4} textAnchor="end"
          className="fill-pos text-[10px] font-medium"
        >
          цель {fmt(k, k.goal)}
        </text>
        {hover != null && (
          <line
            x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b}
            stroke="var(--color-line-strong)" strokeWidth={1}
          />
        )}
        {path && (
          <path
            d={`M ${path}`}
            fill="none"
            stroke="var(--color-rgs-ink)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => p.value != null && (
          <circle
            key={p.date + i}
            cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 4}
            fill="var(--color-rgs-ink)"
            stroke="var(--color-surface)" strokeWidth={2}
          />
        ))}
        {last && last.value != null && hover == null && (
          <text
            x={x(points.lastIndexOf(last))}
            y={y(last.value) - 9}
            textAnchor={points.length > 1 ? "end" : "middle"}
            className="fill-fg text-[11px] font-semibold tabular-nums"
          >
            {fmt(k, last.value)}
          </text>
        )}
        {points.map((p, i) => (
          <text
            key={`d${p.date}${i}`}
            x={x(i)} y={H - 8}
            textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            className="fill-muted-2 text-[10px] tabular-nums"
          >
            {formatDate(p.date).slice(0, 5)}
          </text>
        ))}
        {points.map((p, i) => (
          <rect
            key={`h${p.date}${i}`}
            x={x(i) - step / 2} y={0} width={step} height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-fg px-2.5 py-1.5 text-xs text-white shadow-pop"
          style={{ left: `${(x(hover ?? 0) / W) * 100}%` }}
        >
          {formatDate(hovered.date)} ·{" "}
          <b className="font-semibold">
            {hovered.value == null ? "нет данных" : fmt(k, hovered.value)}
          </b>
        </div>
      )}
    </div>
  );
}
