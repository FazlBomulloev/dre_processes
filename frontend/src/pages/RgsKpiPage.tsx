import { useParams, useSearchParams } from "react-router-dom";
import { getRgsKpi, type RgsParams } from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { Legend } from "../components/rgs/blocks";
import { TonePill } from "../components/rgs/chips";
import { KpiChart } from "../components/rgs/KpiChart";
import { RgsGate } from "../components/rgs/RgsGate";
import { SectionCard, Seg } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { stagger } from "../lib/anim";
import { formatDate } from "../lib/format";
import {
  CATEGORIES, TONE_LABEL, kpiGoal, kpiRed, kpiValue,
} from "../lib/rgs";
import type { RgsKpi, RgsKpiTable } from "../types/rgs";

type Cat = (typeof CATEGORIES)[number]["value"];

export default function RgsKpiPage() {
  const code = (useParams().code ?? "").toUpperCase();
  return (
    <RgsGate code={code}>
      {(meta) => <Kpi code={code} dataDate={meta.data_date ?? null} />}
    </RgsGate>
  );
}

function Kpi({ code, dataDate }: { code: string; dataDate: string | null }) {
  const [search, setSearch] = useSearchParams();
  const cat = (search.get("cat") ?? "") as Cat;
  const params: RgsParams = cat ? { cat } : {};
  const data = useFetch(
    (signal) => getRgsKpi(code, params, signal),
    [code, cat],
    "Не удалось загрузить KPI",
  );
  const d = data.data;
  return (
    <Page maxWidth={1240} dim={data.loading && !!data.data}>
      <PageHeader
        title="KPI регистрации"
        subtitle={`Данные трекера на ${formatDate(dataDate)} · цели и нормы — с листа «Нормативы» в Excel`}
      >
        <Seg
          label="Категория"
          options={CATEGORIES}
          value={cat}
          onChange={(v) => setSearch(v ? { cat: v } : {})}
        />
      </PageHeader>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && (
        <>
          <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            {d.kpis.map((k, i) => <KpiCard key={k.key} k={k} index={i} />)}
          </div>
          <Dynamics d={d} />
          <SectionCard title="Как читать цвета">
            <Legend
              items={[
                ["grn", "Зелёный — цель выполнена"],
                ["amb", "Жёлтый — хуже цели, но не в красной зоне"],
                ["red", "Красный — в красной зоне"],
                ["na", "Нет данных — в трекере не хватает дат"],
              ]}
            />
          </SectionCard>
        </>
      )}
    </Page>
  );
}

function domain(k: RgsKpi): [number, number] {
  if (k.unit === "%") return [0, 100];
  const lo = Math.min(0, k.value ?? 0);
  const hi = Math.max(k.red * 1.35, (k.value ?? 0) * 1.1, k.goal + 1);
  return [lo, hi];
}

function Scale({ k }: { k: RgsKpi }) {
  const [lo, hi] = domain(k);
  const at = (v: number) =>
    Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const green = k.up
    ? { left: at(k.goal), right: 100 }
    : { left: 0, right: Math.max(at(k.goal), 1.5) };
  const red = k.up
    ? { left: 0, right: at(k.red) }
    : { left: at(k.red), right: 100 };
  return (
    <span className="relative mt-1 block h-2.5 rounded-full bg-track">
      <span
        className="absolute inset-y-0 rounded-full bg-bad-tint"
        style={{ left: `${red.left}%`, width: `${red.right - red.left}%` }}
      />
      <span
        className="absolute inset-y-0 rounded-full bg-pos/45"
        style={{ left: `${green.left}%`, width: `${green.right - green.left}%` }}
      />
      {k.value != null && (
        <span
          aria-hidden
          className="absolute -top-1 h-[18px] w-1 -translate-x-1/2 rounded-full bg-rgs-ink ring-2 ring-surface"
          style={{ left: `${at(k.value)}%` }}
        />
      )}
    </span>
  );
}

function KpiCard({ k, index }: { k: RgsKpi; index: number }) {
  return (
    <div
      className="anim-rise flex min-w-0 flex-col gap-2 rounded-card bg-surface px-5 py-5"
      style={stagger(index)}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold">{k.label}</span>
        <TonePill tone={k.tone}>{TONE_LABEL[k.tone]}</TonePill>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
          {kpiValue(k)}
        </span>
        <span className="text-[13px] text-muted-2">{k.base}</span>
      </span>
      <Scale k={k} />
      <span className="flex flex-wrap gap-x-4 text-xs">
        <span className="text-pos">Цель: {kpiGoal(k)}</span>
        <span className="text-bad-ink">Красный: {kpiRed(k)}</span>
      </span>
      <span className="text-xs text-faint">{k.how}</span>
    </div>
  );
}

function Dynamics({ d }: { d: RgsKpiTable }) {
  const points = d.dynamics;
  return (
    <SectionCard
      title="Динамика"
      note={`Последние ${points.length} ${points.length === 1 ? "загрузка" : "загрузок"} трекера · RGS сравнивает загрузки между собой`}
    >
      {points.length < 2 ? (
        <span className="rounded-inner bg-subtle px-4 py-4 text-sm text-muted">
          Графики появятся после второй загрузки трекера. Сейчас есть одна
          загрузка — от {formatDate(points[0]?.date)}.
        </span>
      ) : (
        <div className="grid grid-cols-3 gap-x-6 gap-y-5 max-xl:grid-cols-2 max-md:grid-cols-1">
          {d.kpis.map((k) => (
            <div key={k.key} className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] font-semibold">{k.label}</span>
              <KpiChart
                k={k}
                points={points.map((p) => ({ date: p.date, value: p.values[k.key] ?? null }))}
              />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
