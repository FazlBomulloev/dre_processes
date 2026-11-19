import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import clsx from "clsx";
import { getMarkets, logout } from "../../api/client";
import { useFetch } from "../../hooks/useFetch";
import { useOutsideClose } from "../../hooks/useDismiss";
import { useSession } from "../../hooks/useSession";
import {
  MARKET_NAV, MARKET_RGS_NAV, MARKET_VPC_NAV, VPC_NAV, marketCode,
} from "../../lib/nav";
import { roleLabel } from "../../lib/roles";
import type { Market } from "../../types/api";
import { PasswordDialog } from "../users/PasswordDialog";
import { VpcCapsule } from "../vpc/VpcCapsule";
import { Logo } from "./Logo";

function pillClass({ isActive }: { isActive: boolean }) {
  return clsx(
    "tr-soft whitespace-nowrap rounded-full px-4 py-2 text-[13px]",
    isActive
      ? "bg-fg font-medium text-white hover:text-white"
      : "text-muted hover:bg-subtle hover:text-fg",
  );
}

function subClass({ isActive }: { isActive: boolean }) {
  return clsx(
    "tr-soft whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px]",
    isActive
      ? "bg-white font-medium text-fg shadow-sm hover:text-fg"
      : "text-muted hover:bg-subtle hover:text-fg",
  );
}

const KEEP = new Set([
  "offers", "factories", "countries", "funnel", "products",
]);

export default function TopBar() {
  const { can } = useSession();
  const { pathname } = useLocation();
  const code = marketCode(pathname);
  const vpc = pathname.startsWith("/vpc");
  const marketVpc = !!code && pathname.split("/")[3] === "vpc";
  const marketRgs = !!code && pathname.split("/")[3] === "rgs";
  const subNav = marketVpc ? MARKET_VPC_NAV : marketRgs ? MARKET_RGS_NAV : [];
  const section = marketVpc ? "vpc" : "rgs";
  const markets = useFetch(
    (signal) => getMarkets(signal), [code ? "market" : "other"],
  );
  const sections = MARKET_NAV.filter((s) => s.allowed(can));

  return (
    <header className="flex flex-wrap items-center gap-4 px-[clamp(16px,2vw,28px)] pb-1 pt-4">
      <NavLink
        to="/"
        aria-label="EvoDash — к списку рынков"
        className="tr-soft flex h-12 items-center rounded-2xl bg-ink px-4 hover:bg-ink-hover"
      >
        <Logo />
      </NavLink>
      {code && (
        <nav
          aria-label="Разделы рынка"
          className="mx-auto flex max-w-full flex-wrap items-center gap-0.5 rounded-full bg-surface p-[5px]"
        >
          <MarketSwitcher code={code} markets={markets.data ?? []} />
          {sections.length > 0 && (
            <span aria-hidden className="mx-1.5 h-5 w-px bg-line-strong" />
          )}
          {sections.map((s) => (
            <NavLink
              key={s.page}
              to={`/market/${code}/${s.page}`}
              className={pillClass}
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      )}
      <div className="order-last flex basis-full justify-center empty:hidden">
        {subNav.length > 0 && (
          <nav
            aria-label={marketVpc ? "Разделы ВПЦ рынка" : "Разделы RGS"}
            className="flex max-w-full flex-wrap items-center gap-0.5 rounded-full bg-surface/70 p-1"
          >
            {subNav.map((item) => (
              <NavLink
                key={item.page}
                to={`/market/${code}/${section}${item.page ? `/${item.page}` : ""}`}
                end={item.end}
                className={subClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      {vpc && (
        <nav
          aria-label="Разделы ВПЦ"
          className="mx-auto flex max-w-full flex-wrap items-center gap-0.5 rounded-full bg-surface p-[5px]"
        >
          <span className="rounded-full bg-canvas px-3.5 py-2 text-[13px] font-semibold">
            ВПЦ · все рынки
          </span>
          <span aria-hidden className="mx-1.5 h-5 w-px bg-line-strong" />
          {VPC_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={pillClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-3">
        {(vpc || marketVpc) && <VpcCapsule />}
        <UserMenu />
      </div>
    </header>
  );
}

function MarketSwitcher({
  code, markets,
}: {
  code: string;
  markets: Market[];
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));
  const current = markets.find((m) => m.code === code);
  const [, , , section = "", sub = ""] = pathname.split("/");
  const page = KEEP.has(sub) ? `${section}/${sub}` : section;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="tr-soft flex items-center gap-2 rounded-full border-0 bg-canvas py-2 pl-2 pr-2.5 text-[13px] font-semibold text-fg hover:bg-seg"
      >
        <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-white">
          {code}
        </span>
        <span className="max-w-44 truncate">{current?.name ?? code}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div
          role="listbox"
          className="anim-pop absolute left-0 top-[calc(100%+8px)] z-40 flex max-h-72 w-60 flex-col overflow-y-auto rounded-xl bg-white p-1.5 shadow-pop"
        >
          {markets.map((m) => {
            const active = m.code === code;
            return (
              <button
                key={m.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOpen(false);
                  if (!active) navigate(`/market/${m.code}/${page}`);
                }}
                className={clsx(
                  "tr-soft flex items-center gap-2.5 rounded-lg border-0 px-2.5 py-2 text-left text-[13px] text-fg hover:bg-canvas",
                  active ? "bg-canvas font-medium" : "bg-transparent",
                )}
              >
                <span className="w-7 text-[11px] font-semibold text-faint">
                  {m.code}
                </span>
                <span className="truncate">{m.name}</span>
              </button>
            );
          })}
          {markets.length === 0 && (
            <span className="px-2.5 py-2 text-[13px] text-faint">
              Нет рынков
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, clear } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));

  if (!user) return null;

  const signOut = async () => {
    try {
      await logout();
    } finally {
      clear();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="tr-soft flex h-12 items-center gap-2.5 rounded-full border-0 bg-surface py-1.5 pl-1.5 pr-4 hover:bg-subtle"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold uppercase text-white">
          {user.username.slice(0, 1)}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13px] font-medium">{user.username}</span>
          <span className="text-[11px] text-faint">
            {roleLabel(user.role)}
          </span>
        </span>
        <ChevronDown size={14} className="text-faint" />
      </button>
      {open && (
        <div className="anim-pop absolute right-0 top-[calc(100%+6px)] z-30 flex w-56 flex-col rounded-2xl bg-white p-1.5 shadow-pop">
          <MenuButton
            icon={<KeyRound size={15} />}
            onClick={() => {
              setOpen(false);
              setPassword(true);
            }}
          >
            Сменить пароль
          </MenuButton>
          <MenuButton icon={<LogOut size={15} />} onClick={signOut}>
            Выйти
          </MenuButton>
        </div>
      )}
      {password && <PasswordDialog onClose={() => setPassword(false)} />}
    </div>
  );
}

function MenuButton({
  icon, onClick, children,
}: {
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tr-soft flex items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-left text-sm text-fg-2 hover:bg-subtle"
    >
      <span className="text-faint">{icon}</span>
      {children}
    </button>
  );
}
