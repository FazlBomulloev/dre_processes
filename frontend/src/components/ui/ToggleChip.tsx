import type { ReactNode } from "react";
import clsx from "clsx";

export function ToggleChip({
  active, onClick, children, disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "tr-soft rounded-full border px-3 py-1.5 text-[13px] disabled:cursor-default disabled:opacity-50",
        active
          ? "border-fg bg-fg font-medium text-white"
          : "border-line-strong bg-white text-muted hover:border-faint hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
