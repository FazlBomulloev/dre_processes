import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useSession } from "../../hooks/useSession";
import { GENERAL_NAV } from "../../lib/nav";

function RailLink({
  to, label, end, children,
}: {
  to: string;
  label: string;
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) => clsx(
        "group tr-soft relative flex size-14 items-center justify-center rounded-full",
        isActive
          ? "bg-fg text-white hover:text-white"
          : "text-muted hover:bg-subtle hover:text-fg",
      )}
    >
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-40 -translate-y-1/2 whitespace-nowrap rounded-lg bg-fg px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </NavLink>
  );
}

export default function Rail() {
  const { can } = useSession();
  return (
    <nav
      aria-label="Общие разделы"
      className="fixed left-[clamp(16px,2vw,28px)] top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 rounded-full bg-surface p-2 shadow-[0_8px_28px_rgba(16,24,40,.08)] max-md:hidden"
    >
      {GENERAL_NAV.filter((l) => l.allowed(can)).map(({ icon: Icon, ...l }) => (
        <RailLink key={l.to} to={l.to} end={l.end} label={l.label}>
          <Icon size={22} strokeWidth={1.8} />
        </RailLink>
      ))}
    </nav>
  );
}
