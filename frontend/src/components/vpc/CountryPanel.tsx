import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getCountry } from "../../api/vpc";
import { useFetch } from "../../hooks/useFetch";
import { useVpcLinks } from "../../hooks/useVpcScope";
import { formatInt } from "../../lib/format";
import {
  countryScope, formatPct, makerStripe, otherKey, otherMode,
} from "../../lib/vpc";
import type { Brief, CountryDetail, CountryMode } from "../../types/vpc";
import { KpiGrid, PanelSection, SidePanel } from "../ui/SidePanel";
import { ErrorNote, Loading } from "../ui/states";
import { CountryCode } from "./chips";
import { ConversionNote, StatusTiles } from "./CountryInsights";
import { StateStrip } from "./insight";

const PANEL_ROWS = 5;

export function CountryPanel({
  code, mode, onPick, onClose,
}: {
  code: string;
  mode: CountryMode;
  onPick: ((code: string, mode: CountryMode) => void) | null;
  onClose: () => void;
}) {
  const { market } = useVpcLinks();
  const data = useFetch(
    (signal) => getCountry(
      market ? { code, mode, target: market } : { code, mode }, signal,
    ),
    [code, mode, market],
    "Страна не найдена",
  );
  const d = data.loading ? null : data.data;
  return (
    <SidePanel
      onClose={onClose}
      width={600}
      gap={26}
      eyebrow={mode === "target" ? "Ищем для страны" : "Страна завода"}
      title={(
        <span className="flex items-center gap-3">
          {mode === "target" && <CountryCode code={code} />}
          {d?.name ?? code}
        </span>
      )}
    >
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {!d && !data.error && <Loading className="py-12" />}
      {d && <Body d={d} onPick={onPick} />}
    </SidePanel>
  );
}

function Body({
  d, onPick,
}: {
  d: CountryDetail;
  onPick: ((code: string, mode: CountryMode) => void) | null;
}) {
  const { countryUrl, listUrl } = useVpcLinks();
  const scope = countryScope(d);
  const key = otherKey(d);
  const mode = otherMode(d);
  const target = d.mode === "target";
  const reason = d.stops.reasons.find((r) => r.key !== "none")
    ?? d.stops.reasons[0];
  return (
    <>
      <KpiGrid
        items={[
          { label: "Предложений", value: formatInt(d.offers) },
          { label: "Продуктов", value: formatInt(d.products) },
          {
            label: "Контрактов",
            value: formatInt(d.contracts),
            color: "var(--color-pos)",
          },
        ]}
      />
      <ConversionNote d={d} />
      <PanelSection title="Статусы" note="клик — список">
        <StatusTiles d={d} compact />
      </PanelSection>
      <PanelSection
        title={target ? "Откуда берём" : "Куда поставляют"}
        note={`топ-${PANEL_ROWS} из ${formatInt(d.links_total)}`}
        gap={4}
      >
        <MiniHead />
        {d.links.slice(0, PANEL_ROWS).map((l) => (
          <MiniRow
            key={l.code}
            b={l}
            label={(
              <span className="flex min-w-0 items-center gap-2">
                {mode === "target" ? (
                  <CountryCode code={l.code} />
                ) : (
                  <span
                    className="h-4 w-[3px] shrink-0 rounded-full"
                    style={{ background: makerStripe(l.code) }}
                  />
                )}
                <span className="truncate">{l.name}</span>
              </span>
            )}
            onClick={onPick ? () => onPick(l.code, mode) : undefined}
            to={onPick ? undefined : listUrl("countries", {
              ...scope, [key]: l.code,
            })}
          />
        ))}
      </PanelSection>
      <PanelSection
        title={target ? "Какие молекулы берём" : "Какие молекулы предлагают"}
        note={`топ-${PANEL_ROWS} из ${formatInt(d.molecules_total)}`}
        gap={4}
      >
        <MiniHead />
        {d.molecules.slice(0, PANEL_ROWS).map((m) => (
          <MiniRow
            key={m.name}
            b={m}
            label={<span className="truncate">{m.name}</span>}
            to={listUrl("countries", { ...scope, mnn: m.name })}
          />
        ))}
      </PanelSection>
      {reason && (
        <PanelSection title="Почему останавливаем">
          <Link
            to={listUrl("countries", { ...scope, state: "stop" })}
            className="tr-soft flex flex-col gap-0.5 rounded-xl bg-subtle px-4 py-3 text-sm text-fg hover:bg-track hover:text-fg"
          >
            <b className="font-semibold">{reason.label}</b>
            <span className="text-[13px] text-muted-2">
              {formatInt(reason.count)} из {formatInt(d.stops.total)} в стопе
              {" "}({formatPct(reason.share)})
            </span>
          </Link>
        </PanelSection>
      )}
      <Link
        to={countryUrl(d.code, d.mode)}
        className="tr-soft flex h-11 items-center justify-center gap-2 rounded-xl bg-fg text-sm font-semibold text-white hover:bg-ink hover:text-white"
      >
        Открыть полный обзор
        <ArrowRight size={15} />
      </Link>
    </>
  );
}

const GRID = "grid grid-cols-[minmax(0,1fr)_124px_40px_36px_44px]"
  + " items-center gap-3";

function MiniHead() {
  return (
    <div className={`${GRID} px-2 pb-1 text-[11px] text-faint`}>
      <span />
      <span>статусы</span>
      <span className="text-right">предл.</span>
      <span className="text-right">конт.</span>
      <span className="text-right">конв.</span>
    </div>
  );
}

function MiniRow({
  b, label, onClick, to,
}: {
  b: Brief;
  label: ReactNode;
  onClick?: () => void;
  to?: string;
}) {
  const cells = (
    <>
      {label}
      <StateStrip states={b.states} />
      <b className="text-right font-semibold tabular-nums">
        {formatInt(b.offers)}
      </b>
      <span className="text-right font-semibold tabular-nums text-pos">
        {formatInt(b.contracts)}
      </span>
      <span className="text-right text-xs tabular-nums text-muted-2">
        {formatPct(b.conversion)}
      </span>
    </>
  );
  const cls = `${GRID} tr-soft rounded-lg px-2 py-2 text-sm text-fg`
    + " hover:bg-subtle hover:text-fg";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cls} w-full border-0 bg-transparent text-left`}
      >
        {cells}
      </button>
    );
  }
  return <Link to={to ?? "#"} className={cls}>{cells}</Link>;
}
