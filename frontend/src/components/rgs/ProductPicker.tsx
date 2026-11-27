import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import clsx from "clsx";
import { useOutsideClose } from "../../hooks/useDismiss";
import { plural } from "../../lib/vpc";

export function ProductPicker({
  options, value, onChange,
}: {
  options: { tm: string; count: number }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(value);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));
  const picked = new Set(draft);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? options.filter((o) => o.tm.toLowerCase().includes(needle))
      : options;
  }, [options, query]);

  const toggle = () => {
    if (!open) setDraft(value);
    setOpen((v) => !v);
  };
  const flip = (tm: string) =>
    setDraft((prev) =>
      prev.includes(tm) ? prev.filter((t) => t !== tm) : [...prev, tm]);
  const apply = () => {
    onChange([...draft].sort());
    setOpen(false);
    setQuery("");
  };

  const label = value.length === 1
    ? value[0]
    : `${value.length} ${plural(value.length, "продукт", "продукта", "продуктов")}`;

  return (
    <div ref={ref} className="relative">
      {value.length > 0 ? (
        <span className="flex h-9 items-center rounded-full bg-fg pl-3.5 pr-1 text-[13px] text-white">
          <button
            type="button"
            aria-expanded={open}
            onClick={toggle}
            className="flex max-w-[260px] items-center gap-1.5 border-0 bg-transparent p-0 text-white"
          >
            <span className="text-white/70">Продукты</span>
            <b className="truncate font-semibold" title={value.join(", ")}>
              {label}
            </b>
          </button>
          <button
            type="button"
            aria-label="Сбросить выбор продуктов"
            onClick={() => onChange([])}
            className="tr-soft ml-1 flex size-7 items-center justify-center rounded-full border-0 bg-transparent text-white/70 hover:bg-white/15 hover:text-white"
          >
            <X size={13} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className={clsx(
            "tr-soft flex h-9 items-center gap-1.5 rounded-full border-0 px-3.5 text-[13px]",
            open ? "bg-subtle text-fg" : "bg-transparent text-muted hover:bg-subtle hover:text-fg",
          )}
        >
          Продукты: все
          <ChevronDown size={12} strokeWidth={2.6} />
        </button>
      )}
      {open && (
        <div className="anim-pop absolute right-0 top-[calc(100%+6px)] z-30 flex w-[320px] flex-col rounded-2xl bg-white p-1.5 shadow-pop">
          <label className="mb-1 flex items-center gap-2 rounded-[10px] bg-subtle px-3">
            <Search size={14} className="text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти продукт…"
              className="h-9 w-full border-0 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex max-h-[320px] flex-col overflow-y-auto">
            {shown.length === 0 && (
              <span className="px-3 py-2.5 text-sm text-faint">
                Ничего не найдено
              </span>
            )}
            {shown.map((o) => {
              const on = picked.has(o.tm);
              return (
                <button
                  key={o.tm}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => flip(o.tm)}
                  className="tr-soft flex items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-subtle"
                >
                  <span
                    className={clsx(
                      "flex size-4 shrink-0 items-center justify-center rounded-[5px] border",
                      on ? "border-fg bg-fg text-white" : "border-line-strong bg-white",
                    )}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className={clsx("min-w-0 flex-1 truncate", on && "font-semibold")}>
                    {o.tm}
                  </span>
                  {o.count > 1 && (
                    <span className="shrink-0 text-xs tabular-nums text-faint">
                      ×{o.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-2 pt-2">
            <button
              type="button"
              onClick={() => setDraft([])}
              disabled={draft.length === 0}
              className="border-0 bg-transparent p-1 text-[13px] text-muted hover:text-fg disabled:opacity-40"
            >
              Снять всё
            </button>
            <button
              type="button"
              onClick={apply}
              className="tr-soft rounded-full border-0 bg-fg px-4 py-1.5 text-[13px] font-medium text-white hover:bg-ink-hover"
            >
              Показать{draft.length ? ` · ${draft.length}` : " все"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
