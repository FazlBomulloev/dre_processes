import type { ReactNode } from "react";
import { formatInt } from "../../lib/format";
import {
  DETECTED_LABELS, PRICE_SOURCES, STATE_COLORS, STATE_LABELS, STATE_ORDER,
} from "../../lib/vpc";
import type { VpcReport } from "../../types/api";
import { KpiGrid, PanelSection } from "../ui/SidePanel";

function Note({
  tone, title, children,
}: {
  tone: "warn" | "bad";
  title: string;
  children: ReactNode;
}) {
  const style = tone === "bad"
    ? "bg-bad-tint text-bad-ink"
    : "bg-warn-tint text-warn-ink";
  return (
    <div className={`flex flex-col gap-1 rounded-inner px-4 py-3 text-sm ${style}`}>
      <span className="font-semibold">{title}</span>
      <span>{children}</span>
    </div>
  );
}

function Chips({ items }: { items: [string, number][] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([label, count]) => (
        <span
          key={label}
          className="rounded-full bg-subtle px-3 py-1 text-[13px]"
        >
          {label} <b className="font-semibold">{formatInt(count)}</b>
        </span>
      ))}
    </div>
  );
}

export function VpcReportView({ report }: { report: VpcReport }) {
  const states = STATE_ORDER
    .filter((s) => report.states[s])
    .map((s) => [s, report.states[s]] as const);
  const total = report.rows_loaded || 1;
  const unknown = Object.entries(report.unknown_statuses);

  return (
    <>
      <KpiGrid
        items={[
          { label: "Загружено", value: formatInt(report.rows_loaded) },
          { label: "Строк в файле", value: formatInt(report.rows_read) },
          { label: "С ценой", value: formatInt(report.with_price) },
          { label: "Дубли номера", value: formatInt(report.duplicates) },
          {
            label: "Без МНН",
            value: formatInt(report.skipped_no_generic),
          },
          { label: "Плохие даты", value: formatInt(report.bad_dates) },
        ]}
      />

      {(unknown.length > 0 || report.missing_fields.length > 0
        || report.duplicate_headers.length > 0
        || report.new_markets.length > 0) && (
        <div className="flex flex-col gap-2">
          {unknown.length > 0 && (
            <Note tone="bad" title={
              `Не распознан статус у ${formatInt(report.unknown_total)} `
              + "предложений"
            }>
              {unknown.map(([code, n]) => `«${code}» — ${n}`).join(", ")}
            </Note>
          )}
          {report.missing_fields.length > 0 && (
            <Note tone="warn" title="Колонки не найдены, поля пустые">
              {report.missing_fields.join(", ")}
            </Note>
          )}
          {report.duplicate_headers.length > 0 && (
            <Note tone="warn" title="Повторяются заголовки, взята первая">
              {report.duplicate_headers.join(", ")}
            </Note>
          )}
          {report.new_markets.length > 0 && (
            <Note tone="warn" title="Добавлены новые рынки">
              {report.new_markets.join(", ")} — включите модули на
              странице «Рынки», если нужно.
            </Note>
          )}
        </div>
      )}

      <PanelSection title="Состояния">
        <div className="flex h-3 overflow-hidden rounded-full bg-track">
          {states.map(([s, n]) => (
            <span
              key={s}
              title={`${STATE_LABELS[s]}: ${n}`}
              style={{ width: `${(n / total) * 100}%`, background: STATE_COLORS[s] }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-2">
          {states.map(([s, n]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-[3px]"
                style={{ background: STATE_COLORS[s] }}
              />
              {STATE_LABELS[s]} {formatInt(n)}
            </span>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Для какой страны ищем">
        <Chips items={Object.entries(report.targets)} />
      </PanelSection>

      <PanelSection title="Откуда взята цена">
        <Chips
          items={Object.entries(report.price_sources).map(
            ([k, v]) => [PRICE_SOURCES[k] ?? k, v],
          )}
        />
        <span className="text-xs text-faint">
          Валюта: {Object.keys(report.currencies).join(", ") || "—"}
        </span>
      </PanelSection>

      <PanelSection title="Разбор файла">
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[13px]">
          <dt className="text-faint">Лист</dt>
          <dd className="m-0">{report.sheet}</dd>
          <dt className="text-faint">Строка шапки</dt>
          <dd className="m-0">{report.header_row}</dd>
          <dt className="text-faint">Колонок</dt>
          <dd className="m-0">{report.columns}</dd>
          {Object.entries(report.detected).map(([field, column]) => (
            <FieldRow
              key={field}
              label={DETECTED_LABELS[field] ?? field}
              value={`«${column}» (по содержимому)`}
            />
          ))}
          {report.missing_stage_dates.length > 0 && (
            <FieldRow
              label="Нет дат этапов"
              value={report.missing_stage_dates.join(", ")}
            />
          )}
        </dl>
        {report.extra_columns.length > 0 && (
          <details className="text-[13px] text-muted-2">
            <summary className="cursor-pointer">
              Колонки в блоке «Условия»: {report.extra_columns.length}
            </summary>
            <p className="mb-0 mt-2">{report.extra_columns.join(", ")}</p>
          </details>
        )}
      </PanelSection>
    </>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-faint">{label}</dt>
      <dd className="m-0">{value}</dd>
    </>
  );
}
