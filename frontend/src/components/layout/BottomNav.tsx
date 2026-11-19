import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useSession } from "../../hooks/useSession";
import { GENERAL_NAV } from "../../lib/nav";

export default function BottomNav() {
  const { can } = useSession();
  const links = GENERAL_NAV.filter((l) => l.allowed(can));
  return (
    <>
      <div aria-hidden className="h-[calc(72px+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Общие разделы"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white/95 px-1 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur"
        style={{ gridTemplateColumns: `repeat(${links.length}, 1fr)` }}
      >
        {links.map(({ icon: Icon, ...l }) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            aria-label={l.label}
            className={({ isActive }) => clsx(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium",
              isActive ? "text-accent hover:text-accent" : "text-faint hover:text-faint",
            )}
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="max-w-full truncate px-0.5">
              {l.label.split(" ·")[0]}
            </span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
