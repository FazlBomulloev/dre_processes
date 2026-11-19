export interface VpcMeta {
  loaded: boolean;
  import_id?: number;
  data_date?: string;
  file_name?: string;
  rows?: number;
}

export interface VpcItem {
  id: number;
  offer_no: string | null;
  generic: string;
  form: string | null;
  dose: string | null;
  pack_raw: string | null;
  pack_n: number | null;
  maker: string | null;
  maker_country: string | null;
  maker_category: string | null;
  target_country: string | null;
  price: number | null;
  currency: string | null;
  price_agreed: number | null;
  agreed_currency: string | null;
  price_usd: number | null;
  price_src: string | null;
  to_min: number | null;
  status_code: string | null;
  status_raw: string | null;
  status_name: string;
  stage: string | null;
  state: string;
  days: number | null;
  bdm: string | null;
  analyst: string | null;
  responsible: string | null;
  last_comment: string | null;
  last_comment_date: string | null;
  status_date: string | null;
  updated_at: string | null;
}

export interface LadderStep {
  offer_id: number;
  maker: string | null;
  maker_country: string | null;
  status_code: string | null;
  state: string;
  target_country: string | null;
  price: number;
}

export interface ProductPrice {
  currency: string;
  priced: number;
  min: number;
  min_maker: string | null;
  min_country: string | null;
  min_offer_id: number;
  avg: number;
  max: number;
  max_ratio: number | null;
}

export interface ProductVariant {
  form: string | null;
  dose: string | null;
  offers: number;
  min_price: number | null;
}

export interface VpcProduct {
  generic: string | null;
  form: string | null;
  dose: string | null;
  offers: number;
  makers: number;
  maker_countries: number;
  targets: string[];
  contracts: number;
  states: Record<string, number>;
  products: ProductVariant[];
  price: ProductPrice | null;
  price_product: {
    form: string | null;
    dose: string | null;
    offers: number;
  } | null;
  ladder: LadderStep[];
  mixed_currency: boolean;
}

export interface FacetOption {
  value: string;
  count: number;
}

export type VpcFacets = Record<string, FacetOption[]>;

export interface VpcOffersResponse {
  total: number;
  tabs: Record<string, number>;
  items: VpcItem[];
  product: VpcProduct | null;
  top_mnn: MnnCard[];
  data_date: string;
}

export interface MnnCard {
  generic: string;
  offers: number;
  makers: number;
  products: number;
  form: string | null;
  dose: string | null;
  price: {
    currency: string;
    priced: number;
    min: number;
    avg: number;
    max: number;
  } | null;
  best: LadderStep[];
}

export interface Suggestion {
  kind: "mnn" | "maker";
  value: string;
  count: number;
}

export interface TimelineStep {
  code: string;
  name: string;
  date: string | null;
  reached: boolean;
  current: boolean;
}

export interface LabelValue {
  label: string;
  value: string;
}

export interface VpcCard extends VpcItem {
  rank: {
    place: number;
    of: number;
    min: number;
    min_maker: string | null;
    to_min: number | null;
  } | null;
  prices: Record<string, number | null>;
  zone: string | null;
  responsible: string | null;
  created_at: string | null;
  conditions: LabelValue[];
  other: LabelValue[];
  comments: string[];
  timeline: TimelineStep[];
  data_date: string;
}

export type Period = "3" | "6" | "12" | "all";
export type CountryMode = "target" | "maker";

export interface FactoryRow {
  maker: string;
  country: string | null;
  category: string | null;
  offers: number;
  mnn: number;
  targets: string[];
  states: Record<string, number>;
  index: number | null;
  contracts: number;
}

export interface FactoriesResponse {
  period: Period;
  total: number;
  kpi: {
    makers: number;
    maker_countries: number;
    new: number;
    new_days: number;
    active: number;
    active_pct: number | null;
    contract_makers: number;
    contract_pct: number | null;
    avg_to_contract: number | null;
  };
  rating: FactoryRow[];
  by_country: { country: string; offers: number; index: number | null }[];
}

export interface StageCount {
  code: string;
  name: string;
  count: number;
}

export interface FactoryProduct {
  id: number;
  generic: string;
  form: string | null;
  dose: string | null;
  pack_n: number | null;
  target_country: string | null;
  price: number | null;
  currency: string | null;
  price_agreed: number | null;
  agreed_currency: string | null;
  low: number | null;
  high: number | null;
  makers: number;
  to_min: number | null;
  status_code: string | null;
  status_raw: string | null;
  state: string;
}

export interface FactoryEvent {
  offer_id: number;
  date: string;
  title: string;
  text: string | null;
  state: string;
}

export interface FactoryProfile {
  maker: string;
  country: string | null;
  category: string | null;
  bdm: string | null;
  first_date: string | null;
  last_date: string | null;
  offers: number;
  mnn: number;
  index: number | null;
  contracts: number;
  contract_pct: number | null;
  avg_days: number | null;
  states: Record<string, number>;
  stages: StageCount[];
  products: FactoryProduct[];
  events: FactoryEvent[];
}

export interface CountryTotals {
  offers: number;
  products: number;
  states: Record<string, number>;
  contracts: number;
  conversion: number | null;
}

export interface CountryTile extends CountryTotals {
  code: string;
  name: string;
}

export interface CountriesResponse {
  mode: CountryMode;
  tiles: CountryTile[];
  stages: { code: string; name: string }[];
  heat: {
    code: string;
    name: string;
    counts: Record<string, number>;
    conversion: number | null;
  }[];
  origin: {
    country: string;
    offers: number;
    index: number | null;
    contracts: number;
  }[];
}

export interface CountryDetail extends CountryTotals {
  code: string;
  name: string;
  mode: CountryMode;
  stages: StageCount[];
  makers: {
    maker: string;
    country: string | null;
    offers: number;
    index: number | null;
  }[];
  people: {
    name: string;
    role: string;
    work: number;
    contracts: number;
  }[];
  average: number | null;
  links: CountryLink[];
  links_total: number;
  molecules: CountryMolecule[];
  molecules_total: number;
  stops: {
    total: number;
    reasons: CountryStop[];
  };
}

export interface Brief {
  offers: number;
  share: number | null;
  states: Record<string, number>;
  contracts: number;
  conversion: number | null;
}

export interface CountryBrief extends Brief {
  code: string;
  name: string;
}

export interface MnnBrief extends Brief {
  name: string;
}

export interface MakerBrief extends Brief {
  maker: string;
  country: string | null;
}

export interface CountryLink extends CountryBrief {
  index: number | null;
  mnn: MnnBrief[];
  makers: MakerBrief[];
}

export interface CountryMolecule extends MnnBrief {
  countries: number;
  makers_count: number;
  index: number | null;
  best: { maker: string | null; country: string | null } | null;
  links: CountryBrief[];
  makers: MakerBrief[];
}

export interface CountryStop {
  key: string;
  label: string;
  count: number;
  share: number | null;
  mnn: MnnBrief[];
  links: CountryBrief[];
}

export interface FunnelStep {
  code: string;
  name: string;
  reached: number;
  conversion: number | null;
  avg_days: number | null;
}

export interface FunnelResponse {
  period: Period;
  target: string | null;
  entered: number;
  contracts: number;
  contract_pct: number | null;
  registered: number;
  registered_pct: number | null;
  avg_to_contract: number | null;
  steps: FunnelStep[];
  reasons: {
    total: number;
    items: { key: string; label: string; count: number; pct: number }[];
  };
  months: {
    month: string;
    new: number;
    contracts: number;
    stops: number;
  }[];
}

export interface VpcSummary {
  offers: number;
  products: number;
  makers: number;
  maker_countries: number;
  avg_days: number | null;
  target_name?: string;
}

export interface OverviewMnn {
  generic: string;
  offers: number;
  products: number;
  makers: number;
  countries: number;
  targets: string[];
  contracts: number;
  states: Record<string, number>;
}

export interface OverviewMaker {
  maker: string;
  country: string | null;
  offers: number;
  mnn: number;
  contracts: number;
  index: number | null;
  states: Record<string, number>;
}

export interface OverviewShare {
  code: string;
  name: string;
  offers: number;
  pct: number | null;
  makers: number;
  contracts: number;
  conversion: number | null;
}

export interface OverviewKpi {
  offers: number;
  mnn: number;
  products: number;
  makers: number;
  maker_countries: number;
  targets: number;
  work: number;
  contracts: number;
  contract_pct: number | null;
  stopped: number;
  new: number;
  new_days: number;
  avg_to_contract: number | null;
}

export interface OverviewStage {
  code: string;
  name: string;
  count: number;
  avg_days: number | null;
}

export interface OverviewInsight {
  kind: "bottleneck" | "source" | "market" | "stop";
  title: string;
  text: string;
  tone: "bad" | "good" | "info" | "warn";
  code?: string;
  link: {
    to: "list" | "country";
    params: Record<string, string>;
  };
}

export interface OverviewStep {
  code: string;
  name: string;
  reached: number;
  conversion: number | null;
  lost: number | null;
}

export interface VpcOverview {
  kpi: OverviewKpi;
  states: Record<string, number>;
  stages: OverviewStage[];
  funnel: {
    steps: OverviewStep[];
    worst: { code: string; name: string; from: string; lost: number } | null;
  };
  insights: OverviewInsight[];
  mnn: OverviewMnn[];
  makers: OverviewMaker[];
  origin: OverviewShare[];
  targets: OverviewShare[];
  months: FunnelResponse["months"];
  filters: {
    responsible: { value: string; count: number }[];
    klass: { value: string; count: number }[];
    years: number[];
  };
  target: string | null;
  data_date: string;
}
