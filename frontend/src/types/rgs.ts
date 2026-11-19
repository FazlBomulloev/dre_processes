export type RgsStage = "prep" | "wait" | "exp1" | "exp2" | "ru" | "stop";
export type RgsCategory = "M" | "FS" | "MD";

export interface RgsReport {
  rows: number;
  new: number;
  duplicates: number;
  sheets: Record<string, number>;
  columns: Record<string, Record<string, string>>;
  missing: Record<string, string[]>;
  unknown_statuses: Record<string, number>;
  bad_dates: Record<string, number>;
}

export interface RgsMeta {
  loaded: boolean;
  market: string;
  name: string;
  data_date?: string | null;
  rows?: number;
  file_name?: string;
  uploaded_at?: string;
}

export interface RgsStep {
  key: string;
  name: string;
  reached: number;
  now: number;
}

export interface RgsMonth {
  month: string;
  count: number;
  this_year: boolean;
}

export interface RgsDuration {
  key: string;
  label: string;
  median: number | null;
  mean: number | null;
  count: number;
}

export interface RgsBrief {
  id: number;
  tm: string;
  manufacturer: string | null;
  generic: string | null;
  form: string | null;
  category: string | null;
}

export interface RgsBlocker extends RgsBrief {
  comment: string | null;
  days: number;
  plan_submit: string;
  kind: "long" | "problem";
}

export interface RgsOverview {
  today: string;
  plan_date: string | null;
  margin: number;
  categories: Record<string, number>;
  now: {
    in_work: number;
    submitted: number;
    ru_this_year: number;
    ru_next_year: number;
    year: number;
  };
  steps: RgsStep[];
  months: {
    items: RgsMonth[];
    no_plan: number;
    later: number;
    totals: { label: string; count: number; month?: string }[];
  };
  plan: {
    total: number;
    submitted: number;
    on_time: number;
    late: number;
    late_median: number | null;
    not_submitted: number;
  };
  durations: RgsDuration[];
  blockers: RgsBlocker[];
  split_blockers: boolean;
  stopped: number;
}

export interface RgsVariant {
  id: number;
  generic: string | null;
  form: string | null;
  dose: string | null;
  pack: string | null;
  stage: RgsStage;
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

export interface RgsRow extends RgsBrief {
  dose: string | null;
  pack: string | null;
  is_new: boolean;
  stage: RgsStage;
  submitted: string | null;
  plan_submit: string | null;
  overdue: boolean;
  plan_ru: string | null;
  plan_ru_raw: string | null;
}

export interface RgsProducts {
  counts: Record<string, number>;
  items: RgsRow[];
}

export interface RgsProduct extends RgsRow {
  tm_ru: string | null;
  owner: string | null;
  applicant: string | null;
  status_code: string | null;
  group_code: string | null;
  comment: string | null;
  shift: number | null;
  timeline: { key: string; label: string; date: string | null }[];
  docs: { name: string; ok: boolean }[];
}
