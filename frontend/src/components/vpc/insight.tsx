import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { stagger } from "../../lib/anim";
import {
  STATE_COLORS, STATE_LABELS, STATE_ORDER, formatSigned,
  isInactive,
} from "../../lib/vpc";

export interface Crumb {
  label: string;
  to?: string;
}

export function Crumbs({ items }: { items: Crumb[] }) {
  const navigate = useNavigate();
  const parent = [...items].reverse().find((c) => c.to);
  return (
    <nav
      aria-label="Путь"
      className="anim-head flex flex-wrap items-center gap-2 text-sm"
    >
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else if (parent?.to) navigate(parent.to);
        }}
        className="tr-soft flex h-9 items-center gap-1 rounded-full border-0 bg-surface pl-2.5 pr-3.5 text-[13px] text-fg-2 hover:bg-subtle"
      >
        <ChevronLeft size={15} />
        Назад
      </button>
      {items.map((c, i) => (
        <span key={`${i}:${c.label}`} className="flex items-center gap-2">
          {i > 0 && <ChevronRight size={13} className="text-faintest" />}
          {c.to ? (
            <Link to={c.to} className="text-accent hover:text-accent-hover">
              {c.label}
            </Link>
          ) : (
            <span className="text-fg">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Seg<T extends string>({
  options, value, onChange, label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-fit max-w-full overflow-x-auto rounded-xl bg-seg p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "tr-soft whitespace-nowrap rounded-[9px] border-0 px-3.5 py-1.5 text-[13px]",
            o.value === value
              ? "bg-white font-semibold text-fg shadow-seg-active"
              : "bg-transparent text-muted-2 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KpiCard({
  label, value, badge, note, progress, index = 0, tone,
}: {
  label: string;
  value: ReactNode;
  badge?: ReactNode;
  note?: ReactNode;
  progress?: number | null;
  index?: number;
  tone?: "bad";
}) {
  return (
    <div
      className="anim-rise flex min-w-0 flex-col gap-2 rounded-card bg-surface px-[22px] py-5"
      style={stagger(index)}
    >
      <span className="text-[13px] text-muted-2">{label}</span>
      <span className="flex flex-wrap items-center gap-2.5">
        <span
          className={clsx(
            "text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
            tone === "bad" && "text-bad",
          )}
        >
          {value}
        </span>
        {badge}
      </span>
      {progress != null && (
        <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-track">
          <span
            className="block h-full rounded-full bg-accent-bar"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </span>
      )}
      {note && <span className="text-xs text-faint">{note}</span>}
    </div>
  );
}

export function Pill({
  children, tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        tone === "good" && "bg-pos-tint text-pos",
        tone === "bad" && "bg-bad-tint text-bad-ink",
        tone === "neutral" && "bg-subtle text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function IndexBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-faint">—</span>;
  const tone = value < 0 ? "good" : value >= 10 ? "bad" : "neutral";
  return <Pill tone={tone}>{formatSigned(value)}</Pill>;
}

export function StateStrip({
  states, className, stop = true,
}: {
  states: Record<string, number>;
  className?: string;
  stop?: boolean;
}) {
  const parts = STATE_ORDER
    .map((s) => ({ state: s, count: states[s] ?? 0 }))
    .filter((p) => p.count > 0);
  const live = parts.filter((p) => !isInactive(p.state));
  const stopped = parts.filter((p) => isInactive(p.state))
    .reduce((s, p) => s + p.count, 0);
  return (
    <span
      className="flex min-w-0 items-center gap-2"
      title={parts.map((p) => `${STATE_LABELS[p.state]}: ${p.count}`)
        .join(" · ")}
    >
      <span
        className={clsx(
          "flex h-1.5 min-w-0 flex-1 gap-0.5 overflow-hidden rounded-full bg-track",
          className,
        )}
      >
        {live.map((p) => (
          <span
            key={p.state}
            style={{
              flexGrow: p.count,
              flexBasis: 0,
              background: STATE_COLORS[p.state],
            }}
          />
        ))}
      </span>
      {stop && stopped > 0 && (
        <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-faint">
          стоп {stopped}
        </span>
      )}
    </span>
  );
}

export function SectionCard({
  title, note, right, children, className,
}: {
  title: ReactNode;
  note?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "anim-rise flex min-w-0 flex-col gap-4 rounded-card bg-surface px-6 py-6 max-md:px-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[19px] font-semibold tracking-[-0.01em]">
            {title}
          </span>
          {note && <span className="text-[13px] text-faint">{note}</span>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function HeroStat({
  label, value, note, color,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-ink-fg-2">{label}</span>
      <span
        className="text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
      {note && <span className="text-[13px] text-ink-fg-2">{note}</span>}
    </div>
  );
}
