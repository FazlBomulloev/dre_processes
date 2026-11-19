import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { getOffers, getSummary } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { ErrorNote, Loading } from "../components/ui/states";
import { type Crumb, Crumbs, KpiCard } from "../components/vpc/insight";
import { OfferFromUrl } from "../components/vpc/OfferFromUrl";
import { OffersTable } from "../components/vpc/OffersTable";
import { VpcGate } from "../components/vpc/VpcGate";
import { useVpcLinks } from "../hooks/useVpcScope";
import { useFetch } from "../hooks/useFetch";
import { useOpenOffer } from "../hooks/useOpenOffer";
import { FILTER_KEYS, PAGE_SIZE } from "../hooks/useVpcParams";
import { formatInt } from "../lib/format";
import {
  FILTER_LABELS, SECTION_LABELS, STAGE_NAMES, type Section, TABS,
  formatDays, plural,
} from "../lib/vpc";

const SECTIONS: Section[] = ["overview", "factories", "countries", "funnel"];
const CHIP_KEYS = [...FILTER_KEYS, "state", "category", "stage"];

export default function VpcListPage() {
  return (
    <VpcGate title="Список предложений">
      <List />
    </VpcGate>
  );
}

function List() {
  const { factoryUrl, countryUrl, base, market } = useVpcLinks();
  const params = useParams();
  const section = SECTIONS.includes(params.section as Section)
    ? params.section as Section
    : "countries";
  const [search, setSearch] = useSearchParams();
  const openOffer = useOpenOffer();

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of CHIP_KEYS) {
      const value = search.get(key);
      if (value) out[key] = value;
    }
    out.priced = search.get("priced") === "1" ? "true" : "false";
    if (market) out.target = market;
    return out;
  }, [search, market]);

  const page = Math.max(1, Number(search.get("page")) || 1);
  const tab = search.get("tab") || "all";
  const sort = search.get("sort") || "days";
  const desc = search.get("desc") !== "0";
  const table = {
    tab,
    sort,
    desc: desc ? "true" : "false",
    offset: String((page - 1) * PAGE_SIZE),
    limit: String(PAGE_SIZE),
  };

  const set = (patch: Record<string, string | null>, keepPage = false) => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!keepPage) next.delete("page");
      return next;
    });
  };

  const offers = useFetch(
    (signal) => getOffers({ ...filters, ...table }, signal),
    [filters, table],
    "Не удалось загрузить предложения",
  );
  const summary = useFetch(
    (signal) => getSummary({ ...filters, tab }, signal),
    [filters, tab],
  );
  const s = summary.data;
  const data = offers.data;

  const stageName = filters.stage ? STAGE_NAMES[filters.stage] : null;
  const place = s?.target_name ?? filters.target ?? filters.maker_country;
  const title = [
    stageName ?? (tab === "stop" ? "Остановленные" : null),
    filters.maker,
    place,
  ].filter(Boolean).join(" · ") || "Предложения";

  const crumbs: Crumb[] = [
    {
      label: SECTION_LABELS[section],
      to: section === "overview" ? base : `${base}/${section}`,
    },
  ];
  if (section === "countries" && (filters.target || filters.maker_country)) {
    crumbs.push({
      label: place ?? "",
      to: filters.target
        ? countryUrl(filters.target)
        : countryUrl(filters.maker_country ?? "", "maker"),
    });
  }
  if (section === "factories" && filters.maker) {
    crumbs.push({ label: filters.maker, to: factoryUrl(filters.maker) });
  }
  crumbs.push({ label: stageName ?? "Список" });

  const chips = [
    ...CHIP_KEYS.filter((k) => filters[k] && !(market && k === "target"))
      .map((k) => ({
      key: k,
      label: k === "stage" ? "Этап" : FILTER_LABELS[k] ?? "Поиск",
      value: filters[k],
    })),
    ...(tab !== "all" ? [{
      key: "tab",
      label: "Состояние",
      value: TABS.find((t) => t.value === tab)?.label ?? tab,
    }] : []),
  ];
  const offersLink = `${base}/offers?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(filters).filter(([k]) => FILTER_KEYS.includes(k)),
    ),
  ).toString()}&priced=0`;

  return (
    <Page maxWidth={1440} dim={offers.loading && !!offers.data}>
      <Crumbs items={crumbs} />
      <div className="anim-head flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="m-0 text-[30px] font-semibold leading-tight tracking-[-0.02em]">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <span
                key={c.key}
                className="flex items-center gap-1.5 rounded-full bg-accent-tint py-1 pl-3 pr-1 text-[13px] text-accent"
              >
                {c.label}: <b className="font-semibold">{c.value}</b>
                <button
                  type="button"
                  aria-label={`Убрать «${c.label}»`}
                  onClick={() => set({ [c.key]: null })}
                  className="tr-soft flex size-6 items-center justify-center rounded-full border-0 bg-transparent text-accent hover:bg-white"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <Link
              to={offersLink}
              className="flex items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-hover"
            >
              Открыть в «Предложениях» <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          <KpiCard
            index={0}
            label="Предложений"
            value={formatInt(s.offers)}
            note={`по ${formatInt(s.products)} `
              + plural(s.products, "продукту", "продуктам", "продуктам")}
          />
          <KpiCard
            index={1}
            label="Заводов"
            value={formatInt(s.makers)}
            note={`из ${s.maker_countries} `
              + plural(s.maker_countries, "страны", "стран", "стран")}
          />
          <KpiCard
            index={2}
            label="В среднем в статусе"
            value={formatDays(s.avg_days)}
            note="дней в текущем статусе"
          />
        </div>
      )}

      {offers.error && <ErrorNote>{offers.error}</ErrorNote>}
      {!data && !offers.error && <Loading className="py-16" />}
      {data && (
        <OffersTable
          data={data}
          tab={tab}
          sort={sort}
          desc={desc}
          page={page}
          pageSize={PAGE_SIZE}
          product={false}
          loading={offers.loading}
          onTab={(next) => set({ tab: next === "all" ? null : next })}
          onSort={(nextSort, nextDesc) => set({
            sort: nextSort === "days" ? null : nextSort,
            desc: nextDesc ? null : "0",
          })}
          onPage={(next) => {
            set({ page: next > 1 ? String(next) : null }, true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onOpen={openOffer}
        />
      )}
      <OfferFromUrl params={filters} />
    </Page>
  );
}
