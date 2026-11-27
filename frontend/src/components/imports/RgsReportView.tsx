import { formatInt } from "../../lib/format";
import { FIELD_LABELS } from "../../lib/rgs";
import type { RgsReport } from "../../types/rgs";
import { KpiGrid, PanelSection } from "../ui/SidePanel";

export function RgsReportView({ report }: { report: RgsReport }) {
  const statuses = Object.entries(report.unknown_statuses);
  const dates = Object.entries(report.bad_dates);
  return (
    <>
      <KpiGrid
        items={[
          { label: "Позиций", value: formatInt(report.rows) },
          { label: "Новых (IN)", value: formatInt(report.new) },
          {
            label: "Дублей",
            value: formatInt(report.duplicates),
            color: report.duplicates ? "var(--color-bad)" : undefined,
          },
        ]}
      />
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
