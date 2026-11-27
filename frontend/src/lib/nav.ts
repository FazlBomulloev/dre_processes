import type { LucideIcon } from "lucide-react";
import {
  Factory, LayoutGrid, ScrollText, Settings2, Upload, Users,
} from "lucide-react";

type Can = (permission: string) => boolean;

export interface GeneralLink {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  allowed: (can: Can) => boolean;
}

export const GENERAL_NAV: GeneralLink[] = [
  {
    to: "/", end: true, label: "Все рынки", icon: LayoutGrid,
    allowed: () => true,
  },
  {
    to: "/vpc", label: "ВПЦ · все рынки", icon: Factory,
    allowed: (can) => can("module:vpc"),
  },
  {
    to: "/imports", label: "Загрузка данных", icon: Upload,
    allowed: (can) =>
      can("upload:vpc") || can("upload:rgs") || can("imports:delete"),
  },
  {
    to: "/users", label: "Пользователи", icon: Users,
    allowed: (can) => can("users:manage"),
  },
  {
    to: "/markets", label: "Настройки рынков", icon: Settings2,
    allowed: (can) => can("markets:write") || can("markets:create"),
  },
  {
    to: "/audit", label: "Журнал действий", icon: ScrollText,
    allowed: (can) => can("audit:read"),
  },
];

export interface MarketSection {
  page: string;
  label: string;
  allowed: (can: Can) => boolean;
}

export const MARKET_NAV: MarketSection[] = [
  { page: "vpc", label: "ВПЦ рынка", allowed: (can) => can("module:vpc_market") },
  { page: "rgs", label: "RGS", allowed: (can) => can("module:rgs") },
];

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export const VPC_NAV: NavItem[] = [
  { to: "/vpc", label: "Обзор", end: true },
  { to: "/vpc/offers", label: "Предложения" },
  { to: "/vpc/factories", label: "Заводы" },
  { to: "/vpc/countries", label: "Страны" },
  { to: "/vpc/funnel", label: "Воронка и динамика" },
];

export const MARKET_VPC_NAV = [
  { page: "", label: "Обзор", end: true },
  { page: "offers", label: "Предложения" },
  { page: "factories", label: "Заводы" },
  { page: "countries", label: "Страны" },
  { page: "funnel", label: "Воронка и динамика" },
];

export const MARKET_RGS_NAV = [
  { page: "", label: "Обзор", end: true },
  { page: "products", label: "Препараты" },
  { page: "kpi", label: "KPI" },
  { page: "meeting", label: "К встрече" },
  { page: "checks", label: "Проверить данные" },
];

export function loginTarget(state: unknown, search: string): string {
  const fromState = (state as { from?: string } | null)?.from;
  const fromQuery = new URLSearchParams(search).get("from");
  const value = fromState ?? fromQuery ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function marketCode(pathname: string): string | null {
  const match = /^\/market\/([^/]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]).toUpperCase() : null;
}
