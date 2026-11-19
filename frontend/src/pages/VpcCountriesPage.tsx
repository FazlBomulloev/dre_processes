import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import clsx from "clsx";
import { getCountries } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { Legend } from "../components/vpc/charts";
import { CountryPanel } from "../components/vpc/CountryPanel";
import { CountryCode } from "../components/vpc/chips";
import {
  IndexBadge, SectionCard, Seg, StateStrip,
} from "../components/vpc/insight";
import { VpcGate } from "../components/vpc/VpcGate";
import { useFetch } from "../hooks/useFetch";
import { formatInt } from "../lib/format";
import { useVpcLinks, useVpcScope } from "../hooks/useVpcScope";
import {
  STATE_COLORS, STATE_LABELS, formatPct, makerStripe, plural,
  pluralOffers,
} from "../lib/vpc";
import type { CountriesResponse, CountryMode } from "../types/vpc";

const TOP_ROWS = 10;

const MODES = [
  { value: "target", label: "Для какой страны ищем" },
  { value: "maker", label: "Страна завода" },
] as const;

export default function VpcCountriesPage() {
  return (
    <VpcGate title="Страны">
      <Countries />
    </VpcGate>
  );
}

function Countries() {
  const { market } = useVpcScope();
  const [search, setSearch] = useSearchParams();
  const mode = (market ? "maker" : search.get("mode") || "target") as
    CountryMode;
  const data = useFetch(
    (signal) => getCountries(
      market ? { mode, target: market } : { mode }, signal,
    ),
    [mode, market],
    "Не удалось загрузить страны",
  );
  const d = data.data;
  const picked = search.get("country");
  const pickedMode = (market ? "maker" : search.get("cmode") || mode) as
    CountryMode;
  const pick = (code: string | null, next: CountryMode = mode) => {
    const params = new URLSearchParams(search);
    params.delete("country");
    params.delete("cmode");
    if (code) {
      params.set("country", code);
      if (next !== mode) params.set("cmode", next);
    }
    setSearch(params, { replace: true });
  };

  return (
    <Page maxWidth={1440} dim={data.loading && !!data.data}>
      <PageHeader
        title="Страны"
        subtitle={market
          ? "Из каких стран заводы предлагают для рынка"
          : "Для каких рынков ищем и как по ним идёт работа"}
      >
        {!market && (
          <Seg
            label="Разрез"
            options={MODES}
            value={mode}
            onChange={(v) => setSearch(v === "target" ? {} : { mode: v })}
          />
        )}
      </PageHeader>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && (
        <>
          <Markets data={d} onPick={(code) => pick(code)} />
          <Heatmap data={d} />
          {mode === "target" && <Origin rows={d.origin} />}
        </>
      )}
      {picked && (
        <CountryPanel
          code={picked}
          mode={pickedMode}
          onPick={market ? null : (code, next) => pick(code, next)}
          onClose={() => pick(null)}
        />
      )}
    </Page>
  );
}

type MarketSort = "offers" | "products" | "contracts" | "conversion";

const MARKET_COLUMNS: { key: MarketSort; label: string }[] = [
  { key: "offers", label: "Предложения" },
  { key: "products", label: "Продукты" },
  { key: "contracts", label: "Контракты" },
  { key: "conversion", label: "Конверсия" },
];

function Markets({
  data, onPick,
}: {
  data: CountriesResponse;
  onPick: (code: string) => void;
}) {
  const { countryUrl } = useVpcLinks();
  const [sort, setSort] = useState<{ key: MarketSort; desc: boolean }>({
    key: "offers", desc: true,
  });
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const tiles = data.tiles;
  const total = tiles.reduce((s, t) => s + t.offers, 0);
  const signed = tiles.reduce((s, t) => s + t.contracts, 0);
  const average = total ? (signed / total) * 100 : null;
  const max = Math.max(1, ...tiles.map((t) => t.offers));
  const sorted = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = tiles.filter((t) => !needle
      || t.name.toLowerCase().includes(needle)
      || t.code.toLowerCase().includes(needle));
    return list.sort((a, b) => {
      const diff = (a[sort.key] ?? -1) - (b[sort.key] ?? -1);
      return (sort.desc ? -diff : diff) || b.offers - a.offers;
    });
  }, [tiles, query, sort]);
  const rows = all || query ? sorted : sorted.slice(0, TOP_ROWS);
  const rest = sorted.slice(rows.length);
  const above = tiles.filter((t) => average != null
    && t.offers >= 5 && (t.conversion ?? 0) > average);
  const below = tiles.filter((t) => average != null
    && t.offers >= 5 && (t.conversion ?? 0) < average * 0.75);
  const target = data.mode === "target";
  return (
    <section className="anim-rise flex min-w-0 flex-col gap-3 rounded-card bg-surface pb-3 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 max-md:px-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[19px] font-semibold tracking-[-0.01em]">
            {target ? "Рынки" : "Страны заводов"}
          </span>
          <span className="text-[13px] text-faint">
            {formatInt(tiles.length)}{" "}
            {plural(tiles.length, "страна", "страны", "стран")}
            {target ? " поиска" : ""} · строка — краткий обзор, название —
            полный · клик по
            заголовку — сортировка
          </span>
        </div>
        <span className="flex flex-wrap items-center gap-3.5 text-xs text-muted-2">
          {["work", "contract", "result"].map((s) => (
            <Legend
              key={s}
              color={STATE_COLORS[s]}
              label={STATE_LABELS[s].toLowerCase()}
            />
          ))}
          <label className="flex h-[38px] w-[220px] items-center gap-2 rounded-xl bg-canvas px-3.5 max-md:w-full">
            <Search size={14} className="shrink-0 text-muted-2" />
            <input
              aria-label="Найти страну"
              placeholder="Найти страну"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-fg outline-none"
            />
          </label>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-subtle text-left text-xs text-muted-2">
              <th className="py-2.5 pl-6 pr-3 font-medium">Страна</th>
              {MARKET_COLUMNS.slice(0, 2).map((c) => (
                <MarketHead key={c.key} c={c} sort={sort} onSort={setSort} />
              ))}
              <th className="w-[200px] px-3 py-2.5 font-medium">Состояние</th>
              {MARKET_COLUMNS.slice(2).map((c) => (
                <MarketHead key={c.key} c={c} sort={sort} onSort={setSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const up = average != null && (t.conversion ?? 0) >= average;
              return (
                <tr
                  key={t.code}
                  onClick={() => onPick(t.code)}
                  className="tr-soft cursor-pointer border-t border-line hover:bg-subtle"
                >
                  <td className="py-3 pl-6 pr-3">
                    <Link
                      to={countryUrl(t.code, data.mode)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2.5 font-semibold text-fg hover:text-accent"
                    >
                      {target ? (
                        <CountryCode code={t.code} />
                      ) : (
                        <span
                          className="h-4 w-[3px] rounded-full"
                          style={{ background: makerStripe(t.code) }}
                        />
                      )}
                      <span className="max-w-[180px] truncate">{t.name}</span>
                    </Link>
                  </td>
                  <td className="w-[260px] px-3 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2 flex-1 rounded-full bg-track">
                        <span
                          className="block h-full rounded-full bg-accent-bar"
                          style={{ width: `${(t.offers / max) * 100}%` }}
                        />
                      </span>
                      <b className="w-8 text-right font-semibold tabular-nums">
                        {formatInt(t.offers)}
                      </b>
                      <span className="w-10 text-xs tabular-nums text-muted-2">
                        {formatPct(total ? (t.offers / total) * 100 : null)}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatInt(t.products)}
                  </td>
                  <td className="px-3 py-3">
                    <StateStrip states={t.states} />
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-pos">
                    {formatInt(t.contracts)}
                  </td>
                  <td className="w-[170px] py-3 pl-3 pr-6">
                    <span className="flex items-center gap-2">
                      <span className="relative h-1.5 flex-1 rounded-full bg-track">
                        <span
                          className="block h-full rounded-full bg-st-result"
                          style={{ width: `${t.conversion ?? 0}%` }}
                        />
                        {average != null && (
                          <span
                            aria-hidden
                            className="absolute -inset-y-[3px] w-0.5 rounded bg-fg"
                            style={{ left: `${average}%` }}
                          />
                        )}
                      </span>
                      <span
                        className={clsx(
                          "w-12 text-right text-xs tabular-nums",
                          up ? "font-semibold text-pos" : "text-muted",
                        )}
                      >
                        {formatPct(t.conversion)}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
            {rest.length > 0 && (
              <RestRow
                colSpan={6}
                onClick={() => setAll(true)}
                label={`Остальные ${formatInt(rest.length)} ${
                  plural(rest.length, "страна", "страны", "стран")}`}
                detail={`${formatInt(sum(rest, (t) => t.offers))} ${
                  pluralOffers(sum(rest, (t) => t.offers))} · ${
                  formatInt(sum(rest, (t) => t.contracts))} ${
                  plural(sum(rest, (t) => t.contracts),
                    "контракт", "контракта", "контрактов")}`}
                action="показать"
              />
            )}
            {all && !query && sorted.length > TOP_ROWS && (
              <RestRow
                colSpan={6}
                onClick={() => setAll(false)}
                label={`Показаны все ${formatInt(sorted.length)}`}
                action="свернуть"
              />
            )}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <span className="px-6 text-sm text-faint max-md:px-4">
          Ничего не нашлось
        </span>
      )}
      {average != null && (
        <span className="px-6 pb-1 pt-1 text-xs leading-relaxed text-muted-2 max-md:px-4">
          Чёрная метка в конверсии — среднее по всем{" "}
          {target ? "рынкам" : "странам"}{" "}
          <b className="text-fg">{formatPct(average)}</b>.
          {above.length > 0 && (
            <> Выше среднего: {above.map((t) => t.name).join(", ")}.</>
          )}
          {below.length > 0 && (
            <> Заметно ниже: {below.map((t) => t.name).join(", ")}.</>
          )}
        </span>
      )}
    </section>
  );
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0);
}

function RestRow({
  colSpan, onClick, label, detail, action,
}: {
  colSpan: number;
  onClick: () => void;
  label: string;
  detail?: string;
  action: string;
}) {
  return (
    <tr
      onClick={onClick}
      className="tr-soft cursor-pointer border-t border-line hover:bg-subtle"
    >
      <td colSpan={colSpan} className="py-3 pl-6 pr-6">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="font-semibold text-fg">{label}</span>
          {detail && <span className="text-muted-2">{detail}</span>}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="ml-auto border-0 bg-transparent p-0 font-medium text-accent hover:text-accent-hover"
          >
            {action}
          </button>
        </span>
      </td>
    </tr>
  );
}

function MarketHead({
  c, sort, onSort,
}: {
  c: { key: MarketSort; label: string };
  sort: { key: MarketSort; desc: boolean };
  onSort: (sort: { key: MarketSort; desc: boolean }) => void;
}) {
  const on = sort.key === c.key;
  return (
    <th
      className={clsx(
        "px-3 py-2.5 font-medium",
        (c.key === "products" || c.key === "contracts") && "text-right",
        c.key === "conversion" && "pr-6",
      )}
      aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort({ key: c.key, desc: on ? !sort.desc : true })}
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

const SHADES = [
  "oklch(0.96 0.02 268)",
  "oklch(0.88 0.05 268)",
  "oklch(0.76 0.09 268)",
  "oklch(0.62 0.13 268)",
  "oklch(0.48 0.15 268)",
  "oklch(0.38 0.14 268)",
];

function shade(value: number, max: number): string {
  if (!value || !max) return "var(--color-subtle)";
  const step = Math.ceil((value / max) * (SHADES.length - 1));
  return SHADES[Math.min(step, SHADES.length - 1)];
}

function Heatmap({ data }: { data: CountriesResponse }) {
  const { countryUrl, listUrl } = useVpcLinks();
  const [hover, setHover] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const max = Math.max(
    1, ...data.heat.flatMap((h) => Object.values(h.counts)),
  );
  const key = data.mode === "target" ? "target" : "maker_country";
  const rowTotal = (counts: Record<string, number>) => data.stages
    .reduce((s, st) => s + (counts[st.code] ?? 0), 0);
  const colTotals = data.stages.map((st) => data.heat
    .reduce((s, h) => s + (h.counts[st.code] ?? 0), 0));
  const grand = colTotals.reduce((a, b) => a + b, 0);
  const ranked = [...data.heat]
    .sort((a, b) => rowTotal(b.counts) - rowTotal(a.counts));
  const shown = all ? ranked : ranked.slice(0, TOP_ROWS);
  const rest = ranked.slice(shown.length);
  const restCounts = data.stages.map((st) => sum(
    rest, (h) => h.counts[st.code] ?? 0,
  ));
  const span = data.stages.length + 2;
  return (
    <SectionCard
      title="Где стоят предложения по странам"
      note="активные предложения на текущем этапе · темнее — больше · клик по ячейке открывает список"
      right={(
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-2">
          0
          {SHADES.slice(1).map((c) => (
            <span
              key={c}
              className="h-2.5 w-[22px] rounded-[3px]"
              style={{ background: c }}
            />
          ))}
          {formatInt(max)}
        </span>
      )}
    >
      <div className="max-xl:overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr className="text-xs text-muted-2">
              <th className="w-[190px] px-1.5 py-1 text-left font-medium">Страна</th>
              {data.stages.map((s) => (
                <th
                  key={s.code}
                  title={s.name}
                  className="px-1 py-1 font-mono font-semibold"
                >
                  {s.code}
                </th>
              ))}
              <th className="w-[70px] px-1.5 py-1 text-right font-medium">Итого</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const sum = rowTotal(row.counts);
              return (
                <tr key={row.code}>
                  <td className="whitespace-nowrap px-1.5 py-1">
                    <Link
                      to={countryUrl(row.code, data.mode)}
                      className="flex items-center gap-2 text-fg hover:text-accent"
                    >
                      {data.mode === "target" && <CountryCode code={row.code} />}
                      <span className="max-w-[140px] truncate">{row.name}</span>
                    </Link>
                  </td>
                  {data.stages.map((s) => {
                    const n = row.counts[s.code] ?? 0;
                    const dark = n / max > 0.45;
                    const id = `${row.code}:${s.code}`;
                    return (
                      <td key={s.code} className="relative p-0">
                        {n ? (
                          <Link
                            to={listUrl("countries", {
                              [key]: row.code, stage: s.code,
                            })}
                            aria-label={`${row.name} · ${s.name}: ${n}`}
                            onMouseEnter={() => setHover(id)}
                            onMouseLeave={() => setHover(null)}
                            onFocus={() => setHover(id)}
                            onBlur={() => setHover(null)}
                            className={clsx(
                              "tr-soft flex h-[38px] items-center justify-center rounded-lg font-mono text-[13px] hover:brightness-95",
                              dark ? "text-white hover:text-white" : "text-fg hover:text-fg",
                            )}
                            style={{ background: shade(n, max) }}
                          >
                            {formatInt(n)}
                          </Link>
                        ) : (
                          <span className="flex h-[38px] items-center justify-center rounded-lg bg-subtle text-xs text-faintest">
                            —
                          </span>
                        )}
                        {hover === id && (
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 flex w-[200px] -translate-x-1/2 flex-col gap-1 rounded-xl bg-fg px-3.5 py-3 text-xs text-white shadow-pop"
                          >
                            <b className="text-[13px]">{row.name} · {s.code}</b>
                            <span className="flex justify-between">
                              <span className="text-white/70">На этапе</span>
                              <b className="tabular-nums">{n}</b>
                            </span>
                            <span className="flex justify-between">
                              <span className="text-white/70">Доля страны</span>
                              <b className="tabular-nums">
                                {formatPct(sum ? (n / sum) * 100 : null)}
                              </b>
                            </span>
                            <span className="border-t border-white/15 pt-1 text-white/70">
                              клик — {n} {pluralOffers(n)}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1.5 py-1 text-right font-semibold tabular-nums">
                    {formatInt(sum)}
                  </td>
                </tr>
              );
            })}
            {rest.length > 0 && (
              <tr
                onClick={() => setAll(true)}
                className="cursor-pointer text-[13px] text-muted-2 hover:text-fg"
              >
                <td className="whitespace-nowrap px-1.5 py-1">
                  <span className="flex items-center gap-2">
                    Остальные {formatInt(rest.length)}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAll(true);
                      }}
                      className="border-0 bg-transparent p-0 text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      показать
                    </button>
                  </span>
                </td>
                {restCounts.map((n, i) => (
                  <td
                    key={data.stages[i].code}
                    className="px-1 py-1 text-center font-mono tabular-nums"
                  >
                    {n ? formatInt(n) : "—"}
                  </td>
                ))}
                <td className="px-1.5 py-1 text-right font-semibold tabular-nums">
                  {formatInt(sum(restCounts, (n) => n))}
                </td>
              </tr>
            )}
            {all && ranked.length > TOP_ROWS && (
              <tr>
                <td colSpan={span} className="px-1.5 py-1 text-[13px]">
                  <button
                    type="button"
                    onClick={() => setAll(false)}
                    className="border-0 bg-transparent p-0 font-medium text-accent hover:text-accent-hover"
                  >
                    свернуть до {TOP_ROWS}
                  </button>
                </td>
              </tr>
            )}
            <tr className="text-[13px]">
              <td className="border-t border-line-strong px-1.5 pb-1 pt-2 text-xs text-muted-2">
                Итого по этапу
              </td>
              {colTotals.map((t, i) => (
                <td
                  key={data.stages[i].code}
                  className="border-t border-line-strong px-1 pb-1 pt-2 text-center font-semibold tabular-nums"
                >
                  {formatInt(t)}
                </td>
              ))}
              <td className="border-t border-line-strong px-1.5 pb-1 pt-2 text-right font-semibold tabular-nums">
                {formatInt(grand)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function Origin({ rows }: { rows: CountriesResponse["origin"] }) {
  const { countryUrl } = useVpcLinks();
  const max = Math.max(1, ...rows.map((r) => r.offers));
  return (
    <SectionCard
      title="Откуда приходят предложения"
      note="страна завода · предложений · ценовой индекс заводов · контракты"
    >
      <div className="grid grid-cols-2 gap-x-10 max-lg:grid-cols-1">
        {rows.map((r) => (
          <Link
            key={r.country}
            to={countryUrl(r.country, "maker")}
            className="tr-soft grid grid-cols-[120px_minmax(0,1fr)_56px_64px_40px] items-center gap-3 border-b border-line px-1 py-3 text-sm text-fg hover:bg-subtle hover:text-fg"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-4 w-[3px] shrink-0 rounded-full"
                style={{ background: makerStripe(r.country) }}
              />
              <span className="truncate">{r.country}</span>
            </span>
            <span className="h-1.5 rounded-full bg-track">
              <span
                className="block h-full rounded-full bg-accent-bar"
                style={{ width: `${(r.offers / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-[13px]">
              {formatInt(r.offers)}
            </span>
            <span className="text-right">
              <IndexBadge value={r.index} />
            </span>
            <span className="text-right font-semibold text-pos">
              {formatInt(r.contracts)}
            </span>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}
