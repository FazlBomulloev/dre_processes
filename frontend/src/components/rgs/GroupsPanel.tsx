import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { RgsGroupRow, RgsGroups } from "../../types/rgs";
import { SidePanel } from "../ui/SidePanel";
import { ErrorNote, Loading } from "../ui/states";
import { GroupChip } from "./chips";

export function GroupsPanel({
  eyebrow, title, data, error, onClose,
}: {
  eyebrow: string;
  title: string;
  data: RgsGroups | null;
  error: string;
  onClose: () => void;
}) {
  return (
    <SidePanel
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      width={560}
      gap={22}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <Loading className="py-12" />}
      {data && data.groups.map((g) => (
        <section key={g.name} className="flex flex-col">
          <div className="flex items-baseline justify-between gap-3 border-b border-line-strong pb-2">
            <span className="text-sm font-semibold">{g.name}</span>
            <span className="text-xs text-faint">{g.count}</span>
          </div>
          {g.rows.map((r) => <Row key={r.tm} row={r} />)}
        </section>
      ))}
    </SidePanel>
  );
}

function Row({ row }: { row: RgsGroupRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="tr-soft flex w-full items-center gap-3 border-0 bg-transparent px-1 py-2.5 text-left hover:bg-subtle"
      >
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="flex items-center gap-2 text-sm font-semibold">
            {row.tm}
            {row.count > 1 && (
              <span className="rounded-full bg-subtle px-1.5 text-[11px] font-medium text-muted">
                ×{row.count}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-faint">
            {[row.generic, row.form].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={clsx("shrink-0 text-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 px-1 pb-3">
          {row.variants.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <b className="font-medium">{v.generic}</b>
                <span className="text-muted-2">
                  {" · "}
                  {[v.form, v.dose, v.pack && `уп. ${v.pack}`]
                    .filter(Boolean).join(" · ")}
                </span>
              </span>
              <GroupChip group={v.group} />
            </div>
          ))}
          {row.comment && (
            <span className="px-1 text-xs text-muted-2">{row.comment}</span>
          )}
        </div>
      )}
    </div>
  );
}
