import { Link, useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import {
  getRgsMonth, getRgsOverview, getRgsStops, type RgsParams,
} from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { KpiGrid, NormBar } from "../components/rgs/blocks";
import { TonePill } from "../components/rgs/chips";
import { GroupsPanel } from "../components/rgs/GroupsPanel";
import { ProductPicker } from "../components/rgs/ProductPicker";
import { RgsGate } from "../components/rgs/RgsGate";
import { FilterPill } from "../components/vpc/FilterPill";
import { SectionCard, Seg } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { formatDate } from "../lib/format";
import {
  CATEGORIES, TONE_LABEL, monthEnd, monthShort, monthTitle, rgsUrl,
} from "../lib/rgs";
import { plural } from "../lib/vpc";
import type { RgsOverview } from "../types/rgs";

type Cat = (typeof CATEGORIES)[number]["value"];

const OVERDUE = "overdue";

export default function RgsOverviewPage() {
  const code = (useParams().code ?? "").toUpperCase();
  return (
    <RgsGate code={code}>
      {(meta) => <Overview code={code} dataDate={meta.data_date ?? null} />}
    </RgsGate>
  );
}

function Overview({ code, dataDate }: { code: string; dataDate: string | null }) {
  const [search, setSearch] = useSearchParams();
  const cat = (search.get("cat") ?? "") as Cat;
  const year = search.get("year") ?? "";
  const tms = search.getAll("tm");
  const month = search.get("month");
  const stops = search.get("stops") === "1";
  const params: RgsParams = {};
  if (cat) params.cat = cat;
  if (year) params.year = year;
  if (tms.length) params.tm = tms;

  const set = (patch: Record<string, string | string[] | null>) =>
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        next.delete(k);
        for (const item of Array.isArray(v) ? v : v ? [v] : []) {
          next.append(k, item);
        }
      }
      return next;
    });

  const data = useFetch(
    (signal) => getRgsOverview(code, params, signal),
    [code, cat, year, tms.join("|")],
    "Не удалось загрузить обзор",
  );
  const d = data.data;
  const cats = CATEGORIES.map((c) => ({
    value: c.value,
    label: c.value && d?.ru_days[c.value]
      ? `${c.label} · ${d.ru_days[c.value]} дн.`
      : c.label,
  }));

  return (
    <Page maxWidth={1240} dim={data.loading && !!data.data}>
      <PageHeader
        title="Как идёт регистрация"
        subtitle={`Данные трекера на ${formatDate(dataDate)}`}
      >
        <Seg
          label="Категория"
          options={cats}
          value={cat}
          onChange={(v) => set({ cat: v || null })}
        />
      </PageHeader>
      <div className="-mt-2 flex flex-wrap items-center gap-1 rounded-full bg-surface/70 p-1 w-fit">
        <FilterPill
          label="Год задачи"
          value={year}
          options={d?.filters.years}
          onChange={(v) => set({ year: v })}
        />
        <ProductPicker
          options={d?.filters.products ?? []}
          value={tms}
          onChange={(next) => set({ tm: next })}
        />
      </div>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && (
        <>
          <KpiGrid kpis={d.kpis} />
          <Stages d={d} />
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-5 max-lg:grid-cols-1">
            <RuDue d={d} code={code} />
            <div className="flex min-w-0 flex-col gap-5">
              <Funnel d={d} />
            </div>
          </div>
          <Durations d={d} />
          <Months d={d} onPick={(m) => set({ month: m, stops: null })} />
          <Stopped d={d} onOpen={() => set({ stops: "1", month: null })} />
        </>
      )}
      {month && (
        <MonthPanel
          code={code}
          month={month}
          params={params}
          onClose={() => set({ month: null })}
        />
      )}
      {stops && (
        <StopsPanel
          code={code}
          params={params}
          onClose={() => set({ stops: null })}
        />
      )}
    </Page>
  );
}

function Stages({ d }: { d: RgsOverview }) {
  const max = Math.max(
    1, ...d.stages.flatMap((s) => [s.fact ?? 0, s.red ?? 0]),
  );
  return (
    <SectionCard
      title="Этапы против нормы"
      note="Среднее по завершённым этапам, дней · жёлтый — выше нормы · красный — выше нормы в 1,5 раза"
    >
      <div className="flex flex-col">
        {d.stages.map((s) => (
          <div
            key={s.key}
            className="grid grid-cols-[minmax(180px,2fr)_80px_minmax(160px,4fr)_56px_96px] items-center gap-4 border-t border-line py-2.5 text-[13px] max-md:grid-cols-[minmax(0,1fr)_56px_96px]"
          >
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">{s.name}</span>
              <span className="text-xs text-faint">{s.codes}</span>
            </span>
            <span className="text-muted-2 max-md:hidden">
              норма {s.norm ?? "—"}
            </span>
            <span className="max-md:hidden">
              <NormBar fact={s.fact} norm={s.norm} max={max} tone={s.tone} />
            </span>
            <span className="text-right text-base font-semibold tabular-nums">
              {s.fact ?? "—"}
            </span>
            <span>
              <TonePill tone={s.tone}>{TONE_LABEL[s.tone]}</TonePill>
            </span>
          </div>
        ))}
      </div>
      {!d.split && (
        <span className="text-xs text-faint">
          Комплектация и передача с подачей посчитаются по отдельности, когда
          в трекере появятся даты dcz и dh. Пока виден только итог до подачи.
        </span>
      )}
    </SectionCard>
  );
}

function RuDue({ d, code }: { d: RgsOverview; code: string }) {
  const days = Object.values(d.ru_days);
  const range = [...new Set(days)].join(" / ");
  return (
    <section className="anim-rise flex min-w-0 flex-col gap-3 rounded-card bg-rgs-ink px-6 py-6 text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[19px] font-semibold tracking-[-0.01em]">
          Срок РУ: план прошёл или близко
        </span>
        <span className="text-xs text-white/60">
          план = дата задачи + {range} дн. · жёлтый за {d.ru_warn} дн.
        </span>
      </div>
      {d.ru_due.length === 0 && (
        <span className="text-sm text-white/70">
          Просроченных и близких к сроку РУ нет.
        </span>
      )}
      <div className="flex max-h-[420px] flex-col overflow-y-auto">
        {d.ru_due.map((r) => (
          <Link
            key={r.id}
            to={`${rgsUrl(code, "products")}?item=${r.id}`}
            className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_96px_minmax(0,1fr)] items-center gap-3 border-t border-ink-line py-2.5 text-[13px] text-white hover:bg-white/[0.04] hover:text-white"
          >
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold">{r.tm}</span>
              <span className="truncate text-[11px] text-white/50">{r.sub}</span>
            </span>
            <span className="truncate text-white/70">{r.manager ?? "—"}</span>
            <span className="tabular-nums">{formatDate(r.plan)}</span>
            <span
              className={clsx(
                "font-semibold tabular-nums",
                r.tone === "red" ? "text-neg-on-ink" : "text-cat-watch",
              )}
            >
              {r.days != null && r.days < 0
                ? `просрочено ${-r.days} ${plural(-r.days, "день", "дня", "дней")}`
                : `осталось ${r.days} ${plural(r.days ?? 0, "день", "дня", "дней")}`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Funnel({ d }: { d: RgsOverview }) {
  const max = Math.max(1, ...d.funnel.map((f) => f.count));
  return (
    <SectionCard title="Где сейчас проекты" note="По датам из трекера, не по колонке «статус»">
      <div className="flex flex-col gap-2.5">
        {d.funnel.map((f) => (
          <div
            key={f.key}
            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_32px] items-center gap-3 text-[13px]"
          >
            <span className="flex flex-col leading-tight">
              {f.name}
              <span className="text-[11px] text-faint">{f.codes}</span>
            </span>
            <span className="block h-2.5 rounded-full bg-track">
              <span
                className="block h-full rounded-full bg-accent-bar"
                style={{ width: `${(f.count / max) * 100}%` }}
              />
            </span>
            <span
              className={clsx(
                "text-right font-semibold tabular-nums",
                !f.count && "text-faintest",
              )}
            >
              {f.count}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Durations({ d }: { d: RgsOverview }) {
  return (
    <SectionCard title="Сколько длится каждый этап" note="Медиана, дней">
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        {d.durations.map((t) => (
          <div
            key={t.key}
            className="flex flex-col gap-1 rounded-inner bg-subtle px-4 py-4"
          >
            <span className="text-[30px] font-semibold leading-none text-rgs-ink tabular-nums">
              {t.median ?? "—"}
            </span>
            <span className="text-[13px] text-muted">{t.label}</span>
            <span className="text-xs text-faint">
              среднее {t.mean ?? "—"} · позиций {t.count}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Months({
  d, onPick,
}: {
  d: RgsOverview;
  onPick: (month: string) => void;
}) {
  const items = d.months.items;
  const overdue = d.months.overdue;
  const max = Math.max(1, overdue, ...items.map((m) => m.count));
  const days = [...new Set(Object.values(d.ru_days))].join(" / ");
  return (
    <SectionCard
      title="Когда получим РУ"
      right={
        <span className="text-xs text-faint">
          План РУ = дата задачи + {days} дн. · без плана: {d.months.no_plan}
          {d.months.later > 0 && ` · позже: ${d.months.later}`}
        </span>
      }
    >
      <div className="flex h-[200px] items-end gap-2 border-b border-line-strong">
        <Bar
          count={overdue}
          max={max}
          title={`Уже просрочено: ${overdue}`}
          className="bg-bad"
          onClick={() => onPick(OVERDUE)}
          index={0}
        />
        <span aria-hidden className="mb-1 h-24 w-px shrink-0 bg-line-strong" />
        {items.map((m, i) => (
          <Bar
            key={m.month}
            count={m.count}
            max={max}
            title={`${monthTitle(m.month)}: ${m.count}`}
            className={m.this_year ? "bg-rgs-ink" : "bg-lime"}
            onClick={() => onPick(m.month)}
            index={i + 1}
          />
        ))}
      </div>
      <div className="-mt-3 flex gap-2">
        <span className="flex flex-1 flex-col items-center text-center text-[11px] font-medium leading-tight text-bad">
          Уже
          <span>просрочено</span>
        </span>
        <span aria-hidden className="w-px shrink-0" />
        {items.map((m, i) => (
          <span
            key={m.month}
            className="flex flex-1 flex-col items-center text-[11px] leading-tight text-muted-2"
          >
            {monthShort(m.month)}
            {(i === 0 || m.month.endsWith("-01")) && (
              <span>{m.month.slice(0, 4)}</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {d.months.totals.map((t) => (
          <span
            key={t.label}
            className="rounded-full bg-subtle px-3 py-1.5 text-[13px] text-muted"
          >
            {t.month ? `К концу ${monthEnd(t.month)}` : t.label}:{" "}
            <b className="font-semibold text-fg">{t.count} РУ</b>
          </span>
        ))}
      </div>
    </SectionCard>
  );
}

function Bar({
  count, max, title, className, onClick, index,
}: {
  count: number;
  max: number;
  title: string;
  className: string;
  onClick: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      disabled={!count}
      title={title}
      onClick={onClick}
      className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5 border-0 bg-transparent p-0 disabled:cursor-default"
    >
      {count > 0 && (
        <span className="text-[15px] font-semibold tabular-nums">{count}</span>
      )}
      <span
        className={clsx(
          "bar-y tr-soft w-full max-w-11 rounded-t-lg group-enabled:group-hover:opacity-80",
          count === 0 ? "bg-seg" : className,
        )}
        style={{
          height: count ? `${(count / max) * 130}px` : "3px",
          animationDelay: `${index * 25}ms`,
        }}
      />
    </button>
  );
}

function Stopped({ d, onOpen }: { d: RgsOverview; onOpen: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-card bg-surface px-6 py-4 text-sm">
      <span className="font-medium">
        Остановлено: {d.stopped}
        <span className="ml-2 text-xs font-normal text-faint">
          в KPI и блоках выше не учитываются
        </span>
      </span>
      {d.stopped > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="border-0 bg-transparent p-0 text-[13px] font-medium text-accent hover:text-accent-hover"
        >
          Открыть список
        </button>
      )}
    </div>
  );
}

function MonthPanel({
  code, month, params, onClose,
}: {
  code: string;
  month: string;
  params: RgsParams;
  onClose: () => void;
}) {
  const data = useFetch(
    (signal) => getRgsMonth(code, month, params, signal),
    [code, month, JSON.stringify(params)],
    "Не удалось загрузить месяц",
  );
  const d = data.loading ? null : data.data;
  return (
    <GroupsPanel
      eyebrow={d
        ? `План РУ · ${d.count} ${plural(
          d.count, "позиция", "позиции", "позиций",
        )} · по производителю`
        : "План РУ"}
      title={month === OVERDUE ? "Уже просрочено" : monthTitle(month)}
      data={d}
      error={data.error}
      onClose={onClose}
    />
  );
}

function StopsPanel({
  code, params, onClose,
}: {
  code: string;
  params: RgsParams;
  onClose: () => void;
}) {
  const data = useFetch(
    (signal) => getRgsStops(code, params, signal),
    [code, JSON.stringify(params)],
    "Не удалось загрузить список",
  );
  const d = data.loading ? null : data.data;
  return (
    <GroupsPanel
      eyebrow="по причине остановки"
      title={`Остановлено: ${d?.count ?? "…"}`}
      data={d}
      error={data.error}
      onClose={onClose}
    />
  );
}

