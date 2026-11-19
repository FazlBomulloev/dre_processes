import { useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { getRgsMonth, getRgsOverview, getRgsStops } from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { DaysBadge } from "../components/rgs/chips";
import { GroupsPanel } from "../components/rgs/GroupsPanel";
import { RgsGate } from "../components/rgs/RgsGate";
import { SectionCard, Seg } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { formatDate, formatInt } from "../lib/format";
import {
  CATEGORIES, monthEnd, monthShort, monthTitle,
} from "../lib/rgs";
import { plural } from "../lib/vpc";
import type { RgsBlocker, RgsOverview } from "../types/rgs";

type Cat = (typeof CATEGORIES)[number]["value"];

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
  const month = search.get("month");
  const stops = search.get("stops") === "1";
  const params: Record<string, string> = cat ? { cat } : {};

  const set = (patch: Record<string, string | null>) =>
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    });

  const data = useFetch(
    (signal) => getRgsOverview(code, params, signal),
    [code, cat],
    "Не удалось загрузить обзор",
  );
  const d = data.data;

  return (
    <Page maxWidth={1180} dim={data.loading && !!data.data}>
      <PageHeader
        title="Как идёт регистрация"
        subtitle={`Данные трекера на ${formatDate(dataDate)}`}
      >
        <Seg
          label="Категория"
          options={CATEGORIES}
          value={cat}
          onChange={(v) => set({ cat: v || null })}
        />
      </PageHeader>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && (
        <>
          <Now d={d} />
          <Steps d={d} />
          <Months d={d} onPick={(m) => set({ month: m, stops: null })} />
          <Plan d={d} />
          <Blockers
            d={d}
            onStops={() => set({ stops: "1", month: null })}
          />
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

function Now({ d }: { d: RgsOverview }) {
  const items = [
    { value: d.now.in_work, label: "позиций в работе" },
    { value: d.now.submitted, label: "подано в Минздрав", lime: true },
    { value: d.now.ru_this_year, label: `РУ до конца ${d.now.year}` },
    { value: d.now.ru_next_year, label: `РУ в ${d.now.year + 1} году` },
  ];
  return (
    <section className="anim-rise flex flex-col gap-5 rounded-hero bg-rgs-ink px-[30px] py-7 text-white">
      <span className="text-lg font-semibold">Где мы сейчас</span>
      <div className="grid grid-cols-4 gap-6 max-md:grid-cols-2">
        {items.map((k) => (
          <div
            key={k.label}
            className={clsx(
              "flex flex-col gap-1.5 border-l-2 pl-4",
              k.lime ? "border-lime" : "border-white/25",
            )}
          >
            <span
              className={clsx(
                "text-[44px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
                k.lime && "text-lime",
              )}
            >
              {formatInt(k.value)}
            </span>
            <span className="text-sm text-white/75">{k.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Steps({ d }: { d: RgsOverview }) {
  const max = Math.max(1, d.steps[0]?.reached ?? 1);
  return (
    <SectionCard
      title="На каком этапе"
      right={
        <span className="text-xs text-faint">
          «Дошли» — сколько позиций прошли этап, «сейчас здесь» — сколько
          стоят на нём
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.06em] text-faint">
              <th className="px-2 py-2 text-left font-normal">Этап</th>
              <th className="px-2 py-2 text-right font-normal">Дошли</th>
              <th className="w-[44%] px-2 py-2" />
              <th className="px-2 py-2 text-right font-normal">Сейчас здесь</th>
            </tr>
          </thead>
          <tbody>
            {d.steps.map((s, i) => (
              <tr key={s.key} className="border-t border-line">
                <td className="px-2 py-3">{s.name}</td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums">
                  {formatInt(s.reached)}
                </td>
                <td className="px-2 py-3">
                  <span className="block h-2.5 rounded-full bg-track">
                    <span
                      className={clsx(
                        "block h-full rounded-full",
                        i < 3 ? "bg-[#8fa2db]" : "bg-rgs-ink",
                      )}
                      style={{ width: `${(s.reached / max) * 100}%` }}
                    />
                  </span>
                </td>
                <td
                  className={clsx(
                    "px-2 py-3 text-right font-semibold tabular-nums",
                    !s.now && "text-faintest",
                  )}
                >
                  {formatInt(s.now)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const max = Math.max(1, ...items.map((m) => m.count));
  const plan = d.plan_date
    ? `План от ${formatDate(d.plan_date)} + ${d.margin} ${plural(
      d.margin, "месяц", "месяца", "месяцев",
    )} запаса`
    : `План + ${d.margin} мес. запаса`;
  return (
    <SectionCard
      title="Когда получим РУ"
      right={
        <span className="text-xs text-faint">
          {plan} · без плана: {d.months.no_plan}
          {d.months.later > 0 && ` · позже: ${d.months.later}`}
        </span>
      }
    >
      <div className="flex h-[200px] items-end gap-2 border-b border-line-strong">
        {items.map((m, i) => (
          <button
            key={m.month}
            type="button"
            disabled={!m.count}
            title={`${monthTitle(m.month)}: ${m.count}`}
            onClick={() => onPick(m.month)}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5 border-0 bg-transparent p-0 disabled:cursor-default"
          >
            {m.count > 0 && (
              <span className="text-[15px] font-semibold tabular-nums">
                {m.count}
              </span>
            )}
            <span
              className={clsx(
                "bar-y tr-soft w-full max-w-11 rounded-t-lg group-enabled:group-hover:opacity-80",
                m.count === 0 && "bg-seg",
                m.count > 0 && (m.this_year ? "bg-rgs-ink" : "bg-lime"),
              )}
              style={{
                height: m.count ? `${(m.count / max) * 130}px` : "3px",
                animationDelay: `${i * 25}ms`,
              }}
            />
          </button>
        ))}
      </div>
      <div className="-mt-3 flex gap-2">
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

function Plan({ d }: { d: RgsOverview }) {
  const p = d.plan;
  return (
    <SectionCard title="Укладываемся ли в план">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-line pb-5">
        <span className="flex items-baseline gap-2">
          <span className="text-[44px] font-semibold leading-none tracking-[-0.02em] text-rgs-ink tabular-nums">
            {p.submitted}
          </span>
          <span className="text-xl font-semibold text-faint">
            из {p.total}
          </span>
        </span>
        <span className="max-w-[560px] text-[15px] text-muted">
          позиций из майского плана уже подано. В срок или раньше:{" "}
          {p.on_time}. С опозданием: {p.late}
          {p.late_median != null && `, медиана опоздания ${p.late_median} ${
            plural(p.late_median, "день", "дня", "дней")}`}
          . Не подано: {p.not_submitted}.
        </span>
      </div>
      <span className="text-sm font-semibold">
        Сколько длится каждый этап (медиана, дней)
      </span>
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
              среднее {t.mean ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Blockers({
  d, onStops,
}: {
  d: RgsOverview;
  onStops: () => void;
}) {
  const plan = d.plan_date ? ` от ${formatDate(d.plan_date)}` : "";
  const groups = d.split_blockers
    ? [
      { title: "Проблемные", rows: d.blockers.filter((b) => b.kind === "problem") },
      { title: "Долгосрочная подготовка", rows: d.blockers.filter((b) => b.kind === "long") },
    ].filter((g) => g.rows.length)
    : [{ title: "", rows: d.blockers }];
  return (
    <SectionCard
      title="Что мешает"
      right={
        <span className="text-xs text-faint">
          По плану{plan} уже должны были быть поданы, но в ГНЦЛ ещё не
          поданы. Справа — сколько дней прошло после плановой даты
        </span>
      }
    >
      {d.blockers.length === 0 && (
        <span className="text-sm text-muted-2">
          Просроченных подач нет.
        </span>
      )}
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col">
          {g.title && (
            <span className="pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.06em] text-faint">
              {g.title}
            </span>
          )}
          {g.rows.map((b) => <BlockerRow key={b.id} b={b} />)}
        </div>
      ))}
      <div className="flex items-center justify-between rounded-inner bg-subtle px-4 py-3 text-sm">
        <span className="font-medium">Остановлено: {d.stopped}</span>
        {d.stopped > 0 && (
          <button
            type="button"
            onClick={onStops}
            className="border-0 bg-transparent p-0 text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            Открыть список
          </button>
        )}
      </div>
    </SectionCard>
  );
}

function BlockerRow({ b }: { b: RgsBlocker }) {
  return (
    <div className="grid grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] items-center gap-5 border-t border-line py-3 max-md:grid-cols-[minmax(0,1fr)_auto]">
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-semibold">{b.tm}</span>
        <span className="text-[11px] uppercase text-faint">
          {[b.manufacturer, b.generic, b.form].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="text-sm text-fg-2 max-md:order-last max-md:col-span-2">
        {b.comment ?? "—"}
      </span>
      <DaysBadge days={b.days} />
    </div>
  );
}

function MonthPanel({
  code, month, params, onClose,
}: {
  code: string;
  month: string;
  params: Record<string, string>;
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
      title={monthTitle(month)}
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
  params: Record<string, string>;
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
