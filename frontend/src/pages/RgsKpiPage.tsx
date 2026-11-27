import { useParams, useSearchParams } from "react-router-dom";
import { getRgsOverview, type RgsParams } from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { KpiGrid, Legend } from "../components/rgs/blocks";
import { RgsGate } from "../components/rgs/RgsGate";
import { SectionCard, Seg } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { formatDate } from "../lib/format";
import { CATEGORIES, kpiGoal, kpiRed } from "../lib/rgs";

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
    (signal) => getRgsOverview(code, params, signal),
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
          <KpiGrid kpis={d.kpis} />
          <SectionCard title="Как считается">
            <div className="flex flex-col">
              {d.kpis.map((k) => (
                <div
                  key={k.key}
                  className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2.4fr)_120px_120px] gap-4 border-t border-line py-2.5 text-[13px] max-md:grid-cols-1 max-md:gap-1"
                >
                  <span className="font-semibold">{k.label}</span>
                  <span className="text-muted">{k.how}</span>
                  <span>Цель: {kpiGoal(k)}</span>
                  <span className="text-bad-ink">Красный: {kpiRed(k)}</span>
                </div>
              ))}
            </div>
            <Legend
              items={[
                ["grn", "цель выполнена"],
                ["amb", "хуже цели, но не в красной зоне"],
                ["red", "в красной зоне — разбор на встрече"],
                ["na", "в трекере не хватает дат"],
              ]}
            />
          </SectionCard>
          <div className="rounded-card bg-surface px-6 py-5 text-sm text-muted-2">
            KPI по менеджерам и динамика за последние загрузки появятся на
            следующем этапе.
          </div>
        </>
      )}
    </Page>
  );
}
