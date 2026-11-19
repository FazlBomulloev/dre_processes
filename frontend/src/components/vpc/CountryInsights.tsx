import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { formatInt } from "../../lib/format";
import {
  STATE_COLORS, STATE_LABELS, countryScope, formatPct, makerStripe,
  otherKey, otherMode, plural,
} from "../../lib/vpc";
import type {
  Brief, CountryBrief, CountryDetail, MakerBrief, MnnBrief,
} from "../../types/vpc";
import { useVpcLinks } from "../../hooks/useVpcScope";
import { CountryCode } from "./chips";
import { IndexBadge, SectionCard, StateStrip } from "./insight";

const TOP_ROWS = 10;
const STATUS_ORDER = [
  "work", "contract", "result", "stop", "unknown",
];

export function StatusLine({ d }: { d: CountryDetail }) {
  const { listUrl } = useVpcLinks();
  const scope = countryScope(d);
  const shown = STATUS_ORDER.filter((s) => (d.states[s] ?? 0) > 0
    && s !== "stop");
  return (
    <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
      {shown.map((s) => (
        <Link
          key={s}
          to={listUrl("countries", { ...scope, state: s })}
          className="flex items-center gap-1.5 text-ink-fg-2 hover:text-white"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: STATE_COLORS[s] }}
          />
          {STATE_LABELS[s].toLowerCase()}
          <b className="font-semibold tabular-nums text-white">
            {formatInt(d.states[s] ?? 0)}
          </b>
        </Link>
      ))}
    </span>
  );
}

export function StatusTiles({
  d, compact = false,
}: {
  d: CountryDetail;
  compact?: boolean;
}) {
  const { listUrl } = useVpcLinks();
  const scope = countryScope(d);
  const shown = STATUS_ORDER.filter((s) => (
    d.states[s] ?? 0) > 0 || ["work", "contract", "result", "stop"]
    .includes(s));
  return (
    <div
      className={clsx(
        "grid gap-2",
        compact
          ? "grid-cols-2"
          : "grid-cols-[repeat(auto-fit,minmax(150px,1fr))]",
      )}
    >
      {shown.map((s) => {
        const n = d.states[s] ?? 0;
        return (
          <Link
            key={s}
            to={listUrl("countries", { ...scope, state: s })}
            className="tr-soft flex flex-col gap-1 rounded-xl bg-subtle px-3.5 py-3 text-fg hover:bg-track hover:text-fg"
          >
            <span className="flex items-center gap-2 text-xs text-muted-2">
              <span
                className="size-2 rounded-full"
                style={{ background: STATE_COLORS[s] }}
              />
              {STATE_LABELS[s]}
            </span>
            <span className="flex items-baseline gap-2">
              <b className="text-[22px] font-semibold leading-none tabular-nums">
                {formatInt(n)}
              </b>
              <span className="text-xs tabular-nums text-muted-2">
                {formatPct(d.offers ? (n / d.offers) * 100 : null)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function ConversionNote({
  d, onInk = false,
}: {
  d: CountryDetail;
  onInk?: boolean;
}) {
  if (d.average == null || d.conversion == null) return null;
  const diff = d.conversion - d.average;
  const tone = diff >= 0
    ? onInk ? "text-pos-on-ink" : "text-pos"
    : onInk ? "text-white" : "text-bad";
  return (
    <span
      className={clsx(
        "text-[13px]", onInk ? "text-ink-fg-2" : "text-muted-2",
      )}
    >
      Дошли до контракта{" "}
      <b className={onInk ? "text-white" : "text-fg"}>
        {formatInt(d.contracts)}
      </b> ({formatPct(d.conversion)}), в среднем по всем странам{" "}
      {formatPct(d.average)}{" "}
      <b className={tone}>
        ({diff >= 0 ? "+" : "−"}{Math.abs(diff).toFixed(1)} п.п.)
      </b>
    </span>
  );
}

function Counts({ b }: { b: Brief }) {
  const work = b.states.work ?? 0;
  const stop = b.states.stop ?? 0;
  return (
    <>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {formatInt(work)}
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-pos">
        {formatInt(b.contracts)}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted">
        {formatInt(stop)}
      </td>
      <td className="px-3 py-2.5 text-right text-xs tabular-nums">
        {formatPct(b.conversion)}
      </td>
    </>
  );
}

function OffersCell({ b, max, to }: { b: Brief; max: number; to: string }) {
  return (
    <td className="w-[210px] px-3 py-2.5">
      <span className="flex items-center gap-2.5">
        <span className="h-1.5 flex-1 rounded-full bg-track">
          <span
            className="block h-full rounded-full bg-accent-bar"
            style={{ width: `${(b.offers / max) * 100}%` }}
          />
        </span>
        <Link
          to={to}
          onClick={(e) => e.stopPropagation()}
          className="w-8 text-right font-semibold tabular-nums text-fg hover:text-accent"
        >
          {formatInt(b.offers)}
        </Link>
        <span className="w-10 text-xs tabular-nums text-muted-2">
          {formatPct(b.share)}
        </span>
      </span>
    </td>
  );
}

const HEAD = "px-3 py-2.5 font-medium";

function StatusHead() {
  return (
    <>
      <th className={`${HEAD} w-[130px]`}>Статусы</th>
      <th className={`${HEAD} text-right`}>В работе</th>
      <th className={`${HEAD} text-right`}>Контракты</th>
      <th className={`${HEAD} text-right`}>Стоп</th>
      <th className={`${HEAD} pr-6 text-right`}>Конверсия</th>
    </>
  );
}

function CountryLabel({
  c, mode,
}: {
  c: { code: string; name: string };
  mode: "target" | "maker";
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {mode === "target" ? (
        <CountryCode code={c.code} />
      ) : (
        <span
          className="h-4 w-[3px] shrink-0 rounded-full"
          style={{ background: makerStripe(c.code) }}
        />
      )}
      <span className="truncate">{c.name}</span>
    </span>
  );
}

function ShowAll({
  shown, total, all, onToggle,
}: {
  shown: number;
  total: number;
  all: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="px-6 pt-1 text-[13px] text-muted-2 max-md:px-4">
      Показаны {formatInt(shown)} из {formatInt(total)}
      {(total > TOP_ROWS) && (
        <>
          {" · "}
          <button
            type="button"
            onClick={onToggle}
            className="border-0 bg-transparent p-0 font-medium text-accent hover:text-accent-hover"
          >
            {all ? "свернуть" : "показать все"}
          </button>
        </>
      )}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      size={15}
      className={clsx(
        "shrink-0 text-muted-2 transition-transform",
        open && "rotate-180",
      )}
    />
  );
}

function NestedList({
  title, rows, label, to,
}: {
  title: string;
  rows: (Brief & { key: string })[];
  label: (row: Brief & { key: string }) => ReactNode;
  to: (row: Brief & { key: string }) => string;
}) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.offers));
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-2">{title}</span>
      {rows.map((r) => (
        <Link
          key={r.key}
          to={to(r)}
          className="tr-soft grid grid-cols-[minmax(0,1fr)_70px_32px_28px_28px] items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-fg hover:bg-surface hover:text-fg"
        >
          <span className="min-w-0 truncate">{label(r)}</span>
          <span className="h-1 rounded-full bg-track">
            <span
              className="block h-full rounded-full bg-accent-bar"
              style={{ width: `${(r.offers / max) * 100}%` }}
            />
          </span>
          <b className="text-right font-semibold tabular-nums">
            {formatInt(r.offers)}
          </b>
          <span
            className="text-right tabular-nums text-pos"
            title="контрактов"
          >
            {formatInt(r.contracts)}
          </span>
          <span
            className="text-right tabular-nums text-muted"
            title="стоп"
          >
            {formatInt(r.states.stop ?? 0)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function makerRows(rows: MakerBrief[]) {
  return rows.map((m) => ({ ...m, key: m.maker }));
}

function mnnRows(rows: MnnBrief[]) {
  return rows.map((m) => ({ ...m, key: m.name }));
}

function countryRows(rows: CountryBrief[]) {
  return rows.map((c) => ({ ...c, key: c.code }));
}

const NESTED_LEGEND = "предложений · контрактов · стоп";

export function LinksCard({ d }: { d: CountryDetail }) {
  const { listUrl, countryUrl } = useVpcLinks();
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const scope = countryScope(d);
  const key = otherKey(d);
  const mode = otherMode(d);
  const target = d.mode === "target";
  const rows = all ? d.links : d.links.slice(0, TOP_ROWS);
  const max = Math.max(1, ...d.links.map((l) => l.offers));
  return (
    <section className="anim-rise flex min-w-0 flex-col gap-3 rounded-card bg-surface pb-4 pt-6">
      <div className="flex flex-col gap-0.5 px-6 max-md:px-4">
        <span className="text-[19px] font-semibold tracking-[-0.01em]">
          {target ? `Откуда берём для ${d.code}` : "Куда поставляют"}
        </span>
        <span className="text-[13px] text-faint">
          {formatInt(d.links_total)}{" "}
          {plural(d.links_total, "страна", "страны", "стран")}
          {target ? " заводов" : " поиска"} · строка раскрывает МНН и
          заводы
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="bg-subtle text-left text-xs text-muted-2">
              <th className="py-2.5 pl-6 pr-3 font-medium">Страна</th>
              <th className={HEAD}>Предложения</th>
              {target && <th className={`${HEAD} text-right`}>Индекс</th>}
              <StatusHead />
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const on = open === l.code;
              const own = { ...scope, [key]: l.code };
              return (
                <Fragment key={l.code}>
                  <tr
                    onClick={() => setOpen(on ? null : l.code)}
                    aria-expanded={on}
                    className={clsx(
                      "tr-soft cursor-pointer border-t border-line hover:bg-subtle",
                      on && "bg-subtle",
                    )}
                  >
                    <td className="py-2.5 pl-6 pr-3 font-semibold">
                      <span className="flex items-center gap-2">
                        <Chevron open={on} />
                        <Link
                          to={countryUrl(l.code, mode)}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 max-w-[200px] text-fg hover:text-accent"
                        >
                          <CountryLabel c={l} mode={mode} />
                        </Link>
                      </span>
                    </td>
                    <OffersCell
                      b={l}
                      max={max}
                      to={listUrl("countries", own)}
                    />
                    {target && (
                      <td className="px-3 py-2.5 text-right">
                        <IndexBadge value={l.index} />
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <StateStrip states={l.states} stop={false} />
                    </td>
                    <Counts b={l} />
                  </tr>
                  {on && (
                    <tr className="bg-subtle">
                      <td colSpan={target ? 8 : 7} className="px-6 pb-4 pt-1">
                        <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
                          <NestedList
                            title={`Какие МНН · ${NESTED_LEGEND}`}
                            rows={mnnRows(l.mnn)}
                            label={(r) => r.key}
                            to={(r) => listUrl("countries", {
                              ...own, mnn: r.key,
                            })}
                          />
                          <NestedList
                            title={`Заводы · ${NESTED_LEGEND}`}
                            rows={makerRows(l.makers)}
                            label={(r) => (
                              <span className="uppercase">{r.key}</span>
                            )}
                            to={(r) => listUrl("countries", {
                              ...own, maker: r.key,
                            })}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShowAll
        shown={rows.length}
        total={d.links.length}
        all={all}
        onToggle={() => setAll(!all)}
      />
    </section>
  );
}

export function MoleculesCard({ d }: { d: CountryDetail }) {
  const { listUrl } = useVpcLinks();
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const scope = countryScope(d);
  const key = otherKey(d);
  const mode = otherMode(d);
  const target = d.mode === "target";
  const rows = all ? d.molecules : d.molecules.slice(0, TOP_ROWS);
  const max = Math.max(1, ...d.molecules.map((m) => m.offers));
  return (
    <section className="anim-rise flex min-w-0 flex-col gap-3 rounded-card bg-surface pb-4 pt-6">
      <div className="flex flex-col gap-0.5 px-6 max-md:px-4">
        <span className="text-[19px] font-semibold tracking-[-0.01em]">
          {target ? "Какие молекулы берём" : "Какие молекулы предлагают"}
        </span>
        <span className="text-[13px] text-faint">
          {formatInt(d.molecules_total)} МНН · строка раскрывает{" "}
          {target ? "страны заводов" : "рынки"} и заводы
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="bg-subtle text-left text-xs text-muted-2">
              <th className="py-2.5 pl-6 pr-3 font-medium">МНН</th>
              <th className={HEAD}>Предложения</th>
              <th className={`${HEAD} text-right`}>
                {target ? "Стран" : "Рынков"}
              </th>
              <th className={`${HEAD} text-right`}>Заводов</th>
              <StatusHead />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const on = open === m.name;
              const own = { ...scope, mnn: m.name };
              return (
                <Fragment key={m.name}>
                  <tr
                    onClick={() => setOpen(on ? null : m.name)}
                    aria-expanded={on}
                    className={clsx(
                      "tr-soft cursor-pointer border-t border-line hover:bg-subtle",
                      on && "bg-subtle",
                    )}
                  >
                    <td className="py-2.5 pl-6 pr-3 font-semibold">
                      <span className="flex items-center gap-2">
                        <Chevron open={on} />
                        <span className="max-w-[240px] truncate">
                          {m.name}
                        </span>
                      </span>
                    </td>
                    <OffersCell
                      b={m}
                      max={max}
                      to={listUrl("countries", own)}
                    />
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatInt(m.countries)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatInt(m.makers_count)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StateStrip states={m.states} stop={false} />
                    </td>
                    <Counts b={m} />
                  </tr>
                  {on && (
                    <tr className="bg-subtle">
                      <td colSpan={9} className="px-6 pb-4 pt-1">
                        {m.best?.maker && (
                          <span className="mb-2 block text-[13px] text-muted-2">
                            Лучшая цена:{" "}
                            <b className="uppercase text-fg">{m.best.maker}</b>
                            {m.best.country && ` · ${m.best.country}`}
                            {m.index != null && (
                              <> · в среднем дороже лучшей на{" "}
                                {formatPct(m.index)}</>
                            )}
                          </span>
                        )}
                        <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
                          <NestedList
                            title={`${target ? "Страны заводов" : "Рынки"}`
                              + ` · ${NESTED_LEGEND}`}
                            rows={countryRows(m.links)}
                            label={(r) => (
                              <CountryLabel
                                c={{ code: r.key, name: nameOf(m.links, r.key) }}
                                mode={mode}
                              />
                            )}
                            to={(r) => listUrl("countries", {
                              ...own, [key]: r.key,
                            })}
                          />
                          <NestedList
                            title={`Заводы · ${NESTED_LEGEND}`}
                            rows={makerRows(m.makers)}
                            label={(r) => (
                              <span className="uppercase">{r.key}</span>
                            )}
                            to={(r) => listUrl("countries", {
                              ...own, maker: r.key,
                            })}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShowAll
        shown={rows.length}
        total={d.molecules.length}
        all={all}
        onToggle={() => setAll(!all)}
      />
    </section>
  );
}

function nameOf(rows: CountryBrief[], code: string): string {
  return rows.find((r) => r.code === code)?.name ?? code;
}

export function StopsCard({ d }: { d: CountryDetail }) {
  const { listUrl } = useVpcLinks();
  const [open, setOpen] = useState<string | null>(null);
  const scope = countryScope(d);
  const key = otherKey(d);
  const mode = otherMode(d);
  if (d.stops.total === 0) return null;
  const max = Math.max(1, ...d.stops.reasons.map((r) => r.count));
  return (
    <SectionCard
      title="Почему остановили"
      note={`${formatInt(d.stops.total)} в стопе · причина по последнему`
        + " комментарию · строка раскрывает МНН и страны"}
    >
      <div className="flex flex-col">
        {d.stops.reasons.map((r) => {
          const on = open === r.key;
          return (
            <div key={r.key} className="border-t border-line">
              <button
                type="button"
                onClick={() => setOpen(on ? null : r.key)}
                aria-expanded={on}
                className="tr-soft grid w-full grid-cols-[18px_minmax(0,220px)_minmax(0,1fr)_40px_48px] items-center gap-3 border-0 bg-transparent px-1 py-2.5 text-left text-sm text-fg hover:bg-subtle"
              >
                <Chevron open={on} />
                <span className="truncate font-medium">{r.label}</span>
                <span className="h-1.5 rounded-full bg-track">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(r.count / max) * 100}%`,
                      background: "var(--color-muted-2)",
                    }}
                  />
                </span>
                <b className="text-right tabular-nums">{formatInt(r.count)}</b>
                <span className="text-right text-xs tabular-nums text-muted-2">
                  {formatPct(r.share)}
                </span>
              </button>
              {on && (
                <div className="grid grid-cols-2 gap-6 rounded-xl bg-subtle px-4 py-3 max-lg:grid-cols-1">
                  <NestedList
                    title="МНН · в стопе"
                    rows={mnnRows(r.mnn)}
                    label={(x) => x.key}
                    to={(x) => listUrl("countries", {
                      ...scope, mnn: x.key, state: "stop",
                    })}
                  />
                  <NestedList
                    title={d.mode === "target"
                      ? "Страны заводов · в стопе"
                      : "Рынки · в стопе"}
                    rows={countryRows(r.links)}
                    label={(x) => (
                      <CountryLabel
                        c={{ code: x.key, name: nameOf(r.links, x.key) }}
                        mode={mode}
                      />
                    )}
                    to={(x) => listUrl("countries", {
                      ...scope, [key]: x.key, state: "stop",
                    })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
