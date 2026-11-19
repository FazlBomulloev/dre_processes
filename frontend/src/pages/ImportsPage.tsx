import { type ReactNode, useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import clsx from "clsx";
import {
  deleteImport, getImport, getImports, getMarkets, makeImportCurrent,
  uploadRgs, uploadVpc,
} from "../api/client";
import { RgsReportView } from "../components/imports/RgsReportView";
import { VpcReportView } from "../components/imports/VpcReportView";
import { Page } from "../components/layout/Layout";
import { Card, CardTitle, PageHeader } from "../components/ui/Card";
import {
  BTN_PRIMARY, BTN_SECONDARY, FIELD, Modal,
} from "../components/ui/Modal";
import { SidePanel } from "../components/ui/SidePanel";
import { ErrorNote, Loading } from "../components/ui/states";
import { useFetch } from "../hooks/useFetch";
import { useSession } from "../hooks/useSession";
import { apiErrorText } from "../lib/apiError";
import { formatDate, formatDateTime, formatInt } from "../lib/format";
import { rgsProblems } from "../lib/rgs";
import { plural, reportProblems } from "../lib/vpc";
import type { ImportRow, VpcReport } from "../types/api";
import type { RgsReport } from "../types/rgs";

function importProblems(row: ImportRow): number {
  if (!row.report) return 0;
  return row.kind === "rgs"
    ? rgsProblems(row.report as RgsReport)
    : reportProblems(row.report as VpcReport);
}

const KIND_LABELS: Record<string, string> = { vpc: "ВПЦ", rgs: "RGS" };

const LINK =
  "tr-soft border-0 bg-transparent p-0 text-[13px] font-medium text-accent hover:text-accent-hover disabled:opacity-50";
const LINK_DANGER =
  "tr-soft border-0 bg-transparent p-0 text-[13px] font-medium text-bad-ink hover:text-bad";
const BTN_DANGER =
  "tr-soft rounded-[9px] border-0 bg-bad px-3.5 py-[9px] text-sm font-semibold text-white hover:bg-bad-ink disabled:cursor-default disabled:opacity-60";

export default function ImportsPage() {
  const { can } = useSession();
  const list = useFetch((signal) => getImports(undefined, signal), []);
  const [report, setReport] = useState<ImportRow | null>(null);
  const [removing, setRemoving] = useState<ImportRow | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const openReport = async (row: ImportRow) => {
    setError("");
    try {
      setReport(await getImport(row.id));
    } catch (e) {
      setError(apiErrorText(e, "Не удалось открыть отчёт"));
    }
  };

  const setCurrent = async (row: ImportRow) => {
    setBusyId(row.id);
    setError("");
    try {
      await makeImportCurrent(row.id);
      list.reload();
    } catch (e) {
      setError(apiErrorText(e, "Не удалось сделать снимок текущим"));
    } finally {
      setBusyId(null);
    }
  };

  const done = (row: ImportRow) => {
    list.reload();
    setReport(row);
  };

  return (
    <Page maxWidth={1120}>
      <PageHeader
        title="Загрузки"
        subtitle="Снимки выгрузок. Дашборды показывают текущий снимок."
      />
      {can("upload:vpc") && (
        <UploadCard
          title="Выгрузка ВПЦ"
          note="xlsx, шапка — строка с «Дженерик»"
          unit={(n) => plural(n, "предложение", "предложения", "предложений")}
          upload={uploadVpc}
          onDone={done}
        />
      )}
      {can("upload:rgs") && <RgsUpload onDone={done} />}
      <Card index={1} className="flex flex-col gap-3 px-0 pb-2">
        <CardTitle className="px-[26px]">Снимки</CardTitle>
        {(list.error || error) && (
          <ErrorNote className="mx-6">{list.error || error}</ErrorNote>
        )}
        {list.loading && !list.data && <Loading className="py-10" />}
        {list.data && list.data.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-muted-2">
            Пока ничего не загружено.
          </div>
        )}
        {list.data && list.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-6 py-2.5 font-normal">Данные на</th>
                  <th className="px-3 py-2.5 font-normal">Источник</th>
                  <th className="px-3 py-2.5 font-normal">Файл</th>
                  <th className="px-3 py-2.5 text-right font-normal">
                    Строк
                  </th>
                  <th className="px-3 py-2.5 font-normal">Загрузил</th>
                  <th className="px-6 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {list.data.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="whitespace-nowrap px-6 py-3">
                      <span className="font-medium">
                        {formatDate(row.data_date)}
                      </span>
                      {row.is_current && (
                        <span className="ml-2 rounded-full bg-pos-tint px-2 py-0.5 text-[11px] font-medium text-pos">
                          текущий
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {KIND_LABELS[row.kind] ?? row.kind}
                      {row.market_code ? ` · ${row.market_code}` : ""}
                    </td>
                    <td
                      className="max-w-[260px] truncate px-3 py-3 text-muted-2"
                      title={row.file_name}
                    >
                      {row.file_name}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatInt(row.rows)}
                    </td>
                    <td className="px-3 py-3 text-muted-2">
                      {row.uploaded_by ?? "—"}
                      <span className="block text-xs text-faint">
                        {formatDateTime(row.uploaded_at)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="flex justify-end gap-4">
                        <button
                          type="button"
                          className={LINK}
                          onClick={() => openReport(row)}
                        >
                          Отчёт
                        </button>
                        {!row.is_current && can(`upload:${row.kind}`) && (
                          <button
                            type="button"
                            className={LINK}
                            disabled={busyId === row.id}
                            onClick={() => setCurrent(row)}
                          >
                            Сделать текущим
                          </button>
                        )}
                        {can("imports:delete") && (
                          <button
                            type="button"
                            className={LINK_DANGER}
                            onClick={() => setRemoving(row)}
                          >
                            Удалить
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {report && report.report && (
        <SidePanel
          onClose={() => setReport(null)}
          eyebrow={`${KIND_LABELS[report.kind] ?? report.kind} · данные на `
            + formatDate(report.data_date)}
          title="Отчёт загрузки"
          headerExtra={
            <span className="truncate text-sm text-muted-2">
              {report.file_name}
            </span>
          }
          gap={24}
        >
          {report.kind === "rgs"
            ? <RgsReportView report={report.report as RgsReport} />
            : <VpcReportView report={report.report as VpcReport} />}
        </SidePanel>
      )}
      {removing && (
        <DeleteDialog
          row={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            list.reload();
          }}
        />
      )}
    </Page>
  );
}

function UploadCard({
  title, note, unit, children, ready = true, upload, onDone,
}: {
  title: string;
  note: string;
  unit: (n: number) => string;
  children?: ReactNode;
  ready?: boolean;
  upload: (file: File) => Promise<ImportRow>;
  onDone: (row: ImportRow) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState<ImportRow | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const row = await upload(file);
      setLast(row);
      setFile(null);
      if (input.current) input.current.value = "";
      onDone(row);
    } catch (e) {
      setError(apiErrorText(e, "Не удалось загрузить файл"));
    } finally {
      setBusy(false);
    }
  };

  const problems = last ? importProblems(last) : 0;

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle note={note}>{title}</CardTitle>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <label
          className={clsx(
            "tr-soft flex min-w-[260px] flex-1 cursor-pointer items-center gap-3 rounded-inner border border-dashed px-4 py-3.5",
            file ? "border-fg bg-subtle" : "border-line-strong hover:border-faint",
          )}
        >
          <FileSpreadsheet size={20} className="shrink-0 text-faint" />
          <span className="min-w-0 truncate text-sm">
            {file ? file.name : "Выберите файл"}
          </span>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xlsm"
            className="sr-only"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          className={clsx(BTN_PRIMARY, "flex items-center gap-1.5")}
          disabled={!file || busy || !ready}
          onClick={submit}
        >
          <Upload size={15} />
          {busy ? "Разбираем файл…" : "Загрузить"}
        </button>
      </div>
      {busy && (
        <span className="text-xs text-faint">
          Большой файл разбирается до минуты. Не закрывайте страницу.
        </span>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {last && !busy && (
        <div
          className={clsx(
            "rounded-inner px-4 py-3 text-sm",
            problems ? "bg-warn-tint text-warn-ink" : "bg-pos-tint text-pos",
          )}
        >
          Загружено {formatInt(last.rows)} {unit(last.rows)}, снимок стал
          текущим.{" "}
          {problems > 0 && "Есть замечания — смотрите отчёт."}
        </div>
      )}
    </Card>
  );
}

function RgsUpload({ onDone }: { onDone: (row: ImportRow) => void }) {
  const markets = useFetch((signal) => getMarkets(signal), []);
  const [market, setMarket] = useState("AZ");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const list = markets.data ?? [];
  const code = list.some((m) => m.code === market)
    ? market
    : list[0]?.code ?? "";
  return (
    <UploadCard
      title="Трекер RGS"
      note="xlsx, листы «Е» и «IN», колонки по маппингу рынка"
      unit={(n) => plural(n, "позиция", "позиции", "позиций")}
      ready={!!code && !!day}
      upload={(file) => uploadRgs(file, code, day)}
      onDone={onDone}
    >
      <select
        aria-label="Рынок"
        value={code}
        onChange={(e) => setMarket(e.target.value)}
        className={clsx(FIELD, "!w-[220px]")}
      >
        {list.map((m) => (
          <option key={m.code} value={m.code}>
            {m.code} · {m.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-2">
        Данные на
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className={clsx(FIELD, "!w-[160px]")}
        />
      </label>
    </UploadCard>
  );
}

function DeleteDialog({
  row, onClose, onDone,
}: {
  row: ImportRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteImport(row.id);
      onDone();
    } catch (e) {
      setError(apiErrorText(e, "Не удалось удалить снимок"));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Удалить снимок?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={BTN_DANGER}
            disabled={busy}
            onClick={submit}
          >
            Удалить
          </button>
        </>
      }
    >
      <p className="m-0 text-sm text-muted-2">
        {row.file_name} · {formatInt(row.rows)} строк.
        {row.is_current && " Это текущий снимок: текущим станет предыдущий."}
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Modal>
  );
}
