import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getRgsChanges, type RgsParams } from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { RgsGate } from "../components/rgs/RgsGate";
import { SectionCard, Seg } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { formatDate } from "../lib/format";
import { CATEGORIES, rgsUrl, signed } from "../lib/rgs";
import type { RgsBriefRow, RgsChanges } from "../types/rgs";

type Cat = (typeof CATEGORIES)[number]["value"];

export default function RgsMeetingPage() {
  const code = (useParams().code ?? "").toUpperCase();
  return <RgsGate code={code}>{() => <Meeting code={code} />}</RgsGate>;
}

function Meeting({ code }: { code: string }) {
  const [search, setSearch] = useSearchParams();
  const cat = (search.get("cat") ?? "") as Cat;
  const base = search.get("base") ?? "";
  const params: RgsParams = { cat, base };
  const data = useFetch(
    (signal) => getRgsChanges(code, params, signal),
    [code, cat, base],
    "Не удалось загрузить сравнение",
  );
  const d = data.data;
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearch(next);
  };
  return (
    <Page maxWidth={1080} dim={data.loading && !!data.data}>
      <PageHeader
        title="Что изменилось к встрече"
        subtitle={d?.base
          ? `Снимок ${formatDate(d.current.date)} против ${formatDate(d.base.date)}`
          : "Сравнение двух загрузок трекера"}
      >
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Seg
            label="Категория"
            options={CATEGORIES}
            value={cat}
            onChange={(v) => set("cat", v)}
          />
          {d && d.snapshots.length > 0 && (
            <label className="flex items-center gap-2 text-[13px] text-muted">
              Сравнить с
              <select
                className="h-9 rounded-full bg-surface px-3 text-[13px] text-fg"
                value={base || String(d.base?.id ?? "")}
                onChange={(e) => set("base", e.target.value)}
              >
                {d.snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.date)} · {s.file_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {d?.base && (
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 rounded-full bg-fg px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Скачать PDF
            </button>
          )}
        </div>
      </PageHeader>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && !d.base && (
        <SectionCard title="Пока не с чем сравнить">
          <span className="text-sm text-muted">
            Загружен один снимок трекера — от {formatDate(d.current.date)}.
            Сравнение появится после следующей загрузки.
          </span>
        </SectionCard>
      )}
      {d?.base && <Blocks code={code} d={d} />}
    </Page>
  );
}

function Product({ code, r, children }: {
  code: string;
  r: RgsBriefRow;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
      <Link
        to={`${rgsUrl(code, "products")}?item=${r.id}`}
        className="flex min-w-0 flex-col leading-tight text-fg hover:underline"
      >
        <span className="font-semibold">{r.tm}</span>
        <span className="truncate text-xs text-faint">
          {[r.sub, r.manager].filter(Boolean).join(" · ")}
        </span>
      </Link>
      <span className="shrink-0 text-right text-[13px] tabular-nums">{children}</span>
    </li>
  );
}

function Block({ title, note, empty, children, count }: {
  title: string;
  note?: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <SectionCard
      title={<>{title} <span className="text-faint">{count}</span></>}
      note={note}
      className="break-inside-avoid print:border print:border-line"
    >
      {count === 0
        ? <span className="text-sm text-muted">{empty}</span>
        : <ul className="flex flex-col text-sm">{children}</ul>}
    </SectionCard>
  );
}

function Blocks({ code, d }: { code: string; d: RgsChanges }) {
  const red = d.new_red ?? [];
  const moved = d.moved ?? [];
  const plans = d.plan_moves ?? [];
  const soon = d.ru_soon ?? [];
  const added = d.added ?? [];
  return (
    <>
      <Block
        title="Новые красные"
        note="Стали красными с прошлого снимка — разбор на встрече"
        empty="Новых красных нет"
        count={red.length}
      >
        {red.map((r) => (
          <Product key={`${r.id}${r.metric}`} code={code} r={r}>
            <span className="rounded-full bg-bad-tint px-2 py-0.5 text-bad-ink">
              {r.label}
              {r.value != null && ` · ${r.metric === "delay" ? signed(r.value) : r.value} дн.`}
            </span>
          </Product>
        ))}
      </Block>
      <Block
        title="Перешли в следующую группу"
        empty="Никто не сменил группу статусов"
        count={moved.length}
      >
        {moved.map((r) => (
          <Product key={r.id} code={code} r={r}>
            <span className="text-muted">{r.from}</span> → <b className="font-semibold">{r.to}</b>
          </Product>
        ))}
      </Block>
      <Block
        title="Переносы плана подачи"
        note="Колонка «Пл ПД» изменилась между снимками"
        empty="План подачи не переносили"
        count={plans.length}
      >
        {plans.map((r) => (
          <Product key={r.id} code={code} r={r}>
            {formatDate(r.old)} → {formatDate(r.new)}
            <span className="ml-2 text-faint">{signed(r.days)} дн.</span>
          </Product>
        ))}
      </Block>
      <Block
        title="План РУ в ближайшие 60 дней"
        empty="Ни у кого план РУ не наступает в ближайшие 60 дней"
        count={soon.length}
      >
        {soon.map((r) => (
          <Product key={r.id} code={code} r={r}>
            {formatDate(r.plan)}
            <span className="ml-2 text-warn-ink">через {r.days} дн.</span>
          </Product>
        ))}
      </Block>
      {added.length > 0 && (
        <Block title="Новые в трекере" empty="" count={added.length}>
          {added.map((r) => <Product key={r.id} code={code} r={r} />)}
        </Block>
      )}
    </>
  );
}
