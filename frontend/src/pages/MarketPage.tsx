import {
  Link, Navigate, Route, Routes, useParams,
} from "react-router-dom";
import { getMarkets } from "../api/client";
import { Page } from "../components/layout/Layout";
import { EmptyCard, ErrorNote, Loading } from "../components/ui/states";
import { useFetch } from "../hooks/useFetch";
import { useSession } from "../hooks/useSession";
import { VpcScopeContext, marketScope } from "../hooks/useVpcScope";
import { MARKET_NAV } from "../lib/nav";
import RgsOverviewPage from "./RgsOverviewPage";
import RgsProductsPage from "./RgsProductsPage";
import RgsKpiPage from "./RgsKpiPage";
import RgsMeetingPage from "./RgsMeetingPage";
import RgsChecksPage from "./RgsChecksPage";
import VpcCountriesPage from "./VpcCountriesPage";
import VpcCountryPage from "./VpcCountryPage";
import VpcFactoriesPage from "./VpcFactoriesPage";
import VpcFactoryPage from "./VpcFactoryPage";
import VpcFunnelPage from "./VpcFunnelPage";
import VpcListPage from "./VpcListPage";
import VpcOffersPage from "./VpcOffersPage";
import VpcHome from "./VpcOverviewPage";

export default function MarketPage() {
  const { can } = useSession();
  const code = (useParams().code ?? "").toUpperCase();
  const markets = useFetch(
    (signal) => getMarkets(signal), [], "Не удалось загрузить рынки",
  );
  const sections = MARKET_NAV.filter((s) => s.allowed(can));

  if (markets.error) {
    return <Page><ErrorNote>{markets.error}</ErrorNote></Page>;
  }
  if (!markets.data) return <Page><Loading className="py-16" /></Page>;
  const market = markets.data.find((m) => m.code === code);
  if (!market) {
    return (
      <Page>
        <EmptyCard
          title="Рынок не найден"
          description="Такого рынка нет или он вам не назначен."
        >
          <Link to="/" className="text-sm font-medium">
            ← К списку рынков
          </Link>
        </EmptyCard>
      </Page>
    );
  }
  if (sections.length === 0) {
    return (
      <Page>
        <EmptyCard
          title="Разделы рынка не назначены"
          description="Попросите администратора выдать доступ к ВПЦ рынка или RGS."
        />
      </Page>
    );
  }
  const vpc = sections.some((s) => s.page === "vpc");
  const rgs = sections.some((s) => s.page === "rgs");

  return (
    <Routes>
      <Route
        index
        element={<Navigate to={sections[0].page} replace />}
      />
      {vpc && (
        <Route
          path="vpc/*"
          element={
            <VpcScopeContext value={marketScope(code)}>
              <MarketVpc />
            </VpcScopeContext>
          }
        />
      )}
      {rgs && (
        <Route path="rgs">
          <Route index element={<RgsOverviewPage />} />
          <Route path="products" element={<RgsProductsPage />} />
          <Route path="kpi" element={<RgsKpiPage />} />
          <Route path="meeting" element={<RgsMeetingPage />} />
          <Route path="checks" element={<RgsChecksPage />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Route>
      )}
      <Route path="*" element={<Navigate to={sections[0].page} replace />} />
    </Routes>
  );
}

function MarketVpc() {
  return (
    <Routes>
      <Route index element={<VpcHome />} />
      <Route path="offers" element={<VpcOffersPage />} />
      <Route path="factories" element={<VpcFactoriesPage />} />
      <Route path="factories/view" element={<VpcFactoryPage />} />
      <Route path="countries" element={<VpcCountriesPage />} />
      <Route path="countries/view" element={<VpcCountryPage />} />
      <Route path="funnel" element={<VpcFunnelPage />} />
      <Route path=":section/list" element={<VpcListPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
