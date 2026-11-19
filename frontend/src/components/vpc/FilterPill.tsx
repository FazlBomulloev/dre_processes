import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import clsx from "clsx";
import { useOutsideClose } from "../../hooks/useDismiss";
import { formatInt } from "../../lib/format";
import type { FacetOption } from "../../types/vpc";

const VISIBLE = 200;

export function FilterPill({
  label, value, options, onChange, display = (v) => v,
}: {
  label: string;
  value: string;
  options: FacetOption[] | undefined;
  onChange: (value: string | null) => void;
  display?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = options ?? [];
    const found = needle
      ? list.filter((o) => display(o.value).toLowerCase().includes(needle))
      : list;
    return found.slice(0, VISIBLE);
  }, [options, query, display]);

  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative">
      {value ? (
        <span className="flex h-9 items-center rounded-full bg-fg pl-3.5 pr-1 text-[13px] text-white">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex max-w-[260px] items-center gap-1.5 border-0 bg-transparent p-0 text-white"
          >
            <span className="text-white/70">{label}</span>
            <b className="truncate font-semibold" title={display(value)}>
              {display(value)}
            </b>
          </button>
          <button
            type="button"
            aria-label={`Сбросить «${label}»`}
            onClick={() => pick(null)}
            className="tr-soft ml-1 flex size-7 items-center justify-center rounded-full border-0 bg-transparent text-white/70 hover:bg-white/15 hover:text-white"
          >
            <X size={13} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "tr-soft flex h-9 items-center gap-1.5 rounded-full border-0 px-3.5 text-[13px]",
            open ? "bg-subtle text-fg" : "bg-transparent text-muted hover:bg-subtle hover:text-fg",
          )}
        >
          {label}
          <ChevronDown size={12} strokeWidth={2.6} />
        </button>
      )}
      {open && (
        <div className="anim-pop absolute left-0 top-[calc(100%+6px)] z-30 flex w-[300px] flex-col rounded-2xl bg-white p-1.5 shadow-pop">
          {(options?.length ?? 0) > 8 && (
            <label className="mb-1 flex items-center gap-2 rounded-[10px] bg-subtle px-3">
              <Search size={14} className="text-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти…"
                className="h-9 w-full border-0 bg-transparent text-sm outline-none"
              />
            </label>
          )}
          <div className="flex max-h-[320px] flex-col overflow-y-auto">
            {options === undefined && (
              <span className="px-3 py-2.5 text-sm text-faint">Загрузка…</span>
            )}
            {options !== undefined && shown.length === 0 && (
              <span className="px-3 py-2.5 text-sm text-faint">
                Ничего не найдено
              </span>
            )}
            {shown.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className={clsx(
                  "tr-soft flex items-center justify-between gap-3 rounded-[10px] border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-subtle",
                  o.value === value && "font-semibold",
                )}
              >
                <span className="min-w-0 truncate" title={display(o.value)}>
                  {display(o.value)}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-faint">
                  {formatInt(o.count)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
