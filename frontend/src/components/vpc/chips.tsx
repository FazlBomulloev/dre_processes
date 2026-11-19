import clsx from "clsx";
import { STATE_COLORS, hue } from "../../lib/vpc";

export function CountryCode({ code }: { code: string | null }) {
  if (!code) return <span className="text-faint">—</span>;
  const h = hue(code);
  return (
    <span
      className="inline-block rounded-[5px] px-1.5 py-[3px] text-[10.5px] font-bold leading-none"
      style={{
        background: `oklch(0.93 0.05 ${h})`,
        color: `oklch(0.36 0.11 ${h})`,
      }}
    >
      {code}
    </span>
  );
}

export function StatusBadge({
  code, state, raw,
}: {
  code: string | null;
  state: string;
  raw?: string | null;
}) {
  return (
    <span
      className={clsx(
        "inline-flex w-max items-center gap-1.5 rounded-full border border-line-strong py-px pl-[7px] pr-[9px] text-xs font-semibold text-fg-2",
      )}
    >
      <span
        className="size-[7px] rounded-full"
        style={{ background: STATE_COLORS[state] }}
      />
      {code ?? raw ?? "—"}
    </span>
  );
}
