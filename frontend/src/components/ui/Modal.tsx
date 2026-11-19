import type { ReactNode } from "react";
import { useEscape } from "../../hooks/useDismiss";

export const BTN_PRIMARY =
  "tr-soft rounded-[9px] border-0 bg-accent px-3.5 py-[9px] text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-default disabled:opacity-60";
export const BTN_SECONDARY =
  "tr-soft rounded-[9px] border-0 bg-[#f2f2ef] px-3.5 py-[9px] text-sm font-medium hover:bg-[#e8e8e4]";
export const FIELD =
  "h-10 w-full rounded-ctl border border-line-strong px-3 text-sm outline-none focus:border-accent";

export function Modal({
  title, onClose, children, footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEscape(true, onClose);
  return (
    <>
      <div
        className="anim-overlay fixed inset-0 z-40 bg-[rgba(22,24,29,.28)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="anim-pop fixed left-1/2 top-1/2 z-[41] flex max-h-[90vh] w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(16,24,40,.2)]"
      >
        <span id="modal-title" className="text-lg font-semibold">
          {title}
        </span>
        {children}
        <div className="flex justify-end gap-2 pt-1">{footer}</div>
      </div>
    </>
  );
}

export function Field({
  label, children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted">
      {label}
      {children}
    </label>
  );
}
