import clsx from "clsx";
import { STAGE_CHIP, STAGE_LABEL } from "../../lib/rgs";

export function StageChip({
  stage, className,
}: {
  stage: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
        STAGE_CHIP[stage],
        className,
      )}
    >
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

export function DaysBadge({ days }: { days: number }) {
  return (
    <span
      className={clsx(
        "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        days > 90 ? "bg-bad-tint text-bad-ink" : "bg-warn-tint text-warn-ink",
      )}
    >
      +{days} {days % 10 === 1 && days % 100 !== 11 ? "день"
        : days % 10 >= 2 && days % 10 <= 4
          && (days % 100 < 12 || days % 100 > 14) ? "дня" : "дней"}
    </span>
  );
}
