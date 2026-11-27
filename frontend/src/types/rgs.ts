export type RgsGroup = "prep" | "submit" | "exp1" | "exp2" | "ru" | "stop";
export type RgsView = "" | RgsGroup | "red_cycle" | "red_ru" | "check";
export type RgsCategory = "M" | "FS" | "MD";
export type Tone = "grn" | "amb" | "red" | "na";

export interface RgsReport {
  rows: number;
  new: number;
  duplicates: number;
  sheets: Record<string, number>;
  columns: Record<string, Record<string, string>>;
  missing: Record<string, string[]>;
  optional?: Record<string, string[]>;
  unknown_statuses: Record<string, number>;
  bad_dates: Record<string, number>;
  norms_sheet?: boolean;
  norms?: Record<string, number>;
}

export interface RgsMeta {
  loaded: boolean;
  market: string;
  name: string;
  data_date?: string | null;
  today?: string;
  rows?: number;
  file_name?: string;
  uploaded_at?: string;
  checks?: number;
}

export interface RgsSpan {
  fact: number | null;
  norm: number | null;
  red: number | null;
  tone: Tone;
  running: boolean;
}

export interface RgsRuPlan {
  plan: string | null;
  days: number | null;
  tone: Tone;
  got: boolean;
  late: number | null;
  source: "tracker" | "norm" | null;
}

export interface RgsKpi {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  base: string;
  tone: Tone;
  goal: number;
  red: number;
  up: boolean;
  how: string;
}

export interface RgsStageAvg {
  key: string;
  name: string;
  codes: string;
  norm: number | null;
  red: number | null;
  fact: number | null;
  count: number;
  tone: Tone;
}

export interface RgsDuration {
  key: string;
  label: string;
  median: number | null;
  mean: number | null;
  count: number;
}

export interface RgsMonth {
  month: string;
  count: number;
  this_year: boolean;
}

export interface RgsRuDue extends RgsRuPlan {
  id: number;
  tm: string;
  sub: string;
  manager: string | null;
}

export interface RgsCheck {
  id: number;
  tm: string;
  sub: string;
  manager: string | null;
  sheet: string | null;
  row: number | null;
  kind: string;
  text: string;
}

export interface RgsChecks {
  count: number;
  items: RgsCheck[];
}

export interface RgsManagerRow {
  name: string;
  count: number;
  cycle: number | null;
  cycle_tone: Tone;
  red_ru: number;
}

export interface RgsOverview {
  today: string;
  split: boolean;
  ru_days: Record<string, number>;
  ru_warn: number;
  filters: {
    years: { value: string; count: number }[];
    products: { tm: string; count: number }[];
  };
  categories: Record<string, number>;
  in_work: number;
  kpis: RgsKpi[];
  stages: RgsStageAvg[];
  durations: RgsDuration[];
  ru_due: RgsRuDue[];
  funnel: { key: string; name: string; codes: string; count: number }[];
  managers: RgsManagerRow[];
  checks: RgsChecks;
  months: {
    items: RgsMonth[];
    overdue: number;
    no_plan: number;
    later: number;
    totals: { label: string; count: number; month?: string }[];
  };
  stopped: number;
}

export interface RgsVariant {
  id: number;
  generic: string | null;
  form: string | null;
  dose: string | null;
  pack: string | null;
  group: RgsGroup;
}

export interface RgsGroupRow {
  tm: string;
  manufacturer: string | null;
  generic: string | null;
  form: string | null;
  category: string | null;
  comment: string | null;
  count: number;
  variants: RgsVariant[];
}

export interface RgsGroups {
  month?: string;
  count: number;
  groups: { name: string; count: number; rows: RgsGroupRow[] }[];
}

export interface RgsRow {
  id: number;
  tm: string;
  generic: string | null;
  form: string | null;
  dose: string | null;
  pack: string | null;
  manufacturer: string | null;
  category: string | null;
  is_new: boolean;
  manager: string | null;
  group: RgsGroup;
  status_code: string | null;
  status_by_date: string | null;
  status_issue: boolean;
  plan_submit: string | null;
  submitted: string | null;
  delay: RgsSpan;
  cycle: RgsSpan;
  ru: RgsRuPlan;
  checks: number;
}

export interface RgsProducts {
  counts: Record<string, number>;
  managers: { name: string; count: number }[];
  items: RgsRow[];
}

export interface RgsStep extends RgsSpan {
  key: string;
  name: string;
  codes: string;
  date: string | null;
  total: boolean;
}

export interface RgsProduct extends RgsRow {
  tm_ru: string | null;
  owner: string | null;
  applicant: string | null;
  status_label: string | null;
  issues: { kind: string; text: string }[];
  shift: number | null;
  ru_term: number | null;
  steps: RgsStep[];
  dossier_req: string | null;
  dossier_analysis: string | null;
  reason_code: string | null;
  next_step: string | null;
  step_due: string | null;
  step_overdue: boolean;
  comments: { label: string; text: string }[];
  docs: { name: string; ok: boolean }[];
  sheet: string | null;
  row: number | null;
  plan_moves: { at: string; old: string; new: string }[];
}

export interface RgsSnapshot {
  id: number;
  date: string;
  file_name: string;
  current: boolean;
}

export interface RgsKpiRow {
  name: string;
  count: number;
  kpis: RgsKpi[];
}

export interface RgsKpiTable {
  kpis: RgsKpi[];
  managers: RgsKpiRow[];
  total: RgsKpiRow;
  dynamics: (RgsSnapshot & { values: Record<string, number | null> })[];
}

export interface RgsBriefRow {
  id: number;
  tm: string;
  sub: string;
  manager: string | null;
}

export interface RgsChanges {
  current: RgsSnapshot;
  base: RgsSnapshot | null;
  snapshots: RgsSnapshot[];
  new_red?: (RgsBriefRow & { metric: string; label: string; value: number | null })[];
  moved?: (RgsBriefRow & { from: string; to: string })[];
  plan_moves?: (RgsBriefRow & { old: string; new: string; days: number })[];
  ru_soon?: (RgsBriefRow & { plan: string; days: number })[];
  added?: RgsBriefRow[];
}
