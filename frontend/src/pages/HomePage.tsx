import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getMarkets } from "../api/client";
import { getCountries } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/Card";
import { EmptyCard, ErrorNote, Loading } from "../components/ui/states";
import { StateStrip } from "../components/vpc/insight";
import { useFetch } from "../hooks/useFetch";
import { useSession } from "../hooks/useSession";
import { formatInt } from "../lib/format";
import { stagger } from "../lib/anim";
import { MARKET_NAV } from "../lib/nav";
import { formatPct, pluralOffers } from "../lib/vpc";
import type { Market } from "../types/api";
import type { CountryTile } from "../types/vpc";

export default function HomePage() {
  const { can } = useSession();
  const markets = useFetch(
    (signal) => getMarkets(signal), [], "Не удалось загрузить рынки",
  );
  const vpc = can("module:vpc") || can("module:vpc_market");
  const tiles = useFetch(
    (signal) => vpc
      ? getCountries({ mode: "target" }, signal)
      : Promise.resolve(null),
    [vpc],
  );
  const stats = new Map(
    (tiles.data?.tiles ?? []).map((t) => [t.code, t]),
  );

  return (
    <Page maxWidth={1440}>
      <PageHeader title="Рынки" subtitle="Выберите рынок: внутри ВПЦ и RGS этого рынка">
        {can("module:vpc") && (
          <Link
            to="/vpc"
            className="tr-soft flex items-center gap-1.5 rounded-ctl bg-fg px-4 py-2.5 text-sm font-medium text-white hover:bg-fg-2 hover:text-white"
          >
            ВПЦ по всем рынкам <ArrowRight size={15} />
          </Link>
        )}
      </PageHeader>
      {markets.error && <ErrorNote>{markets.error}</ErrorNote>}
      {!markets.data && !markets.error && <Loading className="py-16" />}
      {markets.data && markets.data.length === 0 && (
        <EmptyCard
          title="Вам ещё не назначен рынок"
          description="Обратитесь к администратору."
        />
      )}
      {markets.data && markets.data.length > 0 && (
        <div className="grid grid-cols-3 gap-5 max-xl:grid-cols-2 max-md:grid-cols-1">
          {markets.data.map((m, i) => (
            <MarketCard
              key={m.code}
              market={m}
              stats={stats.get(m.code)}
              index={i}
            />
          ))}
        </div>
      )}
    </Page>
  );
}

function MarketCard({
  market, stats, index,
}: {
  market: Market;
  stats: CountryTile | undefined;
  index: number;
}) {
  const { can } = useSession();
  const sections = MARKET_NAV.filter((s) => s.allowed(can));
  const first = sections[0];
  const to = first
    ? `/market/${market.code}/${first.page}`
    : `/vpc/countries/view?code=${encodeURIComponent(market.code)}`;
  const enabled: Record<string, boolean> = {
    vpc: market.enabled_vpc_market,
    rgs: market.enabled_rgs,
  };

  return (
    <div
      className="anim-rise flex min-w-0 flex-col gap-4 rounded-card bg-surface px-6 py-5"
      style={stagger(index)}
    >
      <Link
        to={to}
        className="flex items-center gap-3 text-fg hover:text-accent"
      >
        <span className="rounded-lg bg-ink px-2.5 py-1 text-sm font-semibold text-white">
          {market.code}
        </span>
        <span className="truncate text-[19px] font-semibold tracking-[-0.01em]">
          {market.name}
        </span>
        <ArrowRight size={16} className="ml-auto shrink-0 text-faint" />
      </Link>
      {stats ? (
        <div className="flex flex-col gap-3">
          <span className="flex items-baseline gap-2">
            <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
              {formatInt(stats.offers)}
            </span>
            <span className="text-sm text-muted-2">
              {pluralOffers(stats.offers)} ВПЦ
            </span>
          </span>
          <StateStrip states={stats.states} />
          <span className="grid grid-cols-3 gap-2 text-sm">
            <Fact label="контрактов" value={formatInt(stats.contracts)} />
            <Fact label="до контракта" value={formatPct(stats.conversion)} />
            <Fact label="продуктов" value={formatInt(stats.products)} />
          </span>
        </div>
      ) : (
        <span className="text-sm text-faint">
          Предложений ВПЦ для рынка нет
        </span>
      )}
      {sections.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2">
          {sections.map((s) => (
            <Link
              key={s.page}
              to={`/market/${market.code}/${s.page}`}
              className="tr-soft flex items-center gap-2 rounded-full bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-fg hover:bg-seg hover:text-fg"
            >
              {s.label}
              {!enabled[s.page] && (
                <span className="text-[11px] font-normal text-faint">
                  не подключён
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <b className="text-[17px] font-semibold">{value}</b>
      <span className="text-[11px] text-faint">{label}</span>
    </span>
  );
}
