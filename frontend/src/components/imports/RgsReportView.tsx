import { formatInt } from "../../lib/format";
import { FIELD_LABELS } from "../../lib/rgs";
import type { RgsChecks, RgsReport } from "../../types/rgs";
import { KpiGrid, PanelSection } from "../ui/SidePanel";

const KIND_LABEL: Record<string, string> = {
  status: "Статус",
  unknown: "Код статуса",
  order: "Порядок дат",
  future: "Дата в будущем",
  no_plan: "Нет «Пл ПД»",
  no_category: "Нет категории",
  step: "Срок шага",
};

function Checks({ checks }: { checks: RgsChecks }) {
  return (
    <PanelSection
      title={`Проверить данные · ${formatInt(checks.count)}`}
      note="Ошибки в трекере: исправьте в Excel и загрузите заново"
    >
      {checks.count === 0 ? (
        <span className="text-sm text-muted">Ошибок в трекере не найдено.</span>
      ) : (
        <div className="flex flex-col text-[13px]">
          {checks.items.map((c, i) => (
            <div
              key={`${c.sheet}:${c.row}:${c.kind}:${i}`}
              className="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <b className="font-semibold">{c.tm}</b>
                  {c.sub && <span className="text-faint"> · {c.sub}</span>}
                </span>
                <span className="shrink-0 text-xs text-faint tabular-nums">
                  {c.sheet}
                  {c.row != null && ` · стр. ${c.row}`}
                </span>
              </span>
              <span>
                <span className="mr-1.5 rounded-full bg-warn-tint px-2 py-0.5 text-xs text-warn-ink">
                  {KIND_LABEL[c.kind] ?? c.kind}
                </span>
                {c.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}

export function RgsReportView({ report }: { report: RgsReport }) {
  const statuses = Object.entries(report.unknown_statuses);
  const dates = Object.entries(report.bad_dates);
  return (
    <>
      <KpiGrid
        items={[
          { label: "Позиций", value: formatInt(report.rows) },
          ...(report.checks
            ? [{
                label: "Проверить",
                value: formatInt(report.checks.count),
                color: report.checks.count ? "var(--color-warn-ink)" : undefined,
              }]
            : []),
          { label: "Новых (IN)", value: formatInt(report.new) },
          {
            label: "Дублей",
            value: formatInt(report.duplicates),
            color: report.duplicates ? "var(--color-bad)" : undefined,
          },
        ]}
      />
      {report.checks && <Checks checks={report.checks} />}
      {Object.entries(report.sheets).map(([sheet, rows]) => {
        const missing = report.missing[sheet] ?? [];
        const optional = report.optional?.[sheet] ?? [];
        const columns = Object.entries(report.columns[sheet] ?? {});
        return (
          <PanelSection
            key={sheet}
            title={`Лист «${sheet}» · ${formatInt(rows)} строк`}
          >
            {missing.length > 0 && (
              <div className="rounded-inner bg-warn-tint px-4 py-3 text-sm text-warn-ink">
                Не найдены колонки:{" "}
                {missing.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
              </div>
            )}
            {optional.length > 0 && (
              <div className="rounded-inner bg-subtle px-4 py-3 text-sm text-muted">
                Новых колонок пока нет в трекере, RGS покажет «нет данных»:{" "}
                {optional.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-4 text-[13px]">
              {columns.map(([field, header]) => (
                <div key={field} className="contents">
                  <span className="border-b border-line py-1.5 text-muted-2">
                    {FIELD_LABELS[field] ?? field}
                  </span>
                  <span className="truncate border-b border-line py-1.5" title={header}>
                    {header}
                  </span>
                </div>
              ))}
            </div>
          </PanelSection>
        );
      })}
      {report.norms_sheet !== undefined && (
        <PanelSection title="Лист «Нормативы»">
          <span className="text-sm">
            {report.norms_sheet
              ? `Прочитано значений: ${Object.keys(report.norms ?? {}).length}. Остальные — по умолчанию.`
              : "Листа нет — нормы и цели KPI взяты по умолчанию."}
          </span>
        </PanelSection>
      )}
      {statuses.length > 0 && (
        <PanelSection title="Нераспознанные статусы">
          <span className="text-sm">
            {statuses.map(([s, n]) => `${s} — ${n}`).join(", ")}
          </span>
        </PanelSection>
      )}
      {dates.length > 0 && (
        <PanelSection title="Даты, которые не удалось прочитать">
          <span className="text-sm">
            {dates
              .map(([f, n]) => `${FIELD_LABELS[f] ?? f} — ${n}`)
              .join(", ")}
          </span>
        </PanelSection>
      )}
    </>
  );
}
