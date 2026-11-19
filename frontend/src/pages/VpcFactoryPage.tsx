import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { getFactory } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { BTN_SECONDARY } from "../components/ui/Modal";
import { EmptyCard, Loading } from "../components/ui/states";
import { CountryCode, StatusBadge } from "../components/vpc/chips";
import { Crumbs, HeroStat, SectionCard } from "../components/vpc/insight";
import { OfferFromUrl } from "../components/vpc/OfferFromUrl";
import { VpcGate } from "../components/vpc/VpcGate";
import { useVpcLinks, useVpcScope } from "../hooks/useVpcScope";
import { useFetch } from "../hooks/useFetch";
import { useOpenOffer } from "../hooks/useOpenOffer";
import { formatDate, formatInt } from "../lib/format";
import {
  STATE_COLORS, STOP_COLOR, formatDays, formatPct, formatPrice,
  formatSigned,
} from "../lib/vpc";
import type { FactoryProduct, FactoryProfile, StageCount } from "../types/vpc";

export default function VpcFactoryPage() {
  return (
    <VpcGate title="Профиль завода">
      <Factory />
    </VpcGate>
  );
}

function Factory() {
  const { base, market } = useVpcScope();
  const [search] = useSearchParams();
  const maker = search.get("maker") ?? "";
  const data = useFetch(
    (signal) => getFactory(maker, market, signal),
    [maker, market],
    "Завод не найден",
  );
  const p = data.loading ? null : data.data;

  return (
    <Page maxWidth={1440} dim={data.loading && !!data.data}>
      <Crumbs
        items={[
          { label: "Заводы", to: `${base}/factories` },
          { label: p?.maker ?? maker },
        ]}
      />
      {data.error && (
        <EmptyCard title="Завод не найден" description={data.error} />
      )}
      {!p && !data.error && <Loading className="py-16" />}
      {p && <Profile profile={p} />}
      <OfferFromUrl />
    </Page>
  );
}

function Profile({ profile: p }: { profile: FactoryProfile }) {
  const openOffer = useOpenOffer();
  const { offersUrl } = useVpcLinks();
  const facts = [
    p.first_date && `Первое предложение ${formatDate(p.first_date)}`,
    p.last_date && `последнее движение ${formatDate(p.last_date)}`,
    p.bdm && `БДМ ${p.bdm}`,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <section className="anim-rise grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-x-11 gap-y-8 rounded-hero bg-ink px-[30px] py-7 text-white max-lg:grid-cols-1 max-md:px-5">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-fg-2">Завод</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 break-words text-[38px] font-semibold uppercase leading-none tracking-[-0.02em] max-md:text-[28px]">
                {p.maker}
              </h1>
              {p.country && (
                <span className="rounded-md bg-ink-glass px-2 py-1 text-xs font-semibold">
                  {p.country}
                </span>
              )}
              {p.category && (
                <span className="rounded-md bg-ink-glass px-2 py-1 text-xs font-semibold">
                  {p.category}
                </span>
              )}
            </div>
            {facts && <span className="text-sm text-ink-fg-2">{facts}</span>}
          </div>
          <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
            <HeroStat
              label="Предложений"
              value={formatInt(p.offers)}
              note={`${p.mnn} МНН`}
            />
            <HeroStat
              label="Ценовой индекс"
              value={formatSigned(p.index)}
              note="к лучшей цене рынка"
              color={p.index == null ? undefined : p.index <= 0
                ? "var(--color-pos-on-ink)"
                : "var(--color-neg-on-ink)"}
            />
            <HeroStat
              label="Контракты"
              value={formatInt(p.contracts)}
              note={`${formatPct(p.contract_pct)} предложений`}
            />
            <HeroStat
              label="В статусе"
              value={formatDays(p.avg_days)}
              note="в среднем по тем, что в работе"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={offersUrl({ maker: p.maker, priced: "0" })}
              className="tr-soft flex items-center gap-1.5 rounded-full bg-ink-glass px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[oklch(1_0_0/0.14)] hover:text-white"
            >
              Все предложения завода <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <StageBars stages={p.stages} maker={p.maker} />
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-5 max-xl:grid-cols-1">
        <SectionCard
          title="Продукты завода и цена против рынка"
          note={`полоса — разброс цен всех заводов по продукту, точка — цена ${p.maker}`}
        >
          <Products rows={p.products} onOpen={openOffer} />
          {p.offers > p.products.length && (
            <Link
              to={offersUrl({ maker: p.maker, priced: "0" })}
              className={clsx(BTN_SECONDARY, "w-fit")}
            >
              Показать все {formatInt(p.offers)}
            </Link>
          )}
        </SectionCard>
        <SectionCard
          title="Последние события"
          note="смена статуса и комментарии"
        >
          {p.events.length === 0 ? (
            <span className="text-sm text-faint">Событий нет</span>
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {p.events.map((e) => (
                <li key={`${e.offer_id}:${e.date}`}>
                  <button
                    type="button"
                    onClick={() => openOffer(e.offer_id)}
                    className="tr-soft flex w-full gap-3 rounded-xl border-0 border-t border-line bg-transparent px-1 py-3 text-left hover:bg-subtle"
                  >
                    <span
                      className="mt-1.5 size-2.5 shrink-0 rounded-full"
                      style={{
                        background: STATE_COLORS[e.state],
                      }}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <b className="text-sm font-semibold">{e.title}</b>
                      {e.text && (
                        <span className="text-[13px] text-fg-2">
                          {e.text}
                        </span>
                      )}
                      <span className="text-xs text-faint">
                        {formatDate(e.date)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function StageBars({
  stages, maker,
}: {
  stages: StageCount[];
  maker: string;
}) {
  const { listUrl } = useVpcLinks();
  const max = Math.max(
    1, ...stages.filter((s) => s.code !== "stop").map((s) => s.count),
  );
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span className="text-[13px] text-ink-fg-2">
        Предложения завода по этапам
      </span>
      <div className="flex flex-col gap-0.5 rounded-inner bg-ink-glass p-3">
        {stages.map((s) => {
          const stop = s.code === "stop";
          return (
            <Link
              key={s.code}
              to={listUrl("factories", {
                maker,
                ...(stop ? { tab: "stop" } : { stage: s.code }),
              })}
              className="tr-soft grid grid-cols-[48px_minmax(0,140px)_minmax(0,1fr)_36px] items-center gap-3 rounded-lg px-2 py-1.5 text-white hover:bg-[oklch(1_0_0/0.06)] hover:text-white"
            >
              <b className="text-[13px] font-semibold">
                {stop ? "Стоп" : s.code}
              </b>
              <span className="truncate text-[13px] text-ink-fg-2">
                {s.name}
              </span>
              <span className="h-2 rounded-full bg-ink-glass">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(1, s.count / max) * 100}%`,
                    background: stop ? STOP_COLOR : stageColor(s.code),
                  }}
                />
              </span>
              <span className="text-right text-[13px] tabular-nums">
                {s.count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function stageColor(code: string): string {
  if (code === "Кк") return "var(--color-st-contract)";
  if (code === "Р" || code === "За") return "oklch(0.8 0.15 155)";
  return "oklch(0.7 0.12 268)";
}

function Products({
  rows, onOpen,
}: {
  rows: FactoryProduct[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong text-left text-xs text-faint">
            <th className="px-2 py-2.5 font-normal">Продукт</th>
            <th className="px-2 py-2.5 font-normal">Для</th>
            <th className="px-2 py-2.5 text-right font-normal">Согл. цена</th>
            <th className="px-2 py-2.5 text-right font-normal">Цена в USD</th>
            <th className="px-2 py-2.5 font-normal">Место в рынке</th>
            <th className="px-2 py-2.5 text-right font-normal">К мин.</th>
            <th className="px-2 py-2.5 font-normal">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r.id)}
              className={clsx(
                "tr-soft cursor-pointer border-b border-line hover:bg-subtle",
              )}
            >
              <td className="px-2 py-3">
                <span className="flex max-w-[220px] flex-col leading-tight">
                  <b className="truncate font-semibold">{r.generic}</b>
                  <span className="truncate text-xs text-faint">
                    {[r.form, r.dose, r.pack_n ? `№${r.pack_n}` : null]
                      .filter(Boolean).join(" · ")}
                  </span>
                </span>
              </td>
              <td className="px-2 py-3">
                <CountryCode code={r.target_country} />
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[13px] font-medium">
                {formatPrice(r.price_agreed)}
                {r.price_agreed != null && (
                  <span className="ml-1 font-sans text-[11px] text-faint">
                    {r.agreed_currency}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[13px] font-medium">
                {formatPrice(r.price)}
                {r.price != null && (
                  <span className="ml-1 font-sans text-[11px] text-faint">
                    USD
                  </span>
                )}
              </td>
              <td className="px-2 py-3">
                <Band row={r} />
              </td>
              <td className="px-2 py-3 text-right font-mono text-xs">
                {r.to_min == null ? (
                  <span className="text-faint">—</span>
                ) : r.to_min === 0 ? (
                  <span className="font-semibold text-pos">мин.</span>
                ) : (
                  <span className={r.to_min >= 50 ? "text-bad-ink" : "text-muted"}>
                    +{r.to_min}%
                  </span>
                )}
              </td>
              <td className="px-2 py-3">
                <StatusBadge
                  code={r.status_code}
                  state={r.state}
                  raw={r.status_raw}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Band({ row }: { row: FactoryProduct }) {
  if (row.price == null || row.low == null || row.high == null) {
    return <span className="text-xs text-faint">нет цены</span>;
  }
  const span = row.high - row.low;
  const at = span > 0 ? ((row.price - row.low) / span) * 100 : 0;
  return (
    <span className="flex w-[210px] flex-col gap-1">
      <span
        className="relative h-1 rounded-full"
        style={{
          background: "linear-gradient(90deg, oklch(0.62 0.14 155),"
            + " oklch(0.85 0.04 268), oklch(0.62 0.18 25))",
        }}
      >
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-fg"
          style={{ left: `${at}%` }}
        />
      </span>
      <span className="flex justify-between font-mono text-[10.5px] text-faint">
        <span>{formatPrice(row.low)}</span>
        <span className="font-sans">{row.makers} зав.</span>
        <span>{formatPrice(row.high)}</span>
      </span>
    </span>
  );
}
