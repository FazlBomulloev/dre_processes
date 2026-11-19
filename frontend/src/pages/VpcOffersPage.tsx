import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { getFacets, getOffers } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { ErrorNote, Loading } from "../components/ui/states";
import { FilterPill } from "../components/vpc/FilterPill";
import { OfferPanel } from "../components/vpc/OfferPanel";
import { OffersTable } from "../components/vpc/OffersTable";
import { MnnCards } from "../components/vpc/MnnCards";
import { ProductHero } from "../components/vpc/ProductHero";import { VpcGate } from "../components/vpc/VpcGate";
import { VpcSearch } from "../components/vpc/VpcSearch";
import { useOutsideClose } from "../hooks/useDismiss";
import { useVpcLinks } from "../hooks/useVpcScope";
import { useFetch } from "../hooks/useFetch";
import {
  DEFAULT_PRICE, FILTER_KEYS, MAIN_FILTERS, MORE_FILTERS, PAGE_SIZE,
  useVpcParams, type Patch,
} from "../hooks/useVpcParams";
import { formatDate } from "../lib/format";
import { FILTER_LABELS, PRICE_COLUMNS } from "../lib/vpc";
import type { FacetOption, VpcFacets } from "../types/vpc";

function only(patch: Patch): Patch {
  const cleared: Patch = Object.fromEntries(
    FILTER_KEYS.map((k) => [k, null]),
  );
  return { ...cleared, offer: null, tab: null, ...patch };
}

export default function VpcOffersPage() {
  return (
    <VpcGate title="Предложения заводов">
      <Offers />
    </VpcGate>
  );
}

function Offers() {
  const { factoryUrl, market } = useVpcLinks();
  const navigate = useNavigate();
  const { get, filters, table, page, set, reset, active } = useVpcParams();
  const [more, setMore] = useState(
    () => MORE_FILTERS.some((k) => !!filters[k]),
  );

  const offerParams = useMemo(
    () => ({ ...filters, ...table }),
    [filters, table],
  );
  const offers = useFetch(
    (signal) => getOffers(offerParams, signal),
    [offerParams],
    "Не удалось загрузить предложения",
  );
  const facets = useFetch(
    (signal) => getFacets(filters, signal),
    [filters],
  );
  const facetData = facets.loading ? undefined : facets.data ?? undefined;

  const offerId = Number(get("offer")) || null;
  const data = offers.data;
  const product = data?.product ?? null;

  const pill = (key: string) => (
    <FilterPill
      key={key}
      label={FILTER_LABELS[key]}
      value={get(key)}
      options={facetOptions(facetData, key)}
      onChange={(value) => set({ [key]: value })}
    />
  );

  const subtitle = (
    <>
      Цены и условия по продукту — от самой выгодной
      {data && ` · данные на ${formatDate(data.data_date)}`}
    </>
  );

  return (
    <Page maxWidth={1920} dim={offers.loading && !!offers.data}>
      <PageHeader title="Предложения заводов" subtitle={subtitle}>
        <VpcSearch
          value={get("q")}
          onSearch={(q) => set({ q })}
          onPick={(s) => set(only({ [s.kind]: s.value }))}
        />
      </PageHeader>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-full bg-surface p-[5px] max-md:rounded-2xl">
          {MAIN_FILTERS.filter((k) => !(market && k === "target"))
            .map(pill)}
          <span className="mx-1.5 h-5 w-px bg-line-strong max-md:hidden" />
          <PriceMenu
            value={filters.price}
            onChange={(price) => set({
              price: price === DEFAULT_PRICE ? null : price,
            })}
          />
          <Toggle
            label="Только с ценой"
            on={filters.priced === "true"}
            onChange={(on) => set({ priced: on ? "1" : null })}
          />
          <Toggle
            label="Только активные"
            title="Все, кроме стопа и «не в портфеле»"
            on={filters.active === "true"}
            onChange={(on) => set({ active: on ? "1" : null })}
          />
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className="tr-soft h-9 rounded-full border-0 bg-transparent px-3.5 text-[13px] font-medium text-accent hover:bg-subtle"
          >
            {more ? "Скрыть фильтры" : "Ещё фильтры"}
          </button>
          {active && (
            <button
              type="button"
              onClick={reset}
              className="tr-soft h-9 rounded-full border-0 bg-transparent px-3.5 text-[13px] text-muted hover:bg-subtle hover:text-fg"
            >
              Сбросить всё
            </button>
          )}
        </div>
        {more && (
          <div className="anim-pop flex flex-wrap items-center gap-1 rounded-full bg-surface p-[5px] max-md:rounded-2xl">
            {MORE_FILTERS.map(pill)}
          </div>
        )}
        {filters.q && (
          <span className="px-2 text-[13px] text-muted">
            Поиск: «{filters.q}» — по МНН, заводу, номеру и комментариям
          </span>
        )}
      </div>

      {offers.error && <ErrorNote>{offers.error}</ErrorNote>}
      {!data && !offers.error && <Loading className="py-16" />}

      {data && product && (
        <ProductHero
          product={product}
          onTab={(tab) => set({ tab })}
          onOffer={(id) => set({ offer: String(id) }, true)}
        />
      )}

      {data && !product && data.top_mnn.length > 0 && (
        <MnnCards
          cards={data.top_mnn}
          priceLabel={PRICE_COLUMNS.find((p) => p.value === filters.price)
            ?.label ?? filters.price}
          onPick={(mnn) => set({ mnn })}
          onOffer={(id) => set({ offer: String(id) }, true)}
        />
      )}

      {data && (
        <OffersTable
          data={data}
          tab={table.tab}
          sort={table.sort}
          desc={table.desc === "true"}
          page={page}
          pageSize={PAGE_SIZE}
          product={!!product && product.products.length === 0}
          loading={offers.loading}
          onTab={(tab) => set({ tab: tab === "all" ? null : tab })}
          onSort={(sort, desc) => set({
            sort: sort === "price" ? null : sort,
            desc: desc ? "1" : null,
          })}
          onPage={(next) => {
            set({ page: next > 1 ? String(next) : null }, true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onOpen={(id) => set({ offer: String(id) }, true)}
        />
      )}

      {offerId && (
        <OfferPanel
          id={offerId}
          params={filters}
          onClose={() => set({ offer: null }, true)}
          onMnn={(card) => set(only({ mnn: card.generic }))}
          onMaker={(maker) => navigate(factoryUrl(maker))}
        />
      )}
    </Page>
  );
}

function facetOptions(
  facets: VpcFacets | undefined, key: string,
): FacetOption[] | undefined {
  return facets ? facets[key] ?? [] : undefined;
}

function Toggle({
  label, title, on, onChange,
}: {
  label: string;
  title?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={() => onChange(!on)}
      className="tr-soft flex h-9 items-center gap-2 rounded-full border-0 bg-transparent px-3 text-[13px] text-fg-2 hover:bg-subtle"
    >
      <span
        className={clsx(
          "tr-soft relative h-[18px] w-[30px] rounded-full",
          on ? "bg-fg" : "bg-line-strong",
        )}
      >
        <span
          className={clsx(
            "tr-soft absolute top-[2px] size-[14px] rounded-full bg-white",
            on ? "left-[14px]" : "left-[2px]",
          )}
        />
      </span>
      {label}
    </button>
  );
}

function PriceMenu({
  value, onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));
  const current = PRICE_COLUMNS.find((p) => p.value === value)
    ?? PRICE_COLUMNS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "tr-soft flex h-9 items-center gap-1.5 rounded-full border-0 px-3.5 text-[13px]",
          value !== DEFAULT_PRICE || open
            ? "bg-subtle text-fg"
            : "bg-transparent text-muted hover:bg-subtle hover:text-fg",
        )}
      >
        Цена: <b className="font-semibold">{current.label}</b>
        <ChevronDown size={12} strokeWidth={2.6} />
      </button>
      {open && (
        <div className="anim-pop absolute left-0 top-[calc(100%+6px)] z-30 flex w-64 flex-col rounded-2xl bg-white p-1.5 shadow-pop">
          {PRICE_COLUMNS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(p.value);
              }}
              className={clsx(
                "tr-soft rounded-[10px] border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-subtle",
                p.value === current.value && "font-semibold",
              )}
            >
              {p.label}
            </button>
          ))}
          <span className="px-3 pb-1 pt-2 text-[11px] leading-snug text-faint">
            «Последняя известная» — Согл.Цена, иначе Наша цена 2, Наша
            цена 1, Цена в USD.
          </span>
        </div>
      )}
    </div>
  );
}
