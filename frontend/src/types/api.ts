import type { RgsReport } from "./rgs";

export interface SessionUser {
  id: number;
  username: string;
  role: string;
  permissions: string[];
  markets: string[] | null;
  own_only?: boolean;
}

export interface Market {
  id: number;
  code: string;
  name: string;
  enabled_vpc_market: boolean;
  enabled_rgs: boolean;
}

export interface MarketCreateBody {
  code: string;
  name: string;
  enabled_vpc_market: boolean;
  enabled_rgs: boolean;
}

export type MarketUpdateBody = Partial<Omit<MarketCreateBody, "code">>;

export interface UserRow {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  markets: string[];
  grants: string[];
  own_only: boolean;
  source_names: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface UserCreateBody {
  username: string;
  password: string;
  role: string;
  markets: string[];
  grants: string[];
  own_only: boolean;
  source_names: string | null;
}

export interface UserUpdateBody {
  role?: string;
  is_active?: boolean;
  markets?: string[];
  grants?: string[];
  own_only?: boolean;
  source_names?: string | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  username: string | null;
  action: string;
  market_code: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditPage {
  total: number;
  items: AuditEntry[];
}

export interface VpcReport {
  sheet: string;
  header_row: number;
  columns: number;
  rows_read: number;
  rows_loaded: number;
  skipped_no_generic: number;
  duplicates: number;
  bad_dates: number;
  missing_fields: string[];
  missing_stage_dates: string[];
  detected: Record<string, string>;
  duplicate_headers: string[];
  extra_columns: string[];
  unknown_statuses: Record<string, number>;
  unknown_total: number;
  states: Record<string, number>;
  targets: Record<string, number>;
  with_price: number;
  price_sources: Record<string, number>;
  currencies: Record<string, number>;
  new_markets: string[];
}

export interface ImportRow {
  id: number;
  kind: string;
  market_code: string | null;
  file_name: string;
  data_date: string | null;
  rows: number;
  uploaded_by: string | null;
  uploaded_at: string;
  is_current: boolean;
  report: VpcReport | RgsReport | null;
}
