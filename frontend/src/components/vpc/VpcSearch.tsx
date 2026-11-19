import {
  useEffect, useRef, useState, type KeyboardEvent as KeyEvent,
} from "react";
import { Search, X } from "lucide-react";
import clsx from "clsx";
import { getSuggest } from "../../api/vpc";
import { useOutsideClose } from "../../hooks/useDismiss";
import { formatInt } from "../../lib/format";
import type { Suggestion } from "../../types/vpc";

const KIND_LABELS = { mnn: "МНН", maker: "Завод" };

export function VpcSearch({
  value, onSearch, onPick,
}: {
  value: string;
  onSearch: (q: string | null) => void;
  onPick: (s: Suggestion) => void;
}) {
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));

  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }

  useEffect(() => {
    const needle = text.trim();
    if (needle.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getSuggest(needle, controller.signal).then(
        (found) => {
          setItems(found);
          setActive(-1);
        },
        () => setItems([]),
      );
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const shown = text.trim().length >= 2 ? items : [];

  const pick = (s: Suggestion) => {
    setOpen(false);
    setText("");
    onPick(s);
  };

  const submit = () => {
    setOpen(false);
    if (active >= 0 && shown[active]) {
      pick(shown[active]);
      return;
    }
    onSearch(text.trim() || null);
  };

  const onKeyDown = (e: KeyEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div ref={ref} className="relative w-[min(590px,100%)] max-md:w-full">
      <label className="tr-soft flex h-12 items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-faint">
        <Search size={17} className="shrink-0 text-faint" />
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Введите МНН, завод или текст комментария…"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        {value ? (
          <button
            type="button"
            aria-label="Сбросить поиск"
            onClick={() => {
              setText("");
              onSearch(null);
            }}
            className="tr-soft flex size-7 items-center justify-center rounded-lg border-0 bg-subtle text-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="rounded-md border border-line-strong px-1.5 font-sans text-[11px] text-faint max-md:hidden">
            /
          </kbd>
        )}
      </label>
      {open && shown.length > 0 && (
        <div className="anim-pop absolute inset-x-0 top-[calc(100%+6px)] z-30 flex flex-col rounded-2xl bg-white p-1.5 shadow-pop">
          {shown.map((s, i) => (
            <button
              key={`${s.kind}:${s.value}`}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
              className={clsx(
                "tr-soft flex items-center gap-3 rounded-[10px] border-0 px-3 py-2 text-left text-sm",
                i === active ? "bg-subtle" : "bg-transparent",
              )}
            >
              <span className="w-12 shrink-0 text-[11px] text-faint">
                {KIND_LABELS[s.kind]}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {s.value}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-faint">
                {formatInt(s.count)}
              </span>
            </button>
          ))}
          <span className="px-3 pb-1 pt-2 text-[11px] text-faint">
            Enter — искать «{text.trim()}» в комментариях и названиях
          </span>
        </div>
      )}
    </div>
  );
}
