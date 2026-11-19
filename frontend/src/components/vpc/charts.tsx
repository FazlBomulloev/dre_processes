import { useState } from "react";
import clsx from "clsx";
import { formatInt } from "../../lib/format";
import { SectionCard } from "./insight";
import {
  MONTHS, SERIES, monthTitle, niceTop,
} from "../../lib/charts";
import type { MonthPoint } from "../../lib/charts";

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

export function MonthsChart({ months }: { months: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceTop(
    Math.max(1, ...months.flatMap((m) => [m.new, m.contracts, m.stops])),
  );
  const ticks = [4, 3, 2, 1, 0].map((i) => (top / 4) * i);
  const peak = months.reduce(
    (best, m, i) => (m.new > months[best].new ? i : best), 0,
  );
  const h = hover == null ? null : months[hover];
  return (
    <SectionCard
      title="Динамика по месяцам"
      note="новые (дата создания), контракты (дата «Кк»), остановки (дата статуса) · наведите на месяц"
      right={(
        <span className="flex flex-wrap gap-3.5 text-xs text-muted-2">
          {SERIES.map((s) => (
            <Legend key={s.key} color={s.color} label={s.label} />
          ))}
        </span>
      )}
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-[28px_minmax(0,1fr)] gap-x-2 pt-2">
          <div className="flex h-[220px] flex-col justify-between text-right text-[11px] tabular-nums text-muted-2">
            {ticks.map((t) => (
              <span key={t} className="-my-1.5">{formatInt(t)}</span>
            ))}
          </div>
          <div
            className="relative h-[220px]"
            onMouseLeave={() => setHover(null)}
          >
            <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
              {ticks.map((t) => (
                <span
                  key={t}
                  className={clsx(
                    "border-t",
                    t === 0 ? "border-line-strong" : "border-dashed border-line-strong/60",
                  )}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex items-end gap-1.5">
              {months.map((m, i) => (
                <button
                  key={m.month}
                  type="button"
                  aria-label={`${monthTitle(m.month)}: новые ${m.new}, контракты ${m.contracts}, остановки ${m.stops}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className={clsx(
                    "flex h-full flex-1 cursor-default items-end justify-center gap-[3px] rounded-lg border-0 p-0",
                    hover === i ? "bg-accent-tint" : "bg-transparent",
                  )}
                >
                  {SERIES.map((s) => (
                    <span
                      key={s.key}
                      className="w-[22%] max-w-4 rounded-t-[4px]"
                      style={{
                        height: `${(m[s.key] / top) * 100}%`,
                        minHeight: m[s.key] ? 3 : 0,
                        background: s.color,
                      }}
                    />
                  ))}
                </button>
              ))}
            </div>
            {h && hover != null && (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-2 z-10 flex w-[184px] flex-col gap-1.5 rounded-xl bg-fg px-3.5 py-3 text-xs text-white shadow-pop"
                style={hover >= months.length / 2
                  ? { right: `calc(${((months.length - hover) / months.length) * 100}% + 8px)` }
                  : { left: `calc(${((hover + 1) / months.length) * 100}% + 8px)` }}
              >
                <b className="text-[13px] font-semibold">
                  {monthTitle(h.month)}
                </b>
                {SERIES.map((s) => (
                  <span key={s.key} className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-sm"
                        style={{ background: s.color }}
                      />
                      {s.label}
                    </span>
                    <b className="tabular-nums">{h[s.key]}</b>
                  </span>
                ))}
                {hover === peak && h.new > 0 && (
                  <span className="border-t border-white/15 pt-1.5 text-white/70">
                    пик новых за 12 месяцев
                  </span>
                )}
              </div>
            )}
          </div>
          <span />
          <div className="flex gap-1.5 pt-2">
            {months.map((m, i) => {
              const [year, month] = m.month.split("-").map(Number);
              return (
                <span
                  key={m.month}
                  className={clsx(
                    "flex-1 text-center text-xs",
                    i === months.length - 1
                      ? "font-semibold text-fg" : "text-muted-2",
                  )}
                >
                  {MONTHS[month - 1]}
                  {(i === 0 || month === 1) && ` ${String(year).slice(2)}`}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
