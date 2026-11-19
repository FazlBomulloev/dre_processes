import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { getCountries, getFunnel } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { Legend, MonthsChart } from "../components/vpc/charts";
import { FilterPill } from "../components/vpc/FilterPill";
import { SectionCard, Seg } from "../components/vpc/insight";
import { VpcGate } from "../components/vpc/VpcGate";
import { useVpcLinks, useVpcScope } from "../hooks/useVpcScope";
import { useFetch } from "../hooks/useFetch";
import { formatInt } from "../lib/format";
import {
  MONTHS, monthTitle, niceTop, stageChip, stageVar,
} from "../lib/charts";
import type { MonthPoint } from "../lib/charts";
import {
  PERIODS, REASON_COLORS, formatDays, formatPct, pluralOffers,
} from "../lib/vpc";
import type { FunnelResponse, FunnelStep, Period } from "../types/vpc";

const PERIOD_WORDS: Record<string, string> = {
  "3": "за 3 месяца",
  "6": "за 6 месяцев",
  "12": "за год",
  all: "за всё время",
};

export default function VpcFunnelPage() {
  return (
    <VpcGate title="Воронка и динамика">
      <Funnel />
    </VpcGate>
  );
}

function Funnel() {
  const { market } = useVpcScope();
  const [search, setSearch] = useSearchParams();
  const period = (search.get("period") || "12") as Period;
  const target = market ?? search.get("target") ?? "";

  const set = (key: string, value: string | null) => setSearch((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  });

  const data = useFetch(
    (signal) => getFunnel(
      target ? { period, target } : { period }, signal,
    ),
    [period, target],
    "Не удалось загрузить воронку",
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

  return (
    <Page maxWidth={1440} dim={data.loading && !!data.data}>
      <PageHeader
        title="Воронка и динамика"
        subtitle="Сколько доходит до контракта, где теряем и почему"
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
          onChange={(v) => set("period", v === "12" ? null : v)}
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
          <Band d={d} period={period} />
          <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-5 max-xl:grid-cols-1">
            <Steps steps={d.steps} target={target} />
            <Reasons reasons={d.reasons} period={period} target={target} />
          </div>
          <Durations steps={d.steps} target={target} />
          <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-5 max-xl:grid-cols-1">
            <MonthsChart months={d.months} />
            <NetFlow months={d.months} />
          </div>
        </div>
      )}
    </Page>
  );
}

function Band({ d, period }: { d: FunnelResponse; period: string }) {
  const tiles = [
    {
      label: "Вошли в воронку",
      value: formatInt(d.entered),
      note: PERIOD_WORDS[period],
      good: false,
    },
    {
      label: "Дошли до контракта",
      value: formatInt(d.contracts),
      note: `${formatPct(d.contract_pct)} от вошедших`,
      good: true,
    },
    {
      label: "Получено РУ",
      value: formatInt(d.registered),
      note: `${formatPct(d.registered_pct)} от вошедших`,
      good: true,
    },
    {
      label: "В среднем до контракта",
      value: formatDays(d.avg_to_contract),
      note: "от создания до даты «Кк»",
      good: false,
    },
  ];
  return (
    <section
      aria-label="Главные цифры воронки"
      className="anim-rise grid grid-cols-4 rounded-hero bg-ink p-2 text-white max-lg:grid-cols-2 max-sm:grid-cols-1"
    >
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={clsx(
            "flex flex-col gap-1.5 px-[22px] py-[18px]",
            i < tiles.length - 1 && "border-r border-white/10 max-lg:border-r-0",
          )}
        >
          <span className="text-[13px] text-ink-fg-2">{t.label}</span>
          <span className="text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            {t.value}
          </span>
          <span
            className={clsx(
              "text-[13px]",
              t.good ? "text-pos-on-ink" : "text-ink-fg-2",
            )}
          >
            {t.note}
          </span>
        </div>
      ))}
    </section>
  );
}

function Steps({ steps, target }: { steps: FunnelStep[]; target: string }) {
  const { listUrl } = useVpcLinks();
  const top = Math.max(1, steps[0]?.reached ?? 0);
  const losses = steps
    .map((s, i) => ({
      from: steps[i - 1]?.name, to: s.name,
      lost: i ? steps[i - 1].reached - s.reached : 0,
      prev: i ? steps[i - 1].reached : 0,
    }))
    .filter((l) => l.lost > 0)
    .sort((a, b) => b.lost - a.lost);
  const [first, second] = losses;
  const worst = new Set(losses.slice(0, 2).map((l) => l.to));
  return (
    <SectionCard
      title="Воронка по этапам"
      note="дошли до этапа · справа — сколько потеряли и конверсия из предыдущего · красным — две самые большие потери"
    >
      <div className="flex flex-col gap-1">
        {steps.map((s, i) => {
          const prev = i ? steps[i - 1].reached : null;
          const weak = worst.has(s.name);
          return (
            <Link
              key={s.code}
              to={listUrl("funnel", { stage: s.code, target })}
              title={`${s.name}: дошли ${s.reached}`}
              className="tr-soft -mx-2 grid grid-cols-[170px_minmax(0,1fr)_120px] items-center gap-4 rounded-lg px-2 py-0.5 text-fg hover:bg-canvas hover:text-fg max-md:grid-cols-[56px_minmax(0,1fr)_76px] max-md:gap-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <span
                  className={clsx(
                    "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
                    stageChip(s.code),
                  )}
                >
                  {s.code}
                </span>
                <span className="truncate max-md:hidden">{s.name}</span>
              </span>
              <span className="flex h-[38px] justify-center">
                <span
                  className="flex h-full items-center justify-center rounded-lg text-[15px] font-semibold tabular-nums text-white"
                  style={{
                    width: `${Math.max((s.reached / top) * 100, 12)}%`,
                    background: stageVar(s.code),
                  }}
                >
                  {formatInt(s.reached)}
                </span>
              </span>
              <span className="flex flex-col leading-tight">
                <b
                  className={clsx(
                    "text-[13px] font-semibold tabular-nums",
                    weak ? "text-bad-ink" : "text-fg",
                  )}
                >
                  {prev == null ? "вход" : `−${formatInt(prev - s.reached)}`}
                </b>
                <span className="text-xs tabular-nums text-muted-2">
                  {s.conversion == null
                    ? "100%"
                    : `${formatPct(s.conversion)} из пред.`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      {first && (
        <span className="border-t border-line pt-3 text-xs leading-relaxed text-muted-2">
          Больше всего теряем между <b className="text-fg">«{first.from}» и
          «{first.to}»</b>:{" "}
          {`−${formatInt(first.lost)} (−${formatPct((first.lost / first.prev) * 100)}).`}
          {second && (
            <> Вторая потеря — «{second.to}»: −{formatInt(second.lost)}.</>
          )}
          {" "}«Дошли» — было на этапе или дальше, включая остановленные позже.
        </span>
      )}
    </SectionCard>
  );
}

function Reasons({
  reasons, period, target,
}: {
  reasons: FunnelResponse["reasons"];
  period: string;
  target: string;
}) {
  const { listUrl } = useVpcLinks();
  const max = Math.max(1, ...reasons.items.map((r) => r.count));
  return (
    <SectionCard
      title="Почему останавливаем"
      note={`${formatInt(reasons.total)} остановок ${PERIOD_WORDS[period]}`
        + " · по последнему комментарию"}
    >
      {reasons.total === 0 ? (
        <span className="text-sm text-faint">Остановок нет</span>
      ) : (
        <>
          <div className="flex flex-col gap-3.5">
            {reasons.items.map((r) => (
              <Link
                key={r.key}
                to={listUrl("funnel", { tab: "stop", target })}
                title={`${r.label}: ${r.count}`}
                className="tr-soft flex flex-col gap-1.5 text-fg hover:text-fg"
              >
                <span className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{r.label}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    <b className="font-semibold">{formatInt(r.count)}</b>{" "}
                    <span className="text-xs text-muted-2">
                      {formatPct(r.pct)}
                    </span>
                  </span>
                </span>
                <span className="h-2.5 rounded-full bg-track">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(r.count / max) * 100}%`,
                      background: REASON_COLORS[r.key],
                    }}
                  />
                </span>
              </Link>
            ))}
          </div>
          <span className="mt-auto border-t border-line pt-3 text-xs text-muted-2">
            Клик по причине — список остановленных предложений.
          </span>
        </>
      )}
    </SectionCard>
  );
}

function Durations({
  steps, target,
}: {
  steps: FunnelStep[];
  target: string;
}) {
  const { listUrl } = useVpcLinks();
  const rows = steps.filter((s) => s.avg_days != null);
  if (rows.length === 0) return null;
  const top = niceTop(Math.max(...rows.map((s) => s.avg_days ?? 0)));
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const longest = rows.reduce((a, b) => (
    (b.avg_days ?? 0) > (a.avg_days ?? 0) ? b : a
  ));
  return (
    <SectionCard
      title="Сколько дней стоят на этапе"
      note="в среднем у предложений в работе, с момента перехода на этап"
    >
      <div className="flex flex-col gap-2.5">
        {rows.map((s) => (
          <Link
            key={s.code}
            to={listUrl("funnel", { stage: s.code, target })}
            title={`${s.name}: в среднем ${formatDays(s.avg_days)}`}
            className="tr-soft -mx-2 grid grid-cols-[190px_minmax(0,1fr)_80px] items-center gap-4 rounded-lg px-2 py-0.5 text-fg hover:bg-canvas hover:text-fg max-md:grid-cols-[56px_minmax(0,1fr)_64px] max-md:gap-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-[13px]">
              <span
                className={clsx(
                  "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
                  stageChip(s.code),
                )}
              >
                {s.code}
              </span>
              <span className="truncate max-md:hidden">{s.name}</span>
            </span>
            <span className="relative h-[18px] rounded-[5px] bg-canvas">
              <span
                className="absolute inset-y-[3px] left-0 rounded-[4px]"
                style={{
                  width: `${((s.avg_days ?? 0) / top) * 100}%`,
                  background: s.code === longest.code
                    ? stageVar(s.code) : "var(--color-accent-soft)",
                }}
              />
            </span>
            <b className="text-right text-[13px] font-semibold tabular-nums">
              {formatDays(s.avg_days)}
            </b>
          </Link>
        ))}
        <div className="grid grid-cols-[190px_minmax(0,1fr)_80px] gap-4 text-[11px] tabular-nums text-muted-2 max-md:grid-cols-[56px_minmax(0,1fr)_64px] max-md:gap-2">
          <span />
          <span className="flex justify-between">
            {ticks.map((t, i) => (
              <span key={t}>
                {formatInt(t)}{i === ticks.length - 1 ? " дн." : ""}
              </span>
            ))}
          </span>
          <span />
        </div>
      </div>
      <span className="border-t border-line pt-3 text-xs text-muted-2">
        Дольше всего стоят на этапе{" "}
        <b className="text-fg">«{longest.name}»</b> — в среднем{" "}
        {formatDays(longest.avg_days)}
      </span>
    </SectionCard>
  );
}

function NetFlow({ months }: { months: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const net = months.map((m) => m.new - m.stops);
  const up = Math.max(0, ...net);
  const down = Math.max(0, ...net.map((v) => -v));
  const span = Math.max(1, up + down);
  const zero = (up / span) * 100;
  const added = months.reduce((s, m) => s + m.new, 0);
  const stopped = months.reduce((s, m) => s + m.stops, 0);
  const total = added - stopped;
  const h = hover == null ? null : months[hover];
  return (
    <SectionCard
      title="Чистый приток"
      note="новые минус остановки по месяцам · выше нуля — портфель растёт"
      right={(
        <span className="flex gap-3 text-xs text-muted-2">
          <Legend color="var(--color-accent-bar)" label="рост" />
          <Legend color="var(--color-bad)" label="убыль" />
        </span>
      )}
    >
      <div
        className="relative flex h-[200px] items-stretch gap-1"
        onMouseLeave={() => setHover(null)}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 border-t border-line-strong"
          style={{ top: `${zero}%` }}
        />
        {net.map((v, i) => (
          <button
            key={months[i].month}
            type="button"
            aria-label={`${monthTitle(months[i].month)}: ${v > 0 ? "+" : ""}${v}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className={clsx(
              "relative flex-1 cursor-default rounded-md border-0 p-0",
              hover === i ? "bg-accent-tint" : "bg-transparent",
            )}
          >
            <span
              className="absolute inset-x-[18%] rounded-[3px]"
              style={{
                top: v >= 0 ? `${zero - (v / span) * 100}%` : `${zero}%`,
                height: `max(${(Math.abs(v) / span) * 100}%, 2px)`,
                background: v >= 0
                  ? "var(--color-accent-bar)" : "var(--color-bad)",
              }}
            />
          </button>
        ))}
        {h && hover != null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 flex w-[170px] flex-col gap-1 rounded-xl bg-fg px-3.5 py-3 text-xs text-white shadow-pop"
            style={hover >= months.length / 2
              ? { right: `calc(${((months.length - hover) / months.length) * 100}% + 6px)` }
              : { left: `calc(${((hover + 1) / months.length) * 100}% + 6px)` }}
          >
            <b className="text-[13px] font-semibold">{monthTitle(h.month)}</b>
            <span className="flex justify-between">
              новые <b className="tabular-nums">+{h.new}</b>
            </span>
            <span className="flex justify-between">
              остановки <b className="tabular-nums">−{h.stops}</b>
            </span>
            <span className="flex justify-between border-t border-white/15 pt-1">
              итого{" "}
              <b className="tabular-nums">
                {net[hover] > 0 ? "+" : ""}{net[hover]}
              </b>
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-1">
        {months.map((m) => {
          const month = Number(m.month.split("-")[1]);
          return (
            <span
              key={m.month}
              className="flex-1 text-center text-[10.5px] text-muted-2"
            >
              {MONTHS[month - 1]}
            </span>
          );
        })}
      </div>
      <span className="mt-auto border-t border-line pt-3 text-xs leading-relaxed text-muted-2">
        За 12 мес. +{formatInt(added)} {pluralOffers(added)} и −
        {formatInt(stopped)} остановок:{" "}
        <b className={total >= 0 ? "text-pos" : "text-bad-ink"}>
          {total > 0 ? "+" : ""}{formatInt(total)}
        </b>{" "}
        к портфелю.
      </span>
    </SectionCard>
  );
}
