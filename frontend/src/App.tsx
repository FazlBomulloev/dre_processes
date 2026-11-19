import type { ReactNode } from "react";
import {
  BrowserRouter, Navigate, Route, Routes, useLocation,
} from "react-router-dom";
import Layout from "./components/layout/Layout";
import { SessionContext, useSession, useSessionState } from "./hooks/useSession";
import { loginTarget } from "./lib/nav";
import AuditPage from "./pages/AuditPage";
import HomePage from "./pages/HomePage";
import ImportsPage from "./pages/ImportsPage";
import LoginPage from "./pages/LoginPage";
import MarketPage from "./pages/MarketPage";
import MarketsPage from "./pages/MarketsPage";
import UsersPage from "./pages/UsersPage";
import VpcCountriesPage from "./pages/VpcCountriesPage";
import VpcCountryPage from "./pages/VpcCountryPage";
import VpcFactoriesPage from "./pages/VpcFactoriesPage";
import VpcFactoryPage from "./pages/VpcFactoryPage";
import VpcFunnelPage from "./pages/VpcFunnelPage";
import VpcListPage from "./pages/VpcListPage";
import VpcOffersPage from "./pages/VpcOffersPage";
import VpcHome from "./pages/VpcOverviewPage";

function Guard() {
  const { user, pending } = useSession();
  const location = useLocation();
  if (pending) return <div className="min-h-(--screen-h) bg-canvas" />;
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <Layout />;
}

function LoginRoute() {
  const { user, pending } = useSession();
  const location = useLocation();
  if (pending) return <div className="min-h-(--screen-h) bg-ink" />;
  if (user) {
    return (
      <Navigate to={loginTarget(location.state, location.search)} replace />
    );
  }
  return <LoginPage />;
}

function Allowed({
  when, children,
}: {
  when: boolean;
  children: ReactNode;
}) {
  return when ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { can } = useSession();
  const vpc = can("module:vpc");
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<Guard />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/market/:code/*" element={<MarketPage />} />
        <Route
          path="/users"
          element={
            <Allowed when={can("users:manage")}><UsersPage /></Allowed>
          }
        />
        <Route
          path="/markets"
          element={
            <Allowed when={can("markets:write") || can("markets:create")}>
              <MarketsPage />
            </Allowed>
          }
        />
        <Route
          path="/imports"
          element={
            <Allowed
              when={can("upload:vpc") || can("upload:rgs")
                || can("imports:delete")}
            >
              <ImportsPage />
            </Allowed>
          }
        />
        <Route
          path="/audit"
          element={
            <Allowed when={can("audit:read")}><AuditPage /></Allowed>
          }
        />
        <Route
          path="/vpc"
          element={
            <Allowed when={vpc}><VpcHome /></Allowed>
          }
        />
        <Route
          path="/vpc/offers"
          element={
            <Allowed when={vpc}><VpcOffersPage /></Allowed>
          }
        />
        <Route
          path="/vpc/factories"
          element={
            <Allowed when={vpc}><VpcFactoriesPage /></Allowed>
          }
        />
        <Route
          path="/vpc/factories/view"
          element={
            <Allowed when={vpc}><VpcFactoryPage /></Allowed>
          }
        />
        <Route
          path="/vpc/countries"
          element={
            <Allowed when={vpc}><VpcCountriesPage /></Allowed>
          }
        />
        <Route
          path="/vpc/countries/view"
          element={
            <Allowed when={vpc}><VpcCountryPage /></Allowed>
          }
        />
        <Route
          path="/vpc/funnel"
          element={
            <Allowed when={vpc}><VpcFunnelPage /></Allowed>
          }
        />
        <Route
          path="/vpc/:section/list"
          element={
            <Allowed when={vpc}><VpcListPage /></Allowed>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const session = useSessionState();
  return (
    <SessionContext value={session}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionContext>
  );
}
