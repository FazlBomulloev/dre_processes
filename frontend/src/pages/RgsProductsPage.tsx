import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import clsx from "clsx";
import {
  getRgsProduct, getRgsProducts, rgsExportUrl, type RgsParams,
} from "../api/rgs";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { StatusCode, TonePill } from "../components/rgs/chips";
import { RgsGate } from "../components/rgs/RgsGate";
import { FilterPill } from "../components/vpc/FilterPill";
import { Seg } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { useSession } from "../hooks/useSession";
import { formatDate } from "../lib/format";
import {
  CATEGORIES, CATEGORY_LABEL, RGS_GROUPS, TONE_DOT_INK, signed,
} from "../lib/rgs";
import { plural } from "../lib/vpc";
import type { RgsProduct, RgsRow, RgsRuPlan, RgsStep } from "../types/rgs";

type Cat = (typeof CATEGORIES)[number]["value"];

const FLAGS = [
  { key: "red_cycle", label: "Красный цикл" },
  { key: "red_ru", label: "Красный по РУ" },
  { key: "check", label: "Проверить данные" },
  { key: "stop", label: "Стоп" },
];

export default function RgsProductsPage() {
  const code = (useParams().code ?? "").toUpperCase();
  return (
    <RgsGate code={code}>
      {(meta) => <Products code={code} dataDate={meta.data_date ?? null} />}
    </RgsGate>
  );
}

function days(n: number): string {
  return `${n} ${plural(Math.abs(n), "день", "дня", "дней")}`;
}

function Products({ code, dataDate }: { code: string; dataDate: string | null }) {
  const [search, setSearch] = useSearchParams();
  const view = search.get("view") ?? "";
  const q = search.get("q") ?? "";
  const cat = (search.get("cat") ?? "") as Cat;
  const mgr = search.get("mgr") ?? "";
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
    }, { replace: "item" in patch && Object.keys(patch).length === 1 });

  const params: RgsParams = {};
  if (view) params.view = view;
  if (q) params.q = q;
  if (cat) params.cat = cat;
  if (mgr) params.mgr = mgr;
  const data = useFetch(
    (signal) => getRgsProducts(code, params, signal),
    [code, view, q, cat, mgr],
    "Не удалось загрузить препараты",
  );
  const d = data.data;
  const selected = picked ?? d?.items[0]?.id ?? null;
  const tabs = [
    { key: "", label: "Все" },
    ...RGS_GROUPS.filter((g) => g.key !== "ru" || (d?.counts.ru ?? 0) > 0),
    ...FLAGS,
  ];

  return (
    <Page maxWidth={1440} dim={data.loading && !!data.data}>
      <PageHeader
        title="Препараты"
        subtitle={`Данные трекера на ${formatDate(dataDate)} · только просмотр`}
      >
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: text.trim() || null, item: null });
          }}
          className="flex w-[280px] items-center gap-2 rounded-full bg-surface px-4 py-2.5 max-md:w-full"
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
      <div className="flex flex-wrap items-center gap-3">
        <Seg
          label="Категория"
          options={CATEGORIES}
          value={cat}
          onChange={(v) => set({ cat: v || null, item: null })}
        />
        <FilterPill
          label="Менеджер"
          value={mgr}
          options={d?.managers.map((m) => ({ value: m.name, count: m.count }))}
          onChange={(v) => set({ mgr: v, item: null })}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => set({ view: t.key || null, item: null })}
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
        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-5 max-xl:grid-cols-1">
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

function RuCell({ ru }: { ru: RgsRuPlan }) {
  if (!ru.plan) return <span className="text-faint">нет плана</span>;
  let text = "";
  if (ru.got) text = ru.late && ru.late > 0 ? `+${ru.late} дн.` : "получено";
  else if (ru.days != null) text = ru.days < 0 ? `−${-ru.days} дн.` : `${ru.days} дн.`;
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="tabular-nums">{formatDate(ru.plan)}</span>
      <TonePill tone={ru.tone}>{text}</TonePill>
    </span>
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
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="px-3 py-2.5 font-normal">Препарат</th>
            <th className="px-3 py-2.5 font-normal">Менеджер</th>
            <th className="px-3 py-2.5 font-normal">Статус</th>
            <th className="px-3 py-2.5 font-normal">Подача: план → факт</th>
            <th className="px-3 py-2.5 font-normal">Цикл до подачи</th>
            <th className="px-3 py-2.5 font-normal">План РУ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onPick(r.id)}
              className={clsx(
                "tr-soft cursor-pointer border-t border-line align-top",
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
                    {[r.form, r.dose].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-[11px] text-faint">
                    {[r.manufacturer, CATEGORY_LABEL[r.category ?? ""] ?? r.category]
                      .filter(Boolean).join(" · ")}
                  </span>
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-muted">
                {r.manager ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <StatusCode code={r.status_code} />
                {r.status_issue && r.status_by_date && (
                  <span className="ml-1.5 rounded-full bg-warn-tint px-1.5 py-0.5 text-[11px] font-semibold text-warn-ink">
                    ≠ {r.status_by_date}
                  </span>
                )}
                {r.group === "stop" && (
                  <span className="ml-1.5 text-[11px] text-faint">стоп</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <span className="flex flex-col items-start gap-1">
                  <span className="tabular-nums text-muted">
                    {formatDate(r.plan_submit)} → {formatDate(r.submitted)}
                  </span>
                  {r.delay.fact == null ? (
                    <TonePill tone="na">нет плана</TonePill>
                  ) : (
                    <TonePill tone={r.delay.tone}>
                      {signed(r.delay.fact)} дн.
                      {r.delay.running && r.delay.fact > 0 && " · не подано"}
                    </TonePill>
                  )}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {r.cycle.fact == null ? (
                  <span className="text-faint">—</span>
                ) : (
                  <TonePill tone={r.cycle.tone}>
                    {r.cycle.running && "идёт "}
                    {r.cycle.fact} дн.
                  </TonePill>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <RuCell ru={r.ru} />
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
    <aside className="sticky top-4 flex flex-col gap-5 rounded-card bg-rgs-ink px-6 py-6 text-white max-xl:static">
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!p && !data.error && <Loading className="py-16 text-white/70" />}
      {p && <CardBody p={p} />}
    </aside>
  );
}

function stepDays(s: RgsStep): string {
  if (s.key === "task") return "—";
  const norm = s.norm == null ? "—" : s.norm;
  if (s.fact == null) return `— / ${norm}`;
  const tail = s.total ? " итого" : "";
  return s.running
    ? `идёт ${s.fact} / ${norm}${tail}`
    : `${s.fact} / ${norm}${tail}`;
}

function CardBody({ p }: { p: RgsProduct }) {
  const docs = p.docs.filter((x) => x.ok).length;
  const ru = p.ru;
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.06em] text-white/60">
          {[
            p.manufacturer,
            CATEGORY_LABEL[p.category ?? ""] ?? p.category,
            p.manager,
          ].filter(Boolean).join(" · ")}
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
        <span className="mt-1 text-xs text-white/60">
          Статус в трекере <b className="font-mono text-white">{p.status_code ?? "—"}</b>
          {p.status_by_date && (
            <> · по датам <b className="font-mono text-white">{p.status_by_date}</b></>
          )}
          {p.row != null && ` · строка ${p.row}`}
        </span>
      </div>
      {p.issues.length > 0 && (
        <div className="flex flex-col gap-1 rounded-inner bg-warn-tint px-4 py-3 text-[13px] text-warn-ink">
          <b className="font-semibold">Проверить в трекере</b>
          {p.issues.map((i, n) => <span key={n}>{i.text}</span>)}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Box label="Пл ПД" value={formatDate(p.plan_submit)} />
        <Box label="Подано" value={formatDate(p.submitted)} />
        <Box
          label="Сдвиг"
          value={p.shift == null ? "—" : `${signed(p.shift)} дн.`}
          dot={p.shift == null ? undefined : p.delay.tone}
        />
      </div>
      {p.plan_moves.length > 0 && (
        <div className="flex flex-col gap-1 rounded-inner bg-ink-glass px-4 py-3 text-[13px]">
          <b className="font-semibold">
            План подачи переносился {p.plan_moves.length}{" "}
            {p.plan_moves.length === 1 ? "раз" : p.plan_moves.length < 5 ? "раза" : "раз"}
          </b>
          {p.plan_moves.map((m, n) => (
            <span key={n} className="tabular-nums text-white/70">
              {formatDate(m.old)} → {formatDate(m.new)}
              <span className="text-white/45"> · загрузка {formatDate(m.at)}</span>
            </span>
          ))}
        </div>
      )}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-white/50">
            <th className="pb-1.5 font-normal">Этап</th>
            <th className="pb-1.5 font-normal">Дата</th>
            <th className="pb-1.5 text-right font-normal">Дней / норма</th>
            <th className="w-4 pb-1.5" />
          </tr>
        </thead>
        <tbody>
          {p.steps.map((s) => (
            <tr key={s.key} className="border-t border-ink-line">
              <td className="py-2 pr-2">
                <span className="flex flex-col leading-tight">
                  {s.name}
                  <span className="text-[11px] text-white/45">{s.codes}</span>
                </span>
              </td>
              <td className="whitespace-nowrap py-2 pr-2 tabular-nums">
                {s.date ? formatDate(s.date) : (
                  <span className="text-white/40">нет даты</span>
                )}
              </td>
              <td className="whitespace-nowrap py-2 text-right tabular-nums text-white/85">
                {stepDays(s)}
              </td>
              <td className="py-2 pl-2">
                <span
                  className={clsx("block size-2.5 rounded-full", TONE_DOT_INK[s.tone])}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-2">
        <Box
          label={p.ru_term ? `План РУ (задача + ${p.ru_term})` : "План РУ"}
          value={formatDate(ru.plan)}
        />
        <Box
          label={ru.got ? "РУ получено" : "До плана РУ"}
          value={ruText(ru)}
          dot={ru.tone}
        />
      </div>
      <div className="flex flex-col gap-1.5 rounded-inner bg-white/[0.07] px-4 py-3 text-[13px]">
        <span className="text-xs text-white/60">
          Причина задержки · Следующий шаг (из трекера)
        </span>
        <span>
          {p.reason_code && (
            <b className="mr-2 rounded bg-white/15 px-1.5 py-0.5 font-mono text-xs">
              {p.reason_code}
            </b>
          )}
          {p.next_step ?? <span className="text-white/45">нет данных</span>}
        </span>
        <span className={clsx("text-xs", p.step_overdue ? "font-semibold text-neg-on-ink" : "text-white/60")}>
          срок {p.step_due ? formatDate(p.step_due) : "—"}
          {p.step_overdue && " · просрочен"}
        </span>
      </div>
      {(p.dossier_req || p.dossier_analysis) && (
        <div className="grid grid-cols-2 gap-2">
          <Box label="ЗД · запрос досье" value={formatDate(p.dossier_req)} />
          <Box label="АД · анализ досье" value={formatDate(p.dossier_analysis)} />
        </div>
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
      {p.comments.map((c) => (
        <div
          key={c.label}
          className="flex flex-col gap-1 rounded-inner bg-white/[0.07] px-4 py-3"
        >
          <span className="text-xs text-white/60">{c.label}</span>
          <span className="whitespace-pre-line text-[13px]">{c.text}</span>
        </div>
      ))}
    </>
  );
}

function ruText(ru: RgsRuPlan): string {
  if (!ru.plan) return "нет плана";
  if (ru.got) {
    return ru.late && ru.late > 0
      ? `с опозданием ${days(ru.late)}`
      : "в срок";
  }
  if (ru.days == null) return "—";
  return ru.days < 0 ? `просрочено ${days(-ru.days)}` : `осталось ${days(ru.days)}`;
}

function Box({
  label, value, dot,
}: {
  label: string;
  value: string;
  dot?: keyof typeof TONE_DOT_INK;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-white/[0.07] px-3 py-2.5">
      <span className="text-[11px] text-white/60">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        {dot && <span className={clsx("size-2 rounded-full", TONE_DOT_INK[dot])} />}
        {value}
      </span>
    </div>
  );
}
