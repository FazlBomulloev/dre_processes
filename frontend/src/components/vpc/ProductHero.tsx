import type { ReactNode } from "react";
import clsx from "clsx";
import { formatInt } from "../../lib/format";
import {
  STATE_COLORS, STATE_LABELS, STATE_ORDER, formatPrice,
  plural, pluralOffers,
} from "../../lib/vpc";
import type { VpcProduct } from "../../types/vpc";
import { BestOffers, PriceRange } from "./MnnCards";

const STATE_TAB: Record<string, string> = {
  work: "work",
  contract: "contract",
  result: "result",
  stop: "stop",
};

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-ink-glass px-2 py-1 text-xs font-semibold text-white">
      {children}
    </span>
  );
}

export function ProductHero({
  product, onTab, onOffer,
}: {
  product: VpcProduct;
  onTab: (tab: string) => void;
  onOffer: (id: number) => void;
}) {
  const p = product;
  const subtitle = [
    `${formatInt(p.offers)} ${pluralOffers(p.offers)}`,
    `${p.makers} ${plural(p.makers, "завод", "завода", "заводов")}`
      + ` из ${p.maker_countries} `
      + plural(p.maker_countries, "страны", "стран", "стран"),
    p.targets.length ? `ищем для ${p.targets.join(", ")}` : null,
  ].filter(Boolean).join(" · ");

  const best = p.ladder.slice(0, 3);

  return (
    <section className="anim-rise grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-x-11 gap-y-6 rounded-hero bg-ink px-[30px] py-7 text-white max-lg:grid-cols-1 max-md:px-5">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-fg-2">Продукт</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="m-0 break-words text-[38px] font-semibold leading-none tracking-[-0.02em] max-md:text-[28px]">
              {p.generic}
            </h2>
            {p.form && <Tag>{p.form}</Tag>}
            {p.dose && <Tag>{p.dose}</Tag>}
            {p.contracts > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-ink-glass px-2.5 py-1 text-xs font-semibold text-[oklch(0.85_0.1_200)]">
                <span className="size-1.5 rounded-full bg-st-contract" />
                {p.contracts}{" "}
                {plural(p.contracts, "контракт", "контракта", "контрактов")}
              </span>
            )}
          </div>
          <span className="text-sm text-ink-fg-2">{subtitle}</span>
        </div>
        {p.price ? (
          <PriceStats product={p} />
        ) : (
          <span className="text-sm text-ink-fg-2">
            В выбранной колонке цен по этому продукту нет
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-end gap-4">
        {p.price && best.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-inner bg-ink-glass p-3">
            <span className="px-2 text-[13px] text-ink-fg-2">
              Лучшие предложения по цене
            </span>
            <BestOffers
              steps={best}
              avg={p.price.priced > 1 ? p.price.avg : null}
              currency={p.price.currency}
              ink
              onOffer={onOffer}
            />
          </div>
        )}
        <StatesBar states={p.states} onTab={onTab} />
      </div>
    </section>
  );
}

function PriceStats({ product }: { product: VpcProduct }) {
  const price = product.price!;
  const main = product.price_product;
  return (
    <div className="flex flex-col gap-4">
      {main && (
        <span className="text-[13px] text-ink-fg-2">
          Цены по основному продукту{" "}
          <b className="font-semibold text-white">
            {[main.form, main.dose].filter(Boolean).join(" · ")}
          </b>{" "}
          · {main.offers} {pluralOffers(main.offers)}
        </span>
      )}
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Stat
          label="Минимальная цена"
          value={price.min}
          currency={price.currency}
          color="var(--color-pos-on-ink)"
          note={[price.min_maker, price.min_country]
            .filter(Boolean).join(" · ")}
          noteColor="var(--color-pos-on-ink)"
        />
        <Stat
          label="Средняя цена"
          value={price.avg}
          currency={price.currency}
          note={`по ${formatInt(price.priced)} ценам`}
        />
        <Stat
          label="Максимальная цена"
          value={price.max}
          currency={price.currency}
          color="var(--color-neg-on-ink)"
          note={price.max_ratio && price.max_ratio > 1
            ? `в ${formatPrice(price.max_ratio).replace(/,?0+$/, "")}`
              + " раза выше мин."
            : ""}
          noteColor="var(--color-neg-on-ink)"
        />
      </div>
      {price.priced > 1 && (
        <PriceRange
          min={price.min}
          avg={price.avg}
          max={price.max}
          currency={price.currency}
          ink
          labels={false}
        />
      )}
      {product.mixed_currency && (
        <span className="text-xs text-ink-fg-2">
          Есть предложения в другой валюте — в расчёте только{" "}
          {price.currency}.
        </span>
      )}
    </div>
  );
}

function Stat({
  label, value, currency, color, note, noteColor,
}: {
  label: string;
  value: number;
  currency: string;
  color?: string;
  note: string;
  noteColor?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-ink-fg-2">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className="text-[30px] font-semibold tabular-nums leading-none tracking-[-0.02em]"
          style={{ color }}
        >
          {formatPrice(value)}
        </span>
        <span className="text-sm text-ink-fg-2">{currency}</span>
      </span>
      <span
        className="truncate text-[13px] font-medium"
        style={{ color: noteColor ?? "var(--color-ink-fg-2)" }}
        title={note}
      >
        {note || " "}
      </span>
    </div>
  );
}

function StatesBar({
  states, onTab,
}: {
  states: Record<string, number>;
  onTab: (tab: string) => void;
}) {
  const total = STATE_ORDER.reduce((sum, s) => sum + (states[s] ?? 0), 0);
  if (!total) return null;
  const tiles = [
    { state: "work", count: states.work ?? 0, note: null },
    { state: "contract", count: states.contract ?? 0, note: null },
    { state: "result", count: states.result ?? 0, note: null },
    { state: "stop", count: states.stop ?? 0, note: null },
    ...(states.unknown
      ? [{ state: "unknown", count: states.unknown, note: null }]
      : []),
  ];
  const active = total - tiles[3].count - (states.unknown ?? 0);

  return (
    <div className="flex flex-col gap-3 rounded-inner bg-ink-glass p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-fg-2">
          Где сейчас предложения
        </span>
        <span className="text-xs text-ink-fg-2">
          активных{" "}
          <b className="font-semibold text-white">{formatInt(active)}</b>
          {" "}из {formatInt(total)}
        </span>
      </div>
      <div
        className={clsx(
          "grid gap-2 max-sm:grid-cols-2",
          tiles.length > 4 ? "grid-cols-5" : "grid-cols-4",
        )}
      >
        {tiles.map((t) => {
          const share = Math.round((t.count / total) * 100);
          const color = t.state === "stop"
            ? "oklch(1 0 0 / 0.9)"
            : STATE_COLORS[t.state];
          const tab = STATE_TAB[t.state];
          return (
            <button
              key={t.state}
              type="button"
              disabled={!tab || !t.count}
              onClick={() => onTab(tab)}
              title={`${STATE_LABELS[t.state]}: ${t.count} (${share}%)`}
              className="tr-soft flex min-w-0 flex-col gap-2 rounded-[12px] border-0 bg-[oklch(1_0_0/0.04)] px-3 py-2.5 text-left text-white enabled:hover:bg-[oklch(1_0_0/0.09)] disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5 truncate text-xs text-ink-fg-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {STATE_LABELS[t.state]}
              </span>
              <span className="flex items-baseline gap-1.5">
                <b className="text-[22px] font-semibold leading-none tabular-nums">
                  {formatInt(t.count)}
                </b>
                <span className="text-xs text-ink-fg-2 tabular-nums">
                  {share}%
                </span>
              </span>
              <span className="h-1 rounded-full bg-[oklch(1_0_0/0.1)]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(share, t.count ? 3 : 0)}%`,
                    background: color,
                  }}
                />
              </span>
              <span className="h-3.5 truncate text-[11px] text-ink-fg-2">
                {t.note}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
