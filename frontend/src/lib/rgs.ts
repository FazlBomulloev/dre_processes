import type { RgsReport, RgsStage } from "../types/rgs";

export const RGS_STAGES: { key: RgsStage; label: string }[] = [
  { key: "prep", label: "Готовится" },
  { key: "wait", label: "Ждёт экспертизы" },
  { key: "exp1", label: "Первичная оплачена" },
  { key: "exp2", label: "Специализированная оплачена" },
  { key: "ru", label: "РУ получено" },
  { key: "stop", label: "Стоп" },
];

export const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  RGS_STAGES.map((s) => [s.key, s.label]),
);

export const STAGE_CHIP: Record<string, string> = {
  prep: "bg-subtle text-muted",
  wait: "bg-accent-tint text-accent",
  exp1: "bg-accent-soft/60 text-rgs-ink",
  exp2: "bg-rgs-ink text-white",
  ru: "bg-pos-tint text-pos",
  stop: "bg-seg text-faint",
};

export const CATEGORIES = [
  { value: "", label: "Все" },
  { value: "M", label: "Лекарства" },
  { value: "FS", label: "БАДы" },
  { value: "MD", label: "Медизделия" },
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  M: "Лекарство", FS: "БАД", MD: "Медизделие",
};

export const FIELD_LABELS: Record<string, string> = {
  tm: "ТМ (англ.)",
  tm_ru: "ТМ (рус.)",
  generic: "МНН",
  form: "Форма",
  dose: "Дозировка",
  pack: "Упаковка",
  category: "Категория",
  owner: "Ответственный",
  manufacturer: "Производитель",
  applicant: "Заявитель",
  status_code: "Статус",
  group_code: "Группа (Упр Ктг)",
  is_new: "Новая позиция",
  task_date: "Дата задачи",
  dossier_req: "Запрос досье",
  dossier_analysis: "Анализ досье",
  submitted_may: "Подано (майский файл)",
  submitted_fact: "Подано (факт)",
  plan_submit: "План подачи",
  plan_ru: "План РУ",
  plan_ru_shifted: "План РУ с запасом",
  ru_date: "Дата РУ",
  exp1_invoice: "Первичная: инвойс",
  exp1_paid: "Первичная: оплата",
  exp2_invoice: "Специализированная: инвойс",
  exp2_paid: "Специализированная: оплата",
  comment: "Комментарий",
};

const MONTHS = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function monthShort(key: string): string {
  return MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
}

export function monthTitle(key: string): string {
  return `${MONTHS_FULL[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

export function monthEnd(key: string): string {
  return `${MONTHS_GEN[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

export function rgsProblems(report: RgsReport): number {
  const missing = Object.values(report.missing).flat().length;
  return missing + Object.keys(report.unknown_statuses).length
    + Object.keys(report.bad_dates).length + report.duplicates;
}

export function rgsUrl(code: string, page = ""): string {
  return `/market/${code}/rgs${page ? `/${page}` : ""}`;
}
