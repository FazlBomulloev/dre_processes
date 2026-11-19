export interface MonthPoint {
  month: string;
  new: number;
  contracts: number;
  stops: number;
}

export const MONTHS = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];
export const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function stageVar(code: string): string {
  if (code === "Р" || code === "За") return "var(--color-st-result)";
  if (code === "Кк" || code === "ПцР") return "var(--color-st-contract)";
  if (code === "stop") return "var(--color-st-stop)";
  return "var(--color-accent-bar)";
}

export function stageChip(code: string): string {
  if (code === "Р" || code === "За") return "bg-pos-tint text-pos";
  if (code === "Кк" || code === "ПцР") {
    return "bg-[oklch(0.95_0.03_200)] text-[oklch(0.42_0.09_200)]";
  }
  return "bg-accent-tint text-accent";
}

export const SERIES = [
  { key: "new", label: "Новые", color: "var(--color-accent-bar)" },
  { key: "contracts", label: "Контракты", color: "var(--color-st-result)" },
  { key: "stops", label: "Остановки", color: "#b9bcc3" },
] as const;

export function niceTop(value: number): number {
  const rough = value / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power)
    .find((s) => s >= rough) ?? power * 10;
  return Math.max(4, step * 4);
}

export function monthTitle(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
