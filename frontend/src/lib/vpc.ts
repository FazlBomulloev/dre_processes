import type { VpcReport } from "../types/api";
import type { CountryDetail } from "../types/vpc";

export const STATE_LABELS: Record<string, string> = {
  work: "В работе",
  contract: "Контракт",
  result: "Результат",
  stop: "Стоп",
  unknown: "Не распознан",
};

export const STATE_COLORS: Record<string, string> = {
  work: "var(--color-st-work)",
  contract: "var(--color-st-contract)",
  result: "var(--color-st-result)",
  stop: "var(--color-st-stop)",
  unknown: "var(--color-bad)",
};

export const STATE_ORDER = [
  "work", "contract", "result", "stop", "unknown",
];

export const PRICE_SOURCES: Record<string, string> = {
  agreed: "Согл.Цена",
  our2: "Наша цена 2",
  our1: "Наша цена 1",
  usd: "Цена в USD",
};

export const DETECTED_LABELS: Record<string, string> = {
  currency: "Валюта",
  last_comment_date: "Дата последнего комментария",
};

export function reportProblems(report: VpcReport): number {
  return report.unknown_total + report.missing_fields.length
    + report.duplicate_headers.length;
}

const PRICE = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number | null | undefined): string {
  return value == null ? "—" : PRICE.format(value);
}

export const PRICE_COLUMNS: { value: string; label: string }[] = [
  { value: "agreed", label: "Согл.Цена" },
  { value: "auto", label: "Последняя известная" },
  { value: "our2", label: "Наша цена 2" },
  { value: "our1", label: "Наша цена 1" },
  { value: "usd", label: "Цена в USD" },
];

export const TABS: { value: string; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "work", label: "В работе" },
  { value: "contract", label: "Контракт" },
  { value: "result", label: "Результат" },
  { value: "stop", label: "Стоп" },
];

export const FILTER_LABELS: Record<string, string> = {
  mnn: "МНН",
  form: "Форма",
  dose: "Доза",
  pack: "Упаковка",
  status: "Статус",
  target: "Для страны",
  maker: "Завод",
  state: "Состояние",
  maker_country: "Страна завода",
  bdm: "БДМ",
  analyst: "Аналитик",
  category: "Категория",
  responsible: "Ответственный",
};

export function isInactive(state: string): boolean {
  return state === "stop";
}

export function pluralOffers(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "предложение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "предложения";
  }
  return "предложений";
}

export function hue(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) % 360;
  }
  return h;
}

export function makerStripe(country: string | null): string {
  return `oklch(0.6 0.12 ${hue(country ?? "")})`;
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const ONE_DIGIT = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

export function formatPct(value: number | null | undefined): string {
  return value == null ? "—" : `${ONE_DIGIT.format(value)}%`;
}

export function formatSigned(value: number | null | undefined): string {
  if (value == null) return "—";
  const text = String(Math.round(Math.abs(value)));
  if (text === "0") return "0%";
  if (value > 0) return `+${text}%`;
  if (value < 0) return `−${text}%`;
  return "0%";
}

export function formatDays(value: number | null | undefined): string {
  return value == null ? "—" : `${ONE_DIGIT.format(Math.round(value))} дн.`;
}

export const PERIODS = [
  { value: "3", label: "3 мес." },
  { value: "6", label: "6 мес." },
  { value: "12", label: "Год" },
  { value: "all", label: "Всё время" },
] as const;

export const STOP_COLOR = "#c4c6cb";

export const REASON_COLORS: Record<string, string> = {
  price: "oklch(0.6 0.19 25)",
  silent: "oklch(0.76 0.15 75)",
  other_maker: "oklch(0.52 0.16 268)",
  moq: "oklch(0.6 0.13 300)",
  dossier: "oklch(0.62 0.13 200)",
  priority: "#c4c6cb",
  other: "#8b8f97",
  none: "#e3e3df",
};

export type Section = "overview" | "factories" | "countries" | "funnel";

export const SECTION_LABELS: Record<Section, string> = {
  overview: "Обзор",
  factories: "Заводы",
  countries: "Страны",
  funnel: "Воронка и динамика",
};

function query(params: Record<string, string | null | undefined>) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) out.set(key, value);
  }
  const text = out.toString();
  return text ? `?${text}` : "";
}

export function offersUrl(
  params: Record<string, string | null | undefined>, base = "/vpc",
): string {
  return `${base}/offers${query(params)}`;
}

export function factoryUrl(maker: string, base = "/vpc"): string {
  return `${base}/factories/view${query({ maker })}`;
}

export function countryUrl(
  code: string, mode = "target", base = "/vpc",
): string {
  return `${base}/countries/view${query({
    code, mode: mode === "target" ? null : mode,
  })}`;
}

export function listUrl(
  section: Section,
  params: Record<string, string | null | undefined>,
  base = "/vpc",
): string {
  return `${base}/${section}/list${query(params)}`;
}

export const STAGE_NAMES: Record<string, string> = {
  Вб: "Выборка",
  ПО: "Прогноз объёма",
  АЦ: "Анализ цен",
  ПцКк: "Процесс контракта",
  Кк: "Контракт",
  ПцР: "Процесс регистрации",
  Р: "Получено РУ",
  За: "Заявка",
};

export function countryScope(d: CountryDetail): Record<string, string> {
  return { [d.mode === "target" ? "target" : "maker_country"]: d.code };
}

export function otherKey(d: CountryDetail): string {
  return d.mode === "target" ? "maker_country" : "target";
}

export function otherMode(d: CountryDetail): "target" | "maker" {
  return d.mode === "target" ? "maker" : "target";
}
