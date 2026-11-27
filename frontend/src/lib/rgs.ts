import type { RgsKpi, RgsReport, Tone } from "../types/rgs";

export const RGS_GROUPS: { key: string; label: string; codes: string }[] = [
  { key: "prep", label: "Комплектация", codes: "d…dcz" },
  { key: "submit", label: "Подача", codes: "dh, dha" },
  { key: "exp1", label: "1-я экспертиза", codes: "dhp1" },
  { key: "exp2", label: "2-я экспертиза", codes: "dhp2" },
  { key: "ru", label: "Зарегистрировано", codes: "r" },
];

export const GROUP_LABEL: Record<string, string> = {
  ...Object.fromEntries(RGS_GROUPS.map((g) => [g.key, g.label])),
  stop: "Стоп",
};

export const GROUP_CHIP: Record<string, string> = {
  prep: "bg-subtle text-muted",
  submit: "bg-accent-tint text-accent",
  exp1: "bg-accent-soft/60 text-rgs-ink",
  exp2: "bg-rgs-ink text-white",
  ru: "bg-pos-tint text-pos",
  stop: "bg-seg text-faint",
};

export const TONE_PILL: Record<Tone, string> = {
  grn: "bg-pos-tint text-pos",
  amb: "bg-warn-tint text-warn-ink",
  red: "bg-bad-tint text-bad-ink",
  na: "bg-subtle text-muted-2",
};

export const TONE_BAR: Record<Tone, string> = {
  grn: "bg-pos",
  amb: "bg-cat-watch",
  red: "bg-bad",
  na: "bg-seg",
};

export const TONE_DOT_INK: Record<Tone, string> = {
  grn: "bg-pos-on-ink",
  amb: "bg-cat-watch",
  red: "bg-neg-on-ink",
  na: "bg-white/25",
};

export const TONE_LABEL: Record<Tone, string> = {
  grn: "Зелёный",
  amb: "Жёлтый",
  red: "Красный",
  na: "нет данных",
};

export const STATUS_HINT: Record<string, string> = {
  d: "задача получена",
  dcz: "досье готово: комплектация и перевод завершены",
  dh: "досье отправлено регистратору",
  dha: "досье подано в Минздрав",
  dhi: "счёт получен",
  dhp1: "1-я экспертиза оплачена",
  dhp2: "2-я экспертиза оплачена",
  r: "РУ получено",
};

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n).replace("-", "−");
}

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
  dossier_ready: "Досье готово (dcz)",
  sent_registrar: "Отправлено регистратору (dh)",
  submitted: "Подано (ПД)",
  plan_submit: "План подачи (Пл ПД)",
  ru_date: "Дата РУ",
  next_step: "Следующий шаг",
  step_due: "Срок шага",
  reason_code: "Код причины",
  comment_iz: "Комментарии ИЗ и ЧС",
  comment_bdm: "Комментарии БДМ",
  exp1_invoice: "Первичная: инвойс",
  exp1_paid: "Первичная: оплата",
  exp2_invoice: "Специализированная: инвойс",
  exp2_paid: "Специализированная: оплата",
  comment: "JS / IZ (Comments)",
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

export function kpiValue(k: RgsKpi): string {
  if (k.value == null) return "—";
  if (k.unit === "%") return `${k.value}%`;
  if (k.unit) return `${k.value} ${k.unit}`;
  return String(k.value);
}

function bound(k: RgsKpi, value: number): string {
  if (k.unit === "%") return `${value}%`;
  if (k.unit) return `${value} ${k.unit}`;
  return String(value);
}

export function kpiGoal(k: RgsKpi): string {
  if (k.up) return k.goal >= 100 ? bound(k, k.goal) : `≥ ${bound(k, k.goal)}`;
  return k.goal === 0 && !k.unit ? "0" : `≤ ${bound(k, k.goal)}`;
}

export function kpiRed(k: RgsKpi): string {
  return k.up ? `< ${bound(k, k.red)}` : `> ${bound(k, k.red)}`;
}
