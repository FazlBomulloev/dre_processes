import { useState } from "react";
import { createMarket, getMarkets, updateMarket } from "../api/client";
import { Page } from "../components/layout/Layout";
import { Card, CardTitle, PageHeader } from "../components/ui/Card";
import { BTN_PRIMARY, FIELD, Field } from "../components/ui/Modal";
import { ErrorNote, Loading } from "../components/ui/states";
import { ToggleChip } from "../components/ui/ToggleChip";
import { useFetch } from "../hooks/useFetch";
import { useSession } from "../hooks/useSession";
import { apiErrorText } from "../lib/apiError";
import type { Market, MarketUpdateBody } from "../types/api";

export default function MarketsPage() {
  const { can } = useSession();
  const markets = useFetch((signal) => getMarkets(signal), []);
  const [error, setError] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const patch = async (m: Market, body: MarketUpdateBody) => {
    setBusyCode(m.code);
    setError("");
    try {
      const updated = await updateMarket(m.code, body);
      markets.setData(
        (markets.data ?? []).map((x) => (x.code === m.code ? updated : x)),
      );
    } catch (e) {
      setError(apiErrorText(e, "Не удалось изменить рынок"));
    } finally {
      setBusyCode(null);
    }
  };

  const writable = can("markets:write");

  return (
    <Page maxWidth={960}>
      <PageHeader
        title="Рынки"
        subtitle="Для какой страны ищем. Модули включаются по рынку."
      />
      <Card className="flex flex-col gap-2 px-0 py-2">
        {markets.error && (
          <ErrorNote className="mx-6">{markets.error}</ErrorNote>
        )}
        {error && <ErrorNote className="mx-6">{error}</ErrorNote>}
        {markets.loading && !markets.data && <Loading className="py-10" />}
        {markets.data?.map((m) => (
          <div
            key={m.code}
            className="flex flex-wrap items-center gap-4 border-t border-line px-6 py-3.5 first:border-t-0"
          >
            <span className="w-10 rounded-full bg-ink py-1 text-center text-xs font-semibold text-white">
              {m.code}
            </span>
            <span className="min-w-40 flex-1 font-medium">{m.name}</span>
            <span className="flex gap-1.5">
              <ToggleChip
                active={m.enabled_vpc_market}
                disabled={!writable || busyCode === m.code}
                onClick={() =>
                  patch(m, { enabled_vpc_market: !m.enabled_vpc_market })}
              >
                ВПЦ · рынок
              </ToggleChip>
              <ToggleChip
                active={m.enabled_rgs}
                disabled={!writable || busyCode === m.code}
                onClick={() => patch(m, { enabled_rgs: !m.enabled_rgs })}
              >
                RGS
              </ToggleChip>
            </span>
          </div>
        ))}
      </Card>
      {can("markets:create") && (
        <CreateMarket onCreated={(m) =>
          markets.setData([...(markets.data ?? []), m]
            .sort((a, b) => a.code.localeCompare(b.code)))}
        />
      )}
    </Page>
  );
}

function CreateMarket({ onCreated }: { onCreated: (m: Market) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const market = await createMarket({
        code: code.trim(),
        name: name.trim(),
        enabled_vpc_market: false,
        enabled_rgs: false,
      });
      onCreated(market);
      setCode("");
      setName("");
    } catch (e) {
      setError(apiErrorText(e, "Не удалось создать рынок"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card index={1} className="flex flex-col gap-4">
      <CardTitle>Новый рынок</CardTitle>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <Field label="Код">
            <input
              className={FIELD}
              maxLength={3}
              placeholder="AM"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
        </div>
        <div className="min-w-56 flex-1">
          <Field label="Название">
            <input
              className={FIELD}
              placeholder="Армения"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={busy || code.trim().length < 2 || !name.trim()}
          onClick={submit}
        >
          Создать
        </button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}
