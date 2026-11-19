import type { ReactNode } from "react";
import {
  Link, Navigate, useLocation, useSearchParams,
} from "react-router-dom";
import {
  CircleSlash, Globe2, TrendingUp, TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { getFacets, getOverview } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { stagger } from "../lib/anim";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { CountryCode } from "../components/vpc/chips";
import {
  IndexBadge, SectionCard, StateStrip,
} from "../components/vpc/insight";
import { VpcGate } from "../components/vpc/VpcGate";
import { Legend, MonthsChart } from "../components/vpc/charts";
import { stageChip, stageVar } from "../lib/charts";
import { useFetch } from "../hooks/useFetch";
import { useVpcLinks } from "../hooks/useVpcScope";
import { formatDate, formatInt } from "../lib/format";
import {
  STATE_COLORS, STATE_LABELS, formatPct, makerStripe, plural, pluralOffers,
} from "../lib/vpc";
import type {
  OverviewInsight, OverviewMaker, OverviewMnn, OverviewShare,
  OverviewStage, VpcOverview,
} from "../types/vpc";

const FILTER_KEYS = ["responsible", "klass", "period"] as const;
const KEEP_ON_OVERVIEW = new Set<string>(["target", ...FILTER_KEYS]);
const PERIODS = [
  { value: "3", label: "3 мес." },
  { value: "6", label: "6 мес." },
  { value: "12", label: "12 мес." },
];
export default function VpcHome() {
  const { search } = useLocation();
  const { offersUrl } = useVpcLinks();
  const params = new URLSearchParams(search);
  const legacy = [...params.keys()].some((k) => !KEEP_ON_OVERVIEW.has(k));
  if (legacy) {
    return <Navigate to={offersUrl(Object.fromEntries(params))} replace />;
  }
  return (
    <VpcGate title="Обзор">
      <Overview />
    </VpcGate>
  );
}

function Overview() {
  const { market } = useVpcLinks();
  const [search, setSearch] = useSearchParams();
  const picked = market ? null : search.get("target");
  const target = market ?? picked;
  const responsible = search.get("responsible");
  const klass = search.get("klass");
  const period = search.get("period");
  const data = useFetch(
    (signal) => {
      const params: Record<string, string> = {};
      if (target) params.target = target;
      if (responsible) params.responsible = responsible;
      if (klass) params.klass = klass;
      if (period) params.period = period;
      return getOverview(params, signal);
    },
    [target, responsible, klass, period],
    "Не удалось загрузить обзор",
  );
  const d = data.data;
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearch(next);
  };
  const filters = d?.filters;

  return (
    <Page maxWidth={1440} dim={data.loading && !!data.data}>
      <PageHeader
        title={market ? "Обзор ВПЦ рынка" : "Обзор ВПЦ"}
        subtitle={d
          ? `Выгрузка на ${formatDate(d.data_date)} · что предлагают заводы и где застряло`
          : "Загружаем выгрузку…"}
      >
        {!market && (
          <TargetPicker value={picked} onChange={(v) => set("target", v)} />
        )}
        <Picker
          label="Период"
          all="Всё время"
          value={period}
          onChange={(v) => set("period", v)}
          options={[
            ...PERIODS,
            ...(filters?.years ?? []).map((y) => ({
              value: String(y), label: `${y} год`,
            })),
          ]}
        />
        <Picker
          label="Ответственный"
          all="Все"
          value={responsible}
          onChange={(v) => set("responsible", v)}
          options={(filters?.responsible ?? []).map((o) => ({
            value: o.value, label: `${o.value} · ${formatInt(o.count)}`,
          }))}
        />
        <Picker
          label="Класс"
          all="Все"
          value={klass}
          onChange={(v) => set("klass", v)}
          options={(filters?.klass ?? []).map((o) => ({
            value: o.value, label: `${o.value} · ${formatInt(o.count)}`,
          }))}
        />
      </PageHeader>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && d.kpi.offers === 0 && (
        <div className="rounded-card bg-surface px-6 py-12 text-center text-sm text-muted-2">
          {responsible || klass || period
            ? "Под выбранные фильтры предложений нет."
            : "В выгрузке нет предложений, доступных вам."}
        </div>
      )}
      {d && d.kpi.offers > 0 && <Body d={d} narrow={!!target} />}
    </Page>
  );
}

function TargetPicker({
  value, onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const facets = useFetch(
    (signal) => getFacets({ priced: "false" }, signal), [],
  );
  const options = facets.data?.target ?? [];
  return (
    <label className="flex h-10 items-center gap-2 rounded-full bg-surface pl-4 pr-2 text-[13px]">
      <span className="text-muted-2">Для страны</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="cursor-pointer rounded-full border-0 bg-transparent py-1 pr-1 font-semibold text-fg outline-none"
      >
        <option value="">Все рынки</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value} · {formatInt(o.count)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Picker({
  label, all, value, options, onChange,
}: {
  label: string;
  all: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  const known = !value || options.some((o) => o.value === value);
  return (
    <label className="flex h-10 items-center gap-2 rounded-full bg-surface pl-4 pr-2 text-[13px]">
      <span className="text-muted-2">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="cursor-pointer rounded-full border-0 bg-transparent py-1 pr-1 font-semibold text-fg outline-none"
      >
        <option value="">{all}</option>
        {!known && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Body({ d, narrow }: { d: VpcOverview; narrow: boolean }) {
  return (
    <>
      <KpiRow d={d} />
      {d.insights.length > 0 && <Insights items={d.insights} />}
      <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <FunnelCard d={d} />
        <StagesNow stages={d.stages} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <TopMnn rows={d.mnn} total={d.kpi.mnn} />
        <TopMakers rows={d.makers} total={d.kpi.makers} />
      </div>
      <div
        className={clsx(
          "grid gap-5 max-xl:grid-cols-1",
          narrow ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        <Origin rows={d.origin} />
        {!narrow && d.targets.length > 0 && (
          <Targets rows={d.targets} average={d.kpi.contract_pct} />
        )}
      </div>
      <MonthsChart months={d.months} />
    </>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <span aria-hidden className="flex h-[30px] min-w-0 max-w-[84px] flex-1 items-end justify-end gap-[2px] overflow-hidden">
      {values.map((v, i) => (
        <span
          key={i}
          className="bar-y min-w-[2px] max-w-[5px] flex-1 rounded-t-[2px]"
          style={{
            height: `${Math.max(2, (v / max) * 30)}px`,
            background: color,
            opacity: i === values.length - 1 ? 1 : 0.35,
          }}
        />
      ))}
    </span>
  );
}

function pct(part: number, whole: number): number | null {
  return whole ? Math.round((part / whole) * 1000) / 10 : null;
}

function KpiRow({ d }: { d: VpcOverview }) {
  const { listUrl, offersUrl } = useVpcLinks();
  const k = d.kpi;
  const newM = d.months.map((m) => m.new);
  const conM = d.months.map((m) => m.contracts);
  const days = k.avg_to_contract;
  const tiles: {
    label: string;
    value: string;
    unit?: string;
    note: string;
    spark?: ReactNode;
    to: string;
    bad?: boolean;
  }[] = [
    {
      label: "Предложений",
      value: formatInt(k.offers),
      note: `${formatInt(k.mnn)} МНН · ${formatInt(k.products)} ${plural(k.products, "продукт", "продукта", "продуктов")} · ${formatInt(k.makers)} ${plural(k.makers, "завод", "завода", "заводов")}`,
      spark: <Spark values={newM} color="var(--color-accent-bar)" />,
      to: offersUrl({ priced: "0" }),
    },
    {
      label: "В работе",
      value: formatInt(k.work),
      unit: formatPct(pct(k.work, k.offers)),
      note: "ещё не контракт и не стоп",
      to: listUrl("overview", { tab: "work" }),
    },
    {
      label: "Контрактов",
      value: formatInt(k.contracts),
      unit: formatPct(k.contract_pct),
      note: "дошли до контракта и дальше",
      spark: <Spark values={conM} color="var(--color-st-result)" />,
      to: "funnel",
    },
    {
      label: "До контракта",
      value: days == null ? "—" : formatInt(Math.round(days)),
      unit: days == null ? "" : "дн.",
      note: "в среднем от запроса до подписания",
      to: "funnel",
    },
    {
      label: `Новых за ${k.new_days} дн.`,
      value: formatInt(k.new),
      note: "по дате создания предложения",
      spark: (
        <Spark values={newM.slice(-4)} color="var(--color-accent-bar)" />
      ),
      to: offersUrl({ priced: "0" }),
    },
    {
      label: "Остановлено",
      value: formatInt(k.stopped),
      unit: formatPct(pct(k.stopped, k.offers)),
      note: "предложений со статусом стоп",
      to: listUrl("overview", { tab: "stop" }),
    },
  ];
  return (
    <section
      aria-label="Главные цифры"
      className="grid grid-cols-6 gap-3.5 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1"
    >
      {tiles.map((t, i) => (
        <Link
          key={t.label}
          to={t.to}
          className="anim-rise tr-soft flex min-w-0 flex-col gap-2.5 rounded-card bg-surface px-[22px] py-5 text-fg hover:text-fg hover:shadow-pop"
          style={stagger(i)}
        >
          <span className="min-w-0 text-[13px] text-muted-2">{t.label}</span>
          <span className="flex min-w-0 items-end justify-between gap-2">
            <span className="flex shrink-0 items-baseline gap-1.5">
              <span
                className={clsx(
                  "text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
                  t.bad && "text-bad",
                )}
              >
                {t.value}
              </span>
              {t.unit && (
                <span className="text-sm text-muted-2">{t.unit}</span>
              )}
            </span>
            {t.spark}
          </span>
          <span className="text-xs text-muted-2">{t.note}</span>
        </Link>
      ))}
    </section>
  );
}

const TONES: Record<OverviewInsight["tone"], {
  box: string;
  icon: string;
  label: string;
}> = {
  bad: {
    box: "bg-bad-tint", icon: "bg-bad/15 text-bad-ink", label: "text-bad-ink",
  },
  good: {
    box: "bg-pos-tint", icon: "bg-pos/15 text-pos", label: "text-pos",
  },
  info: {
    box: "bg-accent-tint", icon: "bg-accent/15 text-accent",
    label: "text-accent",
  },
  warn: {
    box: "bg-warn-tint", icon: "bg-warn-ink/10 text-warn-ink",
    label: "text-warn-ink",
  },
};

const KINDS: Record<OverviewInsight["kind"], {
  label: string;
  icon: LucideIcon;
}> = {
  bottleneck: { label: "Узкое место", icon: TriangleAlert },
  source: { label: "Лучший источник", icon: TrendingUp },
  market: { label: "Главный рынок", icon: Globe2 },
  stop: { label: "Почему стоп", icon: CircleSlash },
};

function Insights({ items }: { items: OverviewInsight[] }) {
  const { listUrl, countryUrl } = useVpcLinks();
  const href = (i: OverviewInsight) => i.link.to === "list"
    ? listUrl("overview", i.link.params)
    : countryUrl(i.link.params.code, i.link.params.mode);
  return (
    <section
      aria-label="Главное сейчас"
      className="grid grid-cols-4 gap-3.5 max-xl:grid-cols-2 max-md:grid-cols-1"
    >
      {items.map((i, n) => {
        const tone = TONES[i.tone];
        const kind = KINDS[i.kind];
        const Icon = kind.icon;
        return (
          <Link
            key={i.kind}
            to={href(i)}
            className={clsx(
              "anim-rise tr-soft flex items-start gap-3.5 rounded-[18px] px-5 py-[18px] text-fg hover:text-fg hover:brightness-[0.98]",
              tone.box,
            )}
            style={stagger(n + 1)}
          >
            <span
              className={clsx(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                tone.icon,
              )}
            >
              <Icon size={17} strokeWidth={2.2} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span
                className={clsx(
                  "text-[11px] font-semibold uppercase tracking-[0.06em]",
                  tone.label,
                )}
              >
                {kind.label}
              </span>
              <b className="text-[15px] font-semibold leading-snug">
                {i.title}
              </b>
              <span className="text-[13px] leading-snug text-fg-2">
                {i.text}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function FunnelCard({ d }: { d: VpcOverview }) {
  const steps = d.funnel.steps;
  const top = Math.max(1, steps[0]?.reached ?? 1);
  const worst = d.funnel.worst;
  return (
    <SectionCard
      title="Воронка: сколько доходит"
      note={`${formatInt(top)} ${pluralOffers(top)} · справа — сколько отвалилось и конверсия из предыдущего этапа`}
      right={(
        <Link to="funnel" className="text-[13px] font-medium">
          Вся воронка →
        </Link>
      )}
    >
      <div className="flex flex-col">
        {steps.map((s) => {
          const low = s.conversion != null && s.conversion < 72;
          const width = (s.reached / top) * 100;
          return (
            <div
              key={s.code}
              title={`${s.name}: дошли ${s.reached}`}
              className="grid grid-cols-[150px_minmax(0,1fr)_96px_44px] items-center gap-3 py-[5px] max-md:grid-cols-[52px_minmax(0,1fr)_84px_36px]"
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
              <span className="relative h-[26px] rounded-[7px] bg-canvas">
                <span
                  className="absolute inset-y-0 left-0 rounded-[7px]"
                  style={{ width: `${width}%`, background: stageVar(s.code) }}
                />
              </span>
              <span
                className={clsx(
                  "whitespace-nowrap text-right text-xs tabular-nums",
                  low ? "font-semibold text-bad-ink" : "text-muted-2",
                )}
              >
                {s.lost == null
                  ? "вход"
                  : `−${formatInt(s.lost)} · ${formatPct(s.conversion)}`}
              </span>
              <b className="text-right text-[15px] font-semibold tabular-nums">
                {formatInt(s.reached)}
              </b>
            </div>
          );
        })}
      </div>
      <span className="border-t border-line pt-3 text-xs text-muted-2">
        Конверсия в контракт{" "}
        <b className="text-fg">{formatPct(d.kpi.contract_pct)}</b>
        {worst && (
          <>
            {" · "}больше всего теряем между «{worst.from}» и «{worst.name}»:{" "}
            <b className="text-bad-ink">−{formatInt(worst.lost)}</b>
          </>
        )}
      </span>
    </SectionCard>
  );
}

function StagesNow({ stages }: { stages: OverviewStage[] }) {
  const { listUrl } = useVpcLinks();
  const active = stages.filter((s) => s.code !== "stop");
  const stopped = stages.find((s) => s.code === "stop")?.count ?? 0;
  const total = active.reduce((sum, s) => sum + s.count, 0);
  const max = Math.max(1, ...active.map((s) => s.count));
  return (
    <SectionCard
      title="Где стоят сейчас"
      note={`${formatInt(total)} ${pluralOffers(total)} в процессе · текущий этап · клик открывает список`}
    >
      <div className="flex flex-col">
        {active.map((s) => (
          <Link
            key={s.code}
            to={listUrl("overview", { stage: s.code })}
            title={`${s.name}: ${s.count}`}
            className="tr-soft group -mx-2 grid grid-cols-[150px_minmax(0,1fr)_52px_44px] items-center gap-3 rounded-lg px-2 py-[5px] text-fg hover:bg-canvas hover:text-fg max-md:grid-cols-[52px_minmax(0,1fr)_44px_36px]"
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
            <span className="relative h-[26px] rounded-[7px] bg-canvas group-hover:bg-surface">
              <span
                className="absolute inset-y-0 left-0 rounded-[7px]"
                style={{
                  width: `${(s.count / max) * 100}%`,
                  background: stageVar(s.code),
                }}
              />
            </span>
            <span className="text-right text-xs tabular-nums text-muted-2">
              {formatPct(pct(s.count, total))}
            </span>
            <b className="text-right text-[15px] font-semibold tabular-nums">
              {formatInt(s.count)}
            </b>
          </Link>
        ))}
      </div>
      {stopped > 0 && (
        <Link
          to={listUrl("overview", { tab: "stop" })}
          className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted-2 hover:text-fg"
        >
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px] bg-st-stop" />
            Остановлено — не входит в шкалу
          </span>
          <b className="text-[13px] font-semibold tabular-nums text-fg">
            {formatInt(stopped)} →
          </b>
        </Link>
      )}
    </SectionCard>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-track">
      <span
        className="block h-full rounded-full bg-accent-bar"
        style={{ width: `${(value / max) * 100}%` }}
      />
    </span>
  );
}

const MNN_GRID = "grid grid-cols-[24px_minmax(0,1fr)_130px_52px_52px_64px] items-center gap-3";

function TopMnn({ rows, total }: { rows: OverviewMnn[]; total: number }) {
  const { offersUrl } = useVpcLinks();
  const max = Math.max(1, ...rows.map((r) => r.offers));
  return (
    <SectionCard
      title="Лучшие МНН"
      note={`по числу предложений · топ-${rows.length} из ${formatInt(total)}`}
      right={(
        <Link
          to={offersUrl({ priced: "0" })}
          className="text-[13px] font-medium"
        >
          Все МНН →
        </Link>
      )}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[540px]">
          <div className={clsx(MNN_GRID, "px-1 pb-1.5 text-xs text-muted-2")}>
            <span>#</span>
            <span>МНН</span>
            <span>Предложения</span>
            <span className="text-right">Заводы</span>
            <span className="text-right">Страны</span>
            <span className="text-right">Контракты</span>
          </div>
          {rows.map((m, i) => (
            <Link
              key={m.generic}
              to={offersUrl({ mnn: m.generic, priced: "0" })}
              className={clsx(
                MNN_GRID,
                "tr-soft border-t border-line px-1 py-2.5 text-sm text-fg hover:bg-subtle hover:text-fg",
              )}
            >
              <span className="text-xs tabular-nums text-muted-2">{i + 1}</span>
              <b className="truncate font-semibold">{m.generic}</b>
              <span className="flex items-center gap-2">
                <Bar value={m.offers} max={max} />
                <b className="w-7 text-right font-semibold tabular-nums">
                  {formatInt(m.offers)}
                </b>
              </span>
              <span className="text-right tabular-nums">
                {formatInt(m.makers)}
              </span>
              <span className="text-right tabular-nums">
                {formatInt(m.countries)}
              </span>
              <b className="text-right font-semibold tabular-nums text-pos">
                {formatInt(m.contracts)}
              </b>
            </Link>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

const MAKER_GRID = "grid grid-cols-[24px_minmax(0,1fr)_140px_44px_64px] items-center gap-3";

function TopMakers({ rows, total }: {
  rows: OverviewMaker[];
  total: number;
}) {
  const { factoryUrl } = useVpcLinks();
  return (
    <SectionCard
      title="Самые активные заводы"
      note="предложений · состояние · ценовой индекс к лучшей цене"
      right={(
        <Link to="factories" className="text-[13px] font-medium">
          Все {formatInt(total)} →
        </Link>
      )}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[540px]">
          <div className={clsx(MAKER_GRID, "px-1 pb-1.5 text-xs text-muted-2")}>
            <span>#</span>
            <span>Завод</span>
            <span>Состояние</span>
            <span className="text-right">Предл.</span>
            <span className="text-right">Индекс</span>
          </div>
          {rows.map((m, i) => (
            <Link
              key={m.maker}
              to={factoryUrl(m.maker)}
              className={clsx(
                MAKER_GRID,
                "tr-soft border-t border-line px-1 py-2 text-sm text-fg hover:bg-subtle hover:text-fg",
              )}
            >
              <span className="text-xs tabular-nums text-muted-2">{i + 1}</span>
              <span className="flex min-w-0 flex-col leading-tight">
                <b className="truncate font-semibold">{m.maker}</b>
                <span className="truncate text-xs text-muted-2">
                  {[m.country, `${m.mnn} МНН`, `${m.contracts} контр.`]
                    .filter(Boolean).join(" · ")}
                </span>
              </span>
              <StateStrip states={m.states} className="!h-2" />
              <b className="text-right font-semibold tabular-nums">
                {formatInt(m.offers)}
              </b>
              <span className="text-right">
                <IndexBadge value={m.index} />
              </span>
            </Link>
          ))}
          <div className="flex flex-wrap gap-3.5 px-1 pt-3 text-xs text-muted-2">
            {(["work", "contract", "result"] as const).map((s) => (
              <Legend
                key={s}
                color={STATE_COLORS[s]}
                label={STATE_LABELS[s].toLowerCase()}
              />
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function Origin({ rows }: { rows: OverviewShare[] }) {
  const { countryUrl } = useVpcLinks();
  const max = Math.max(1, ...rows.map((r) => r.offers));
  return (
    <SectionCard
      title="Откуда приходят предложения"
      note="страна завода · доля предложений и сколько из них дошло до контракта"
      right={(
        <span className="flex gap-3 text-xs text-muted-2">
          <Legend color="var(--color-accent-soft)" label="предложения" />
          <Legend color="var(--color-accent-bar)" label="контракты" />
        </span>
      )}
    >
      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const w = (r.offers / max) * 100;
          return (
            <Link
              key={r.code}
              to={countryUrl(r.code, "maker")}
              title={`${r.name}: ${r.offers} предложений, ${r.contracts} контрактов, заводов ${r.makers}`}
              className="tr-soft grid grid-cols-[110px_minmax(0,1fr)_72px] items-center gap-3 rounded-lg px-1 py-1.5 text-sm text-fg hover:bg-subtle hover:text-fg"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-4 w-[3px] shrink-0 rounded-full"
                  style={{ background: makerStripe(r.code) }}
                />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="relative h-[22px] overflow-hidden rounded-md bg-canvas">
                <span
                  className="absolute inset-y-0 left-0 rounded-md bg-accent-soft"
                  style={{ width: `${w}%` }}
                />
                <span
                  className="absolute inset-y-0 left-0 rounded-md bg-accent-bar"
                  style={{ width: `${(r.contracts / max) * 100}%` }}
                />
                <span
                  className="absolute top-[3px] text-xs tabular-nums text-muted-2"
                  style={{ left: `calc(${Math.min(w, 82)}% + 8px)` }}
                >
                  {formatPct(r.pct)}
                </span>
              </span>
              <span className="text-right tabular-nums">
                <b className="font-semibold">{formatInt(r.offers)}</b>{" "}
                <span className="text-xs text-pos">
                  / {formatInt(r.contracts)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

function Targets({ rows, average }: {
  rows: OverviewShare[];
  average: number | null;
}) {
  const { countryUrl } = useVpcLinks();
  return (
    <SectionCard
      title="Для каких рынков ищем"
      note={`страна поиска · конверсия в контракт, метка — средняя ${formatPct(average)}`}
    >
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-2">
        {rows.map((t) => {
          const above = average != null && (t.conversion ?? 0) >= average;
          return (
            <Link
              key={t.code}
              to={countryUrl(t.code, "target")}
              className="tr-soft flex min-w-0 flex-col gap-2 rounded-[14px] bg-subtle p-3.5 text-fg hover:bg-seg hover:text-fg"
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <CountryCode code={t.code} />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <b className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                  {formatInt(t.offers)}
                </b>
                <span className="text-xs text-muted-2">{formatPct(t.pct)}</span>
              </span>
              <span className="relative h-[5px] rounded-full bg-line-strong">
                <span
                  className="block h-full rounded-full bg-st-result"
                  style={{ width: `${t.conversion ?? 0}%` }}
                />
                {average != null && (
                  <span
                    aria-hidden
                    className="absolute -top-[3px] h-[11px] w-0.5 rounded bg-fg"
                    style={{ left: `${average}%` }}
                  />
                )}
              </span>
              <span className="flex justify-between text-xs tabular-nums text-muted-2">
                <span>
                  конв.{" "}
                  <b className={above ? "text-pos" : "text-bad-ink"}>
                    {formatPct(t.conversion)}
                  </b>
                </span>
                <span>
                  контрактов{" "}
                  <b className="text-fg">{formatInt(t.contracts)}</b>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}
