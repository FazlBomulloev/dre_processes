import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import clsx from "clsx";
import { getCountries, getFactories, getFactory } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { CountryCode } from "../components/vpc/chips";
import { Legend } from "../components/vpc/charts";
import { FilterPill } from "../components/vpc/FilterPill";
import {
  IndexBadge, KpiCard, Pill, SectionCard, Seg, StateStrip,
} from "../components/vpc/insight";
import { VpcGate } from "../components/vpc/VpcGate";
import { useVpcLinks, useVpcScope } from "../hooks/useVpcScope";
import { useFetch } from "../hooks/useFetch";
import { formatDate, formatInt } from "../lib/format";
import {
  PERIODS, STATE_COLORS, STATE_LABELS, STATE_ORDER, formatDays, formatPct,
  formatSigned, makerStripe, plural,
} from "../lib/vpc";
import type { FactoriesResponse, FactoryRow, Period } from "../types/vpc";

const TOP_ROWS = 10;
const MAP_LABELS = 10;

type SortKey = "offers" | "mnn" | "index" | "contracts";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "offers", label: "Предл." },
  { key: "mnn", label: "МНН" },
  { key: "index", label: "Индекс" },
  { key: "contracts", label: "Контракты" },
];

export default function VpcFactoriesPage() {
  return (
    <VpcGate title="Заводы">
      <Factories />
    </VpcGate>
  );
}

function Factories() {
  const { market } = useVpcScope();
  const [search, setSearch] = useSearchParams();
  const period = (search.get("period") || "all") as Period;
  const target = market ?? search.get("target") ?? "";
  const picked = search.get("maker");

  const set = (key: string, value: string | null) => setSearch((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: key === "maker" });

  const data = useFetch(
    (signal) => getFactories(
      {
        period, sort: "offers", limit: "2000",
        ...(target ? { target } : {}),
      },
      signal,
    ),
    [period, target],
    "Не удалось загрузить заводы",
  );
  const countries = useFetch(
    (signal) => market
      ? Promise.resolve(null)
      : getCountries({ mode: "target" }, signal),
    [market],
  );
  const options = countries.data?.tiles.map((t) => ({
    value: t.code, count: t.offers,
  }));
  const d = data.data;
  const selected = picked
    && d?.rating.some((m) => m.maker === picked)
    ? picked : d?.rating[0]?.maker ?? null;

  return (
    <Page maxWidth={1440} dim={data.loading && !!data.data}>
      <PageHeader
        title="Заводы"
        subtitle="Кто предлагает, насколько дёшево и как далеко доходит"
      >
        {!market && (
          <span className="rounded-full bg-surface p-[3px]">
            <FilterPill
              label="Для страны"
              value={target}
              options={options}
              onChange={(v) => set("target", v)}
            />
          </span>
        )}
        <Seg
          label="Период"
          options={PERIODS}
          value={period}
          onChange={(v) => set("period", v === "all" ? null : v)}
        />
      </PageHeader>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && (
        <div
          className={clsx(
            "tr-soft flex flex-col gap-5",
            data.loading && "opacity-60",
          )}
        >
          <Kpis d={d} />
          <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-xl:grid-cols-1">
            <FactoryMap
              rows={d.rating}
              selected={selected}
              onPick={(m) => set("maker", m)}
            />
            {selected && <Profile maker={selected} target={target} />}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-xl:grid-cols-1">
            <Rating
              rows={d.rating}
              selected={selected}
              onPick={(m) => set("maker", m)}
            />
            <CountryPrices rows={d.by_country} />
          </div>
        </div>
      )}
    </Page>
  );
}

function Kpis({ d }: { d: FactoriesResponse }) {
  const k = d.kpi;
  const best = d.rating
    .filter((m) => m.index != null)
    .reduce<FactoryRow | null>(
      (a, m) => (a == null || (m.index ?? 0) < (a.index ?? 0) ? m : a),
      null,
    );
  return (
    <section
      aria-label="Главные цифры"
      className="grid grid-cols-5 gap-3.5 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1"
    >
      <KpiCard
        index={0}
        label="Заводов в выгрузке"
        value={formatInt(k.makers)}
        badge={(
          <Pill>
            из {k.maker_countries}{" "}
            {plural(k.maker_countries, "страны", "стран", "стран")}
          </Pill>
        )}
        progress={100}
        note={`новых за ${k.new_days} дн. — ${formatInt(k.new)}`}
      />
      <KpiCard
        index={1}
        label="Активны сейчас"
        value={formatInt(k.active)}
        badge={<Pill>{formatPct(k.active_pct)}</Pill>}
        progress={k.active_pct}
        note="есть предложение в работе"
      />
      <KpiCard
        index={2}
        label="Дошли до контракта"
        value={formatInt(k.contract_makers)}
        badge={<Pill tone="good">{formatPct(k.contract_pct)}</Pill>}
        progress={k.contract_pct}
        note="хотя бы по одному продукту"
      />
      <KpiCard
        index={3}
        label="В среднем до контракта"
        value={formatDays(k.avg_to_contract)}
        note="от первого запроса до подписания"
      />
      <KpiCard
        index={4}
        label="Лучший индекс"
        value={best ? formatSigned(best.index) : "—"}
        badge={best && <Pill tone="good">{best.maker}</Pill>}
        progress={best?.index ?? null}
        note="самый дешёвый в среднем завод"
      />
    </section>
  );
}

function domain(values: number[], pad: number): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const extra = Math.max((hi - lo) * pad, 1);
  return [Math.floor(lo - extra), Math.ceil(hi + extra)];
}

function ticks([lo, hi]: [number, number]): number[] {
  return [0, 1, 2, 3].map((i) => Math.round(lo + ((hi - lo) / 3) * i));
}

function FactoryMap({
  rows, selected, onPick,
}: {
  rows: FactoryRow[];
  selected: string | null;
  onPick: (maker: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const priced = rows.filter((m) => m.index != null);
  if (priced.length < 2) {
    return (
      <SectionCard title="Карта заводов: активность × цена">
        <span className="text-sm text-faint">
          Недостаточно цен, чтобы сравнить заводы
        </span>
      </SectionCard>
    );
  }
  const xs = domain(priced.map((m) => m.index ?? 0), 0.12);
  const ys = domain(priced.map((m) => m.offers), 0.22);
  const avgX = priced.reduce((s, m) => s + (m.index ?? 0), 0) / priced.length;
  const avgY = priced.reduce((s, m) => s + m.offers, 0) / priced.length;
  const maxC = Math.max(1, ...priced.map((m) => m.contracts));
  const px = (v: number) => ((v - xs[0]) / (xs[1] - xs[0])) * 100;
  const py = (v: number) => ((v - ys[0]) / (ys[1] - ys[0])) * 100;
  const placed: { x: number; y: number }[] = [];
  const labeled = new Set<string>();
  for (const m of [...priced].sort((a, b) => b.offers - a.offers)) {
    const x = px(m.index ?? 0);
    const y = py(m.offers);
    const near = placed.some((q) => Math.abs(q.x - x) < 10
      && Math.abs(q.y - y) < 9);
    if (!near && labeled.size < MAP_LABELS) {
      labeled.add(m.maker);
      placed.push({ x, y });
    }
  }
  const shown = hover ?? null;
  return (
    <SectionCard
      title="Карта заводов: активность × цена"
      note="по горизонтали — ценовой индекс (левее — дешевле), по вертикали — предложений, размер — контракты · клик — профиль"
      right={(
        <span className="flex gap-3 text-xs text-muted-2">
          <Legend color="var(--color-st-result)" label="активные и дешёвые" />
          <Legend color="var(--color-accent-bar)" label="остальные" />
        </span>
      )}
    >
      <div className="grid grid-cols-[32px_minmax(0,1fr)] grid-rows-[340px_auto] gap-1.5">
        <div className="flex flex-col-reverse justify-between py-0.5 text-right text-[11px] tabular-nums text-muted-2">
          {ticks(ys).map((t) => <span key={t}>{t}</span>)}
        </div>
        <div
          className="relative border-b border-l border-line-strong"
          onMouseLeave={() => setHover(null)}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 border-l border-dashed border-line-strong"
            style={{ left: `${px(avgX)}%` }}
          />
          <span
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-line-strong"
            style={{ bottom: `${py(avgY)}%` }}
          />
          <Quadrant className="left-2.5 top-2.5 text-pos">
            Активные и дешёвые
          </Quadrant>
          <Quadrant className="right-2.5 top-2.5 text-warn-ink">
            Активные, но дорогие
          </Quadrant>
          <Quadrant className="bottom-2.5 left-2.5 text-muted-2">
            Дешёвые, мало предложений
          </Quadrant>
          <Quadrant className="bottom-2.5 right-2.5 text-bad-ink">
            Дорогие и редкие
          </Quadrant>
          {priced.map((m) => {
            const cheap = (m.index ?? 0) <= avgX;
            const busy = m.offers >= avgY;
            const size = 10 + (m.contracts / maxC) * 22;
            const on = m.maker === selected;
            const info = `${m.maker}: ${m.offers} предложений, индекс ${formatSigned(m.index)}, контрактов ${m.contracts}`;
            return (
              <button
                key={m.maker}
                type="button"
                aria-label={info}
                onClick={() => onPick(m.maker)}
                onMouseEnter={() => setHover(m.maker)}
                onFocus={() => setHover(m.maker)}
                onBlur={() => setHover(null)}
                className={clsx(
                  "absolute flex -translate-x-1/2 translate-y-1/2 flex-col items-center gap-[3px] border-0 bg-transparent p-0",
                  (on || shown === m.maker) && "z-10",
                )}
                style={{
                  left: `${px(m.index ?? 0)}%`,
                  bottom: `${py(m.offers)}%`,
                }}
              >
                <span
                  className="rounded-full border-2 border-white"
                  style={{
                    width: size,
                    height: size,
                    background: cheap && busy
                      ? "var(--color-st-result)"
                      : "var(--color-accent-bar)",
                    opacity: cheap && busy ? 1 : 0.75,
                    boxShadow: on
                      ? "0 0 0 2.5px var(--color-fg)"
                      : "0 0 0 1.5px var(--color-line-strong)",
                  }}
                />
                {(labeled.has(m.maker) || on) && shown !== m.maker && (
                  <span className="whitespace-nowrap rounded bg-white/85 px-1 text-[11px] font-semibold text-fg">
                    {m.maker}
                  </span>
                )}
                {shown === m.maker && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full mb-2 w-max max-w-[220px] rounded-lg bg-fg px-3 py-2 text-left text-xs text-white shadow-pop"
                  >
                    <b className="block text-[13px]">{m.maker}</b>
                    {m.offers} {plural(m.offers, "предложение", "предложения", "предложений")}
                    {" · "}индекс {formatSigned(m.index)}
                    {" · "}{m.contracts} контр.
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span />
        <div className="flex justify-between text-[11px] tabular-nums text-muted-2">
          {ticks(xs).map((t) => <span key={t}>{formatSigned(t)}</span>)}
        </div>
      </div>
      {rows.length > priced.length && (
        <span className="text-xs text-muted-2">
          Без цены для сравнения: {rows.length - priced.length}{" "}
          {plural(rows.length - priced.length, "завод", "завода", "заводов")}
        </span>
      )}
    </SectionCard>
  );
}

function Quadrant({
  className, children,
}: {
  className: string;
  children: string;
}) {
  return (
    <span
      className={clsx(
        "pointer-events-none absolute text-[11px] font-semibold uppercase tracking-[0.05em] max-md:hidden",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Profile({ maker, target }: { maker: string; target: string }) {
  const { factoryUrl } = useVpcLinks();
  const profile = useFetch(
    (signal) => getFactory(maker, target || null, signal),
    [maker, target],
    "Не удалось загрузить профиль",
  );
  const p = profile.loading ? null : profile.data;
  const states = p
    ? STATE_ORDER.filter((s) => (p.states[s] ?? 0) > 0)
    : [];
  const targets = p
    ? [...new Set(p.products.map((r) => r.target_country).filter(Boolean))]
      .sort()
    : [];
  return (
    <section className="anim-rise flex min-w-0 flex-col gap-4 rounded-card bg-ink px-6 py-6 text-white">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink-fg-2">Профиль завода</span>
        <Link
          to={factoryUrl(maker)}
          className="tr-soft flex items-center gap-1 rounded-full bg-ink-glass px-3 py-1.5 text-xs font-semibold text-white hover:bg-[oklch(1_0_0/0.14)] hover:text-white"
        >
          Открыть <ArrowRight size={13} />
        </Link>
      </div>
      {profile.error && <ErrorNote>{profile.error}</ErrorNote>}
      {!p && !profile.error && <Loading className="py-8 text-ink-fg-2" />}
      {p && (
        <>
          <div className="flex flex-col gap-1">
            <span className="break-words text-[30px] font-semibold uppercase leading-tight tracking-[-0.02em]">
              {p.maker}
            </span>
            <span className="text-[13px] text-ink-fg-2">
              {[
                p.country,
                `${formatInt(p.mnn)} МНН`,
                targets.length ? `ищем для ${targets.join(", ")}` : null,
              ].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Mini label="Предложений" value={formatInt(p.offers)} />
            <Mini
              label="Индекс"
              value={formatSigned(p.index)}
              color="var(--color-pos-on-ink)"
            />
            <Mini label="Контрактов" value={formatInt(p.contracts)} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-ink-fg-2">
              Состояние {formatInt(p.offers)}{" "}
              {plural(p.offers, "предложения", "предложений", "предложений")}
            </span>
            <div className="flex h-[26px] gap-[3px]">
              {states.map((s) => (
                <span
                  key={s}
                  title={`${STATE_LABELS[s]}: ${p.states[s]}`}
                  className="flex min-w-[22px] items-center rounded-md px-2 text-xs font-semibold text-fg"
                  style={{
                    flexGrow: p.states[s],
                    flexBasis: 0,
                    background: STATE_COLORS[s],
                  }}
                >
                  {p.states[s]}
                </span>
              ))}
            </div>
            <span className="text-xs text-ink-fg-2">
              {states.map((s) => STATE_LABELS[s].toLowerCase()).join(" · ")}
            </span>
          </div>
          {p.events.length > 0 && (
            <div className="flex flex-col gap-2 rounded-inner bg-ink-glass p-3.5">
              <span className="text-xs text-ink-fg-2">Последние события</span>
              {p.events.slice(0, 4).map((e) => (
                <span
                  key={`${e.offer_id}:${e.date}:${e.title}`}
                  className="flex justify-between gap-3 text-[13px]"
                >
                  <span className="truncate">{e.title}</span>
                  <span className="shrink-0 tabular-nums text-ink-fg-2">
                    {formatDate(e.date).slice(0, 5)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Mini({
  label, value, color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-fg-2">{label}</span>
      <b
        className="text-2xl font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </b>
    </div>
  );
}

function Rating({
  rows, selected, onPick,
}: {
  rows: FactoryRow[];
  selected: string | null;
  onPick: (maker: string) => void;
}) {
  const { factoryUrl } = useVpcLinks();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "offers", desc: true,
  });
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows.filter((m) => !needle
      || m.maker.toLowerCase().includes(needle)
      || (m.country ?? "").toLowerCase().includes(needle));
    const value = (m: FactoryRow) => m[sort.key] ?? Infinity;
    return [...list].sort((a, b) => {
      const diff = value(a) - value(b);
      return (sort.desc ? -diff : diff) || b.offers - a.offers;
    });
  }, [rows, query, sort]);
  const visible = all || query ? sorted : sorted.slice(0, TOP_ROWS);
  const toggle = (key: SortKey) => setSort((s) => (
    s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "index" }
  ));
  return (
    <section className="anim-rise flex min-w-0 flex-col gap-3 rounded-card bg-surface pb-3 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 max-md:px-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[19px] font-semibold tracking-[-0.01em]">
            Рейтинг заводов
          </span>
          <span className="text-[13px] text-faint">
            клик по заголовку — сортировка · индекс — насколько в среднем дороже лучшей цены по тем же продуктам
          </span>
        </div>
        <label className="flex h-[38px] w-[240px] items-center gap-2 rounded-xl bg-canvas px-3.5 max-md:w-full">
          <Search size={14} className="shrink-0 text-muted-2" />
          <input
            aria-label="Найти завод"
            placeholder="Найти завод"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-subtle text-left text-xs text-muted-2">
              <th className="w-7 py-2.5 pl-6 pr-3 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Завод</th>
              {COLUMNS.slice(0, 2).map((c) => (
                <SortHead key={c.key} c={c} sort={sort} onSort={toggle} />
              ))}
              <th className="px-3 py-2.5 font-medium">Для стран</th>
              <th className="w-[150px] px-3 py-2.5 font-medium">Состояние</th>
              {COLUMNS.slice(2).map((c) => (
                <SortHead key={c.key} c={c} sort={sort} onSort={toggle} />
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m, i) => (
              <tr
                key={m.maker}
                onClick={() => onPick(m.maker)}
                className={clsx(
                  "tr-soft cursor-pointer border-t border-line hover:bg-subtle",
                  m.maker === selected && "bg-accent-tint",
                )}
              >
                <td className="py-2.5 pl-6 pr-3 text-xs tabular-nums text-muted-2">
                  {i + 1}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <span
                      className="h-7 w-[3px] shrink-0 rounded-full"
                      style={{ background: makerStripe(m.country) }}
                    />
                    <span className="flex min-w-0 max-w-[220px] flex-col leading-tight">
                      <Link
                        to={factoryUrl(m.maker)}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate font-semibold uppercase text-fg hover:text-accent"
                      >
                        {m.maker}
                      </Link>
                      <span className="truncate text-xs text-muted-2">
                        {m.country ?? "—"}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {formatInt(m.offers)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatInt(m.mnn)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex max-w-[170px] flex-wrap gap-1">
                    {m.targets.slice(0, 5).map((t) => (
                      <CountryCode key={t} code={t} />
                    ))}
                    {m.targets.length > 5 && (
                      <span className="text-xs text-faint">
                        +{m.targets.length - 5}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <StateStrip states={m.states} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <IndexBadge value={m.index} />
                </td>
                <td className="py-2.5 pl-3 pr-6">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                      <span
                        className="block h-full rounded-full bg-st-result"
                        style={{ width: `${(m.contracts / m.offers) * 100}%` }}
                      />
                    </span>
                    <span className="w-14 text-right text-xs tabular-nums">
                      {m.contracts} из {m.offers}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && (
        <span className="px-6 text-sm text-faint">Ничего не нашлось</span>
      )}
      <span className="px-6 pb-1 pt-1 text-[13px] text-muted-2 max-md:px-4">
        Показаны {formatInt(visible.length)} из {formatInt(sorted.length)}
        {sorted.length > visible.length && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setAll(true)}
              className="border-0 bg-transparent p-0 font-medium text-accent hover:text-accent-hover"
            >
              показать все
            </button>
          </>
        )}
      </span>
    </section>
  );
}

function SortHead({
  c, sort, onSort,
}: {
  c: { key: SortKey; label: string };
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  const on = sort.key === c.key;
  return (
    <th
      className={clsx(
        "px-3 py-2.5 text-right font-medium",
        c.key === "contracts" && "w-[150px] pr-6",
      )}
      aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(c.key)}
        className={clsx(
          "border-0 bg-transparent p-0 text-xs font-medium",
          on ? "text-fg" : "text-muted-2 hover:text-fg",
        )}
      >
        {c.label} {on ? (sort.desc ? "↓" : "↑") : "↕"}
      </button>
    </th>
  );
}

function CountryPrices({
  rows,
}: {
  rows: FactoriesResponse["by_country"];
}) {
  const priced = rows.filter((r) => r.index != null);
  if (priced.length === 0) {
    return (
      <SectionCard title="Цена по стране завода">
        <span className="text-sm text-faint">
          Недостаточно цен для сравнения
        </span>
      </SectionCard>
    );
  }
  const max = Math.max(1, ...priced.map((r) => r.index ?? 0));
  const avg = priced.reduce((s, r) => s + (r.index ?? 0), 0) / priced.length;
  const cheap = priced[0];
  const dear = priced[priced.length - 1];
  return (
    <SectionCard
      title="Цена по стране завода"
      note="в среднем насколько дороже лучшей цены · меньше — выгоднее"
    >
      <div className="flex flex-col gap-3">
        {priced.map((r) => {
          const v = r.index ?? 0;
          const tone = v < avg * 0.9
            ? "var(--color-st-result)"
            : v > avg * 1.1 ? "var(--color-bad)" : "var(--color-accent-soft)";
          return (
            <div
              key={r.country}
              title={`${r.country}: ${formatSigned(r.index)}, ${r.offers} предложений`}
              className="grid grid-cols-[96px_minmax(0,1fr)_52px] items-center gap-2.5 text-sm"
            >
              <span className="truncate">{r.country}</span>
              <span className="h-2.5 rounded-full bg-track">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(v / max) * 100}%`, background: tone }}
                />
              </span>
              <b className="text-right text-[13px] font-semibold tabular-nums">
                {formatSigned(r.index)}
              </b>
            </div>
          );
        })}
      </div>
      {priced.length > 1 && cheap !== dear && (
        <span className="mt-auto border-t border-line pt-3 text-xs leading-relaxed text-muted-2">
          <b className="text-fg">{cheap.country}</b> в среднем на{" "}
          {formatInt(Math.round((dear.index ?? 0) - (cheap.index ?? 0)))}{" "}
          п.п. выгоднее, чем <b className="text-fg">{dear.country}</b>.
        </span>
      )}
    </SectionCard>
  );
}
