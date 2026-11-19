import { useSearchParams } from "react-router-dom";
import { getCountry } from "../api/vpc";
import { Page } from "../components/layout/Layout";
import { EmptyCard, Loading } from "../components/ui/states";
import { CountryDetailView } from "../components/vpc/CountryDetailView";
import { Crumbs } from "../components/vpc/insight";
import { OfferFromUrl } from "../components/vpc/OfferFromUrl";
import { VpcGate } from "../components/vpc/VpcGate";
import { useFetch } from "../hooks/useFetch";
import { useVpcScope } from "../hooks/useVpcScope";
import type { CountryMode } from "../types/vpc";

export default function VpcCountryPage() {
  return (
    <VpcGate title="Страна">
      <Country />
    </VpcGate>
  );
}

function Country() {
  const { base, market } = useVpcScope();
  const [search] = useSearchParams();
  const code = search.get("code") ?? "";
  const mode = (market ? "maker" : search.get("mode") || "target") as
    CountryMode;
  const data = useFetch(
    (signal) => getCountry(
      market ? { code, mode, target: market } : { code, mode }, signal,
    ),
    [code, mode, market],
    "Страна не найдена",
  );
  const d = data.loading ? null : data.data;

  return (
    <Page maxWidth={1440} dim={data.loading && !!data.data}>
      <Crumbs
        items={[
          {
            label: "Страны",
            to: mode === "target" || market
              ? `${base}/countries`
              : `${base}/countries?mode=maker`,
          },
          { label: d?.name ?? code },
        ]}
      />
      {data.error && (
        <EmptyCard title="Страна не найдена" description={data.error} />
      )}
      {!d && !data.error && <Loading className="py-16" />}
      {d && <CountryDetailView d={d} />}
      <OfferFromUrl />
    </Page>
  );
}
