import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { formatDate, formatInt } from "../../lib/format";
import {
  TABS, formatPrice, makerStripe, pluralOffers,
} from "../../lib/vpc";
import type { VpcItem, VpcOffersResponse } from "../../types/vpc";
import { CountryCode, StatusBadge } from "./chips";

interface Column {
  key: string;
  label: string;
  sort?: string;
  align?: "right";
}

const COLUMNS: Column[] = [
  { key: "maker", label: "Завод", sort: "maker" },
  { key: "product", label: "Продукт", sort: "generic" },
  { key: "target", label: "Для", sort: "target" },
  { key: "agreed", label: "Согл. цена", sort: "agreed", align: "right" },
  { key: "usd", label: "Цена в USD", sort: "usd", align: "right" },
  { key: "to_min", label: "К лучшей", sort: "to_min" },
  { key: "status", label: "Статус", sort: "status" },
  { key: "people", label: "БДМ / аналитик" },
  {
    key: "responsible", label: "Ответственный", sort: "responsible",
  },
  { key: "comment", label: "Последний комментарий" },
  { key: "updated", label: "Обновлено", sort: "updated", align: "right" },
];

export function OffersTable({
  data, tab, sort, desc, page, pageSize, product, loading,
  onTab, onSort, onPage, onOpen,
}: {
  data: VpcOffersResponse;
  tab: string;
  sort: string;
  desc: boolean;
  page: number;
  pageSize: number;
  product: boolean;
  loading: boolean;
  onTab: (tab: string) => void;
  onSort: (sort: string, desc: boolean) => void;
  onPage: (page: number) => void;
  onOpen: (id: number) => void;
}) {
  const columns = COLUMNS.filter((c) => !(c.key === "product" && product));

  const from = data.total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, data.total);
  const pages = Math.max(1, Math.ceil(data.total / pageSize));
  const maxPct = Math.max(1, ...data.items.map((i) => i.to_min ?? 0));

  return (
    <section className="anim-rise flex min-w-0 flex-col gap-4 rounded-card bg-surface px-6 py-6 max-md:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[19px] font-semibold tracking-[-0.01em]">
            Все предложения
          </span>
          <span className="text-[13px] text-faint">
            {formatInt(data.total)} {pluralOffers(data.total)}
            {sort === "price" && !desc && " · по возрастанию цены"}
            {" · бледные — остановлены"}
          </span>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <div
            role="tablist"
            className="scrollbar-none flex max-w-full overflow-x-auto rounded-xl bg-subtle p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => onTab(t.value)}
                className={clsx(
                  "tr-soft whitespace-nowrap rounded-[9px] border-0 px-3 py-1.5 text-[13px]",
                  tab === t.value
                    ? "bg-white font-semibold text-fg shadow-seg-active"
                    : "bg-transparent text-muted-2 hover:text-fg",
                )}
              >
                {t.label} {formatInt(data.tabs[t.value] ?? 0)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className={clsx(
          "tr-soft overflow-x-auto",
          loading && "opacity-60",
        )}
      >
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs text-faint">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={clsx(
                    "whitespace-nowrap px-3 py-2.5 font-normal",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => onSort(
                        c.sort!, c.sort === sort ? !desc : false,
                      )}
                      className={clsx(
                        "tr-soft inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs hover:text-fg",
                        c.sort === sort ? "text-fg" : "text-faint",
                      )}
                    >
                      {c.label}
                      {c.sort === sort ? (desc
                        ? <ArrowDown size={11} />
                        : <ArrowUp size={11} />)
                        : <ArrowUpDown size={11} className="opacity-50" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr
                key={row.id}
                onClick={() => onOpen(row.id)}
                className={clsx(
                  "tr-soft cursor-pointer border-b border-line hover:bg-subtle",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(
                      "px-3 align-middle",
                      "py-1.5",
                      c.align === "right" && "text-right",
                    )}
                  >
                    <Cell column={c.key} row={row} maxPct={maxPct} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <div className="py-12 text-center text-sm text-faint">
            В этой вкладке предложений нет
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          Показано <b className="text-fg">{from}–{to}</b> из{" "}
          <b className="text-fg">{formatInt(data.total)}</b>
        </span>
        {pages > 1 ? (
          <span className="flex items-center gap-1">
            <PageButton
              label="Предыдущая страница"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              <ChevronLeft size={15} />
            </PageButton>
            <span className="px-2 tabular-nums">
              {page} / {pages}
            </span>
            <PageButton
              label="Следующая страница"
              disabled={page >= pages}
              onClick={() => onPage(page + 1)}
            >
              <ChevronRight size={15} />
            </PageButton>
          </span>
        ) : (
          <span className="text-faint max-md:hidden">
            Нажмите на строку — откроется карточка предложения
          </span>
        )}
      </div>
    </section>
  );
}

function PageButton({
  label, disabled, onClick, children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="tr-soft flex size-8 items-center justify-center rounded-lg border border-line-strong bg-transparent text-fg enabled:hover:bg-subtle disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Cell({
  column, row, maxPct,
}: {
  column: string;
  row: VpcItem;
  maxPct: number;
}) {
  switch (column) {
    case "maker":
      return (
        <span className="flex items-stretch gap-3">
          <span
            className="w-[3px] shrink-0 rounded-full"
            style={{ background: makerStripe(row.maker_country) }}
          />
          <span className="flex min-w-0 max-w-[280px] flex-col leading-tight">
            <b
              className="truncate font-semibold uppercase"
              title={row.maker ?? ""}
            >
              {row.maker ?? "—"}
            </b>
            <span className="truncate text-xs text-faint">
              {[row.maker_country, row.pack_n ? `№${row.pack_n}` : null]
                .filter(Boolean).join(" · ") || "—"}
            </span>
          </span>
        </span>
      );
    case "product":
      return (
        <span className="flex max-w-[280px] flex-col leading-tight">
          <span className="truncate font-medium" title={row.generic}>
            {row.generic}
          </span>
          <span className="truncate text-xs text-faint">
            {[row.form, row.dose].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
      );
    case "target":
      return <CountryCode code={row.target_country} />;
    case "agreed":
      return row.price_agreed == null ? (
        <span className="text-faint">—</span>
      ) : (
        <span className="whitespace-nowrap">
          <span className="font-mono text-[13px] font-medium tabular-nums">
            {formatPrice(row.price_agreed)}
          </span>{" "}
          <span className="text-[11px] text-faint">
            {row.agreed_currency}
          </span>
        </span>
      );
    case "usd":
      return row.price_usd == null ? (
        <span className="text-faint">—</span>
      ) : (
        <span className="whitespace-nowrap">
          <span className="font-mono text-[13px] font-medium tabular-nums">
            {formatPrice(row.price_usd)}
          </span>{" "}
          <span className="text-[11px] text-faint">USD</span>
        </span>
      );
    case "to_min":
      return <ToMin value={row.to_min} max={maxPct} />;
    case "status":
      return (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <StatusBadge
            code={row.status_code}
            state={row.state}
            raw={row.status_raw}
          />
          <span className="text-[11px] text-faint">
            {row.status_name}
            {row.days != null && ` · ${row.days} дн.`}
          </span>
        </span>
      );
    case "people":
      return (
        <span className="flex max-w-[220px] flex-col leading-tight">
          <span className="truncate" title={row.bdm ?? ""}>
            {row.bdm ?? "—"}
          </span>
          <span className="truncate text-faint" title={row.analyst ?? ""}>
            {row.analyst ?? "—"}
          </span>
        </span>
      );
    case "comment":
      return <Comment text={row.last_comment} date={row.last_comment_date} />;
    case "responsible":
      return row.responsible ? (
        <span className="whitespace-nowrap rounded-md bg-subtle px-2 py-1 text-xs font-semibold text-fg-2">
          {row.responsible}
        </span>
      ) : (
        <span className="text-faint">—</span>
      );
    case "updated":
      return (
        <span className="whitespace-nowrap font-mono text-xs text-faint">
          {formatDate(row.updated_at)}
        </span>
      );
    default:
      return null;
  }
}

function ToMin({ value, max }: { value: number | null; max: number }) {
  if (value == null) return <span className="text-faint">—</span>;
  const best = value === 0;
  const high = value >= 40;
  return (
    <span className="flex w-[140px] items-center gap-2">
      <span className="h-1.5 flex-1 rounded-full bg-track">
        <span
          className={clsx(
            "block h-full rounded-full",
            best ? "bg-st-result" : high ? "bg-bad/60" : "bg-accent-soft",
          )}
          style={{ width: `${best ? 4 : Math.max((value / max) * 100, 4)}%` }}
        />
      </span>
      <span
        className={clsx(
          "w-12 text-right text-xs tabular-nums",
          best ? "font-semibold text-pos"
            : high ? "text-bad-ink" : "text-muted",
        )}
      >
        {best ? "лучшая" : `+${value}%`}
      </span>
    </span>
  );
}

function Comment({
  text, date,
}: {
  text: string | null;
  date: string | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<
    { x: number; y: number; up: boolean } | null
  >(null);
  if (!text) return <span className="text-faint">—</span>;

  const show = () => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const zoom = Number(
      getComputedStyle(document.documentElement).zoom,
    ) || 1;
    const box = el.getBoundingClientRect();
    const left = box.left / zoom;
    const top = box.top / zoom;
    const bottom = box.bottom / zoom;
    const width = 420;
    const up = bottom > window.innerHeight / zoom - 180;
    setAt({
      x: Math.max(8, Math.min(left, window.innerWidth / zoom - width - 8)),
      y: up ? top - 6 : bottom + 6,
      up,
    });
  };

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
      className="block min-w-[180px] max-w-[300px] truncate text-[13px] text-fg-2"
    >
      {text}
      {at && createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-50 w-[420px]"
          style={{
            left: at.x,
            top: at.y,
            transform: at.up ? "translateY(-100%)" : undefined,
          }}
        >
          <span className="anim-pop flex flex-col gap-1 rounded-xl bg-white px-3.5 py-2.5 text-[13px] leading-snug text-fg shadow-pop">
            {date && (
              <span className="text-[11px] text-faint">
                {formatDate(date)}
              </span>
            )}
            {text}
          </span>
        </span>,
        document.body,
      )}
    </span>
  );
}
