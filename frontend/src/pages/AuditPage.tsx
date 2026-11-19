import { useState } from "react";
import clsx from "clsx";
import { getAudit } from "../api/client";
import { Page } from "../components/layout/Layout";
import { Card, PageHeader } from "../components/ui/Card";
import { BTN_SECONDARY } from "../components/ui/Modal";
import { ErrorNote, Loading } from "../components/ui/states";
import { useFetch } from "../hooks/useFetch";
import { formatDateTime } from "../lib/format";
import { AUDIT_LABELS } from "../lib/roles";

const LIMIT = 50;

function details(value: Record<string, unknown> | null): string {
  if (!value) return "";
  return Object.entries(value)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");
}

export default function AuditPage() {
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState("");
  const page = useFetch(
    (signal) => getAudit(
      { offset, limit: LIMIT, action: action || undefined }, signal,
    ),
    [offset, action],
  );
  const total = page.data?.total ?? 0;

  return (
    <Page>
      <PageHeader title="Журнал" subtitle="Входы, изменения прав и данных">
        <select
          aria-label="Действие"
          className="h-10 rounded-ctl border border-line-strong bg-white px-3 text-sm"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Все действия</option>
          {Object.entries(AUDIT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </PageHeader>
      <Card className="overflow-x-auto px-0 py-2">
        {page.error && <ErrorNote className="mx-6">{page.error}</ErrorNote>}
        {page.loading && !page.data && <Loading className="py-10" />}
        {page.data && page.data.items.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-muted-2">
            Записей нет.
          </div>
        )}
        {page.data && page.data.items.length > 0 && (
          <table
            className={clsx(
              "w-full min-w-[760px] border-collapse text-sm",
              page.loading && "opacity-60",
            )}
          >
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="px-6 py-3 font-normal">Когда</th>
                <th className="px-3 py-3 font-normal">Кто</th>
                <th className="px-3 py-3 font-normal">Действие</th>
                <th className="px-3 py-3 font-normal">Рынок</th>
                <th className="px-6 py-3 font-normal">Подробности</th>
              </tr>
            </thead>
            <tbody>
              {page.data.items.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-6 py-3 text-muted-2">
                    {formatDateTime(e.at)}
                  </td>
                  <td className="px-3 py-3 font-medium">
                    {e.username ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {AUDIT_LABELS[e.action] ?? e.action}
                  </td>
                  <td className="px-3 py-3">{e.market_code ?? ""}</td>
                  <td className="px-6 py-3 text-muted-2">
                    {details(e.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {total > LIMIT && (
        <div className="flex items-center justify-end gap-3 text-sm text-muted-2">
          {offset + 1}–{Math.min(offset + LIMIT, total)} из {total}
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
          >
            Назад
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset(offset + LIMIT)}
          >
            Дальше
          </button>
        </div>
      )}
    </Page>
  );
}
