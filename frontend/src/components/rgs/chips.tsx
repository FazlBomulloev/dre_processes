import type { ReactNode } from "react";
import clsx from "clsx";
import { GROUP_CHIP, GROUP_LABEL, STATUS_HINT, TONE_PILL } from "../../lib/rgs";
import type { Tone } from "../../types/rgs";

export function GroupChip({
  group, className,
}: {
  group: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
        GROUP_CHIP[group],
        className,
      )}
    >
      {GROUP_LABEL[group] ?? group}
    </span>
  );
}

export function TonePill({
  tone, children, className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        TONE_PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusCode({ code }: { code: string | null }) {
  if (!code) return <span className="text-faint">—</span>;
  const hint = STATUS_HINT[code.replace(/^[swy](?=d|r)/, "")];
  return (
    <span
      title={hint}
      className={clsx(
        "font-mono text-[13px] font-semibold",
        hint && "cursor-help underline decoration-dotted decoration-faint underline-offset-4",
      )}
    >
      {code}
    </span>
  );
}
