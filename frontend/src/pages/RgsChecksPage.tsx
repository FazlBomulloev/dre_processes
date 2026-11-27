import { Link, useParams, useSearchParams } from "react-router-dom";
import { getRgsChecks, type RgsParams } from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { RgsGate } from "../components/rgs/RgsGate";
import { Seg } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { formatDate } from "../lib/format";
import { CATEGORIES, rgsUrl } from "../lib/rgs";

type Cat = (typeof CATEGORIES)[number]["value"];

const KIND_LABEL: Record<string, string> = {
  status: "Статус",
  unknown: "Код статуса",
  order: "Порядок дат",
  future: "Дата в будущем",
  no_plan: "Нет Пл ПД",
  no_category: "Нет категории",
  step: "Срок шага",
};

export default function RgsChecksPage() {
  const code = (useParams().code ?? "").toUpperCase();
  return (
    <RgsGate code={code}>
      {(meta) => <Checks code={code} dataDate={meta.data_date ?? null} />}
    </RgsGate>
  );
}

function Checks({ code, dataDate }: { code: string; dataDate: string | null }) {
  const [search, setSearch] = useSearchParams();
  const cat = (search.get("cat") ?? "") as Cat;
  const params: RgsParams = cat ? { cat } : {};
  const data = useFetch(
    (signal) => getRgsChecks(code, params, signal),
    [code, cat],
    "Не удалось загрузить проверки",
  );
  const d = data.data;
  return (
    <Page maxWidth={1180} dim={data.loading && !!data.data}>
      <PageHeader
        title={`Проверить данные${d ? ` · ${d.count}` : ""}`}
        subtitle={`Данные трекера на ${formatDate(dataDate)} · исправлять в Excel, затем загрузить трекер заново`}
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
      {d && d.count === 0 && (
        <div className="rounded-card bg-surface px-6 py-12 text-center text-sm text-muted-2">
          Ошибок в трекере не найдено.
        </div>
      )}
      {d && d.count > 0 && (
        <div className="overflow-x-auto rounded-card bg-surface px-3 py-2">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="px-3 py-2.5 font-normal">Препарат</th>
                <th className="px-3 py-2.5 font-normal">Менеджер</th>
                <th className="px-3 py-2.5 font-normal">Что не так</th>
                <th className="px-3 py-2.5 text-right font-normal">Строка Excel</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((c, i) => (
                <tr key={`${c.id}:${c.kind}:${i}`} className="border-t border-line align-top">
                  <td className="px-3 py-3">
                    <Link
                      to={`${rgsUrl(code, "products")}?item=${c.id}`}
                      className="flex flex-col leading-tight text-fg hover:text-accent"
                    >
                      <span className="font-semibold">{c.tm}</span>
                      <span className="text-xs text-muted-2">{c.sub}</span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {c.manager ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex flex-col gap-1">
                      <span className="w-fit rounded-full bg-warn-tint px-2 py-0.5 text-[11px] font-semibold text-warn-ink">
                        {KIND_LABEL[c.kind] ?? c.kind}
                      </span>
                      <span className="text-[13px]">{c.text}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted">
                    {c.sheet ? `${c.sheet} · ` : ""}{c.row ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
