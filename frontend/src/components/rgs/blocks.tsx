import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { stagger } from "../../lib/anim";
import {
  TONE_BAR, TONE_LABEL, kpiGoal, kpiValue, rgsUrl,
} from "../../lib/rgs";
import type { RgsCheck, RgsKpi } from "../../types/rgs";
import { TonePill } from "./chips";

export function KpiTile({ k, index }: { k: RgsKpi; index: number }) {
  return (
    <div
      className="anim-rise flex min-w-0 flex-col gap-1.5 rounded-card bg-surface px-5 py-4"
      style={stagger(index)}
    >
      <span className="text-[13px] text-muted-2">{k.label}</span>
      <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
        {kpiValue(k)}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <TonePill tone={k.tone}>{TONE_LABEL[k.tone]}</TonePill>
        <span className="text-muted-2">цель {kpiGoal(k)}</span>
      </span>
      <span className="text-xs text-faint">{k.base}</span>
    </div>
  );
}

export function KpiGrid({ kpis }: { kpis: RgsKpi[] }) {
  return (
    <div className="grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-sm:grid-cols-2">
      {kpis.map((k, i) => <KpiTile key={k.key} k={k} index={i} />)}
    </div>
  );
}

export function NormBar({
  fact, norm, max, tone,
}: {
  fact: number | null;
  norm: number | null;
  max: number;
  tone: keyof typeof TONE_BAR;
}) {
  const width = fact == null ? 0 : Math.min(100, (fact / max) * 100);
  const mark = norm == null ? null : Math.min(100, (norm / max) * 100);
  return (
    <span className="relative block h-3 rounded-full bg-track">
      <span
        className={clsx("block h-full rounded-full", TONE_BAR[tone])}
        style={{ width: `${width}%` }}
      />
      {mark != null && (
        <span
          aria-hidden
          className="absolute -top-1 h-5 w-0.5 rounded-full bg-rgs-ink"
          style={{ left: `${mark}%` }}
        />
      )}
    </span>
  );
}

export function ChecksList({
  code, items, count, more,
}: {
  code: string;
  items: RgsCheck[];
  count: number;
  more?: boolean;
}) {
  return (
    <section className="anim-rise flex flex-col gap-2 rounded-card bg-warn-tint px-6 py-5 text-warn-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-base font-semibold">
          Проверить данные · {count}
        </span>
        {more && count > items.length && (
          <Link
            to={rgsUrl(code, "checks")}
            className="text-[13px] font-medium text-warn-ink underline underline-offset-4"
          >
            Все {count}
          </Link>
        )}
      </div>
      {count === 0 && (
        <span className="text-sm">Ошибок в трекере не найдено.</span>
      )}
      {items.map((c, i) => (
        <span key={`${c.id}:${c.kind}:${i}`} className="text-[13px]">
          <b className="font-semibold">{c.tm}</b>
          {c.sub && <span className="opacity-70"> · {c.sub}</span>} —{" "}
          {c.text}
        </span>
      ))}
    </section>
  );
}

export function Legend({ items }: { items: [keyof typeof TONE_BAR, ReactNode][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-2">
      {items.map(([tone, text]) => (
        <span key={tone} className="flex items-center gap-1.5">
          <span className={clsx("size-2.5 rounded-full", TONE_BAR[tone])} />
          {text}
        </span>
      ))}
    </div>
  );
}
