import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import clsx from "clsx";
import {
  getRgsProduct, getRgsProducts, rgsExportUrl,
} from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { StageChip } from "../components/rgs/chips";
import { RgsGate } from "../components/rgs/RgsGate";
import { useFetch } from "../hooks/useFetch";
import { useSession } from "../hooks/useSession";
import { formatDate } from "../lib/format";
import { CATEGORY_LABEL, RGS_STAGES } from "../lib/rgs";
import type { RgsProduct, RgsRow } from "../types/rgs";

export default function RgsProductsPage() {
  const code = (useParams().code ?? "").toUpperCase();
  return (
    <RgsGate code={code}>
      {(meta) => <Products code={code} dataDate={meta.data_date ?? null} />}
    </RgsGate>
  );
}

function Products({ code, dataDate }: { code: string; dataDate: string | null }) {
  const [search, setSearch] = useSearchParams();
  const stage = search.get("stage") ?? "";
  const q = search.get("q") ?? "";
  const picked = Number(search.get("item")) || null;
  const [text, setText] = useState(q);
  const { can } = useSession();

  const set = (patch: Record<string, string | null>) =>
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: "item" in patch });

  const params: Record<string, string> = {};
  if (stage) params.stage = stage;
  if (q) params.q = q;
  const data = useFetch(
    (signal) => getRgsProducts(code, params, signal),
    [code, stage, q],
    "Не удалось загрузить препараты",
  );
  const d = data.data;
  const selected = picked ?? d?.items[0]?.id ?? null;
  const tabs = [
    { key: "", label: "Все" },
    ...RGS_STAGES.filter((s) => s.key !== "ru" || (d?.counts.ru ?? 0) > 0),
  ];

  return (
    <Page maxWidth={1320} dim={data.loading && !!data.data}>
      <PageHeader
        title="Препараты"
        subtitle={`Данные трекера на ${formatDate(dataDate)}`}
      >
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: text.trim() || null, item: null });
          }}
          className="flex w-[300px] items-center gap-2 rounded-full bg-surface px-4 py-2.5 max-md:w-full"
        >
          <Search size={16} className="shrink-0 text-faint" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => set({ q: text.trim() || null })}
            placeholder="Препарат, МНН или завод"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          />
        </form>
        {can("export:xlsx") && (
          <a
            href={rgsExportUrl(code, params)}
            className="tr-soft flex h-[42px] items-center gap-2 rounded-full bg-surface px-4 text-[13px] text-fg hover:bg-subtle"
          >
            <Download size={14} />
            Excel
          </a>
        )}
      </PageHeader>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = stage === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => set({ stage: t.key || null, item: null })}
              className={clsx(
                "tr-soft flex items-center gap-2 rounded-full border-0 px-3.5 py-2 text-[13px]",
                active
                  ? "bg-fg font-medium text-white"
                  : "bg-surface text-muted hover:text-fg",
              )}
            >
              {t.label}
              <span
                className={clsx(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-white/20" : "bg-subtle text-muted",
                )}
              >
                {d?.counts[t.key] ?? "…"}
              </span>
            </button>
          );
        })}
      </div>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-16" />}
      {d && (
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 max-lg:grid-cols-1">
          <Table
            rows={d.items}
            selected={selected}
            onPick={(id) => set({ item: String(id) })}
          />
          {selected && <Card code={code} id={selected} />}
        </div>
      )}
    </Page>
  );
}

function Table({
  rows, selected, onPick,
}: {
  rows: RgsRow[];
  selected: number | null;
  onPick: (id: number) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card bg-surface px-6 py-12 text-center text-sm text-muted-2">
        Ничего не найдено.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-card bg-surface px-3 py-2">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="px-3 py-2.5 font-normal">Препарат</th>
            <th className="px-3 py-2.5 font-normal">Этап</th>
            <th className="px-3 py-2.5 font-normal">Подано</th>
            <th className="px-3 py-2.5 font-normal">План РУ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onPick(r.id)}
              className={clsx(
                "tr-soft cursor-pointer border-t border-line",
                r.id === selected ? "bg-accent-tint" : "hover:bg-subtle",
              )}
            >
              <td className="px-3 py-3">
                <span className="flex flex-col leading-tight">
                  <span className="flex items-center gap-2 font-semibold">
                    {r.tm}
                    {r.is_new && (
                      <span className="rounded-full bg-lime px-1.5 text-[10px] font-semibold text-rgs-ink">
                        новый
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-2">
                    {[r.form, r.dose, r.pack && `уп. ${r.pack}`]
                      .filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-[11px] text-faint">
                    {[r.manufacturer, r.category].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </td>
              <td className="px-3 py-3"><StageChip stage={r.stage} /></td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                {r.submitted ? formatDate(r.submitted) : r.plan_submit ? (
                  <span className={clsx(r.overdue ? "text-bad" : "text-muted-2")}>
                    план {formatDate(r.plan_submit)}
                  </span>
                ) : <span className="text-faint">—</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                {r.plan_ru ? formatDate(r.plan_ru) : (
                  <span className="text-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ code, id }: { code: string; id: number }) {
  const data = useFetch(
    (signal) => getRgsProduct(code, id, signal),
    [code, id],
    "Не удалось открыть препарат",
  );
  const p = data.loading ? null : data.data;
  return (
    <aside className="sticky top-4 flex flex-col gap-5 rounded-card bg-rgs-ink px-6 py-6 text-white max-lg:static">
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!p && !data.error && <Loading className="py-16 text-white/70" />}
      {p && <CardBody p={p} />}
    </aside>
  );
}

function CardBody({ p }: { p: RgsProduct }) {
  const plan = p.timeline.filter((t) => t.date);
  const docs = p.docs.filter((x) => x.ok).length;
  const shift = p.shift;
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.06em] text-white/60">
          {[p.manufacturer, CATEGORY_LABEL[p.category ?? ""] ?? p.category]
            .filter(Boolean).join(" · ")}
        </span>
        <span className="text-2xl font-semibold tracking-[-0.01em]">{p.tm}</span>
        {p.tm_ru && <span className="text-sm text-white/70">{p.tm_ru}</span>}
        <span className="text-[13px] text-white/85">
          {[p.form, p.dose, p.pack && `уп. ${p.pack}`]
            .filter(Boolean).join(" · ")}
        </span>
        {p.generic && (
          <span className="text-xs uppercase text-white/55">{p.generic}</span>
        )}
        <span className="mt-2">
          <StageChip stage={p.stage} className="ring-1 ring-white/35" />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Box label="План подачи" value={formatDate(p.plan_submit)} />
        <Box label="Факт" value={formatDate(p.submitted)} />
        <Box
          label="Сдвиг"
          value={shift == null ? "—" : `${shift > 0 ? "+" : ""}${shift} дн.`}
          tone={shift == null ? undefined : shift > 0 ? "bad" : "good"}
        />
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {p.timeline.map((t) => (
          <li key={t.key} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={clsx(
                "size-2 shrink-0 rounded-full",
                t.date ? "bg-lime" : "bg-white/20",
              )}
            />
            <span className={clsx("flex-1", !t.date && "text-white/45")}>
              {t.label}
            </span>
            <span className="font-semibold tabular-nums">
              {t.date ? formatDate(t.date) : "—"}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2.5 text-[13px]">
          <span className="size-2 shrink-0 rounded-full border border-lime" />
          <span className="flex-1">План РУ</span>
          <span className="font-semibold tabular-nums">
            {formatDate(p.plan_ru)}
          </span>
        </li>
      </ul>
      {plan.length === 0 && (
        <span className="text-xs text-white/55">Дат пока нет.</span>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-white/60">
          Документы · {docs} из {p.docs.length}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {p.docs.map((x) => (
            <span
              key={x.name}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                x.ok ? "bg-lime text-rgs-ink" : "bg-white/10 text-white/50",
              )}
            >
              {x.name}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-inner bg-white/[0.07] px-4 py-3">
        <span className="text-xs text-white/60">
          Комментарий ответственного{p.owner ? ` · ${p.owner}` : ""}
        </span>
        <span className="whitespace-pre-line text-[13px]">
          {p.comment ?? "—"}
        </span>
      </div>
    </>
  );
}

function Box({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-white/[0.07] px-3 py-2.5">
      <span className="text-[11px] text-white/60">{label}</span>
      <span
        className={clsx(
          "text-sm font-semibold tabular-nums",
          tone === "bad" && "text-lime",
          tone === "good" && "text-pos-on-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
