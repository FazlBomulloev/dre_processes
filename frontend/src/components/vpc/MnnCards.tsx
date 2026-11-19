import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { formatInt } from "../../lib/format";
import { formatPrice, plural } from "../../lib/vpc";
import type { LadderStep, MnnCard } from "../../types/vpc";

const GRADIENT = "linear-gradient(90deg, var(--color-st-result),"
  + " oklch(0.8 0.12 85), var(--color-bad))";

export function PriceRange({
  min, avg, max, currency, ink = false, labels = true,
}: {
  min: number;
  avg: number;
  max: number;
  currency: string;
  ink?: boolean;
  labels?: boolean;
}) {
  const span = max - min;
  const at = span > 0 ? ((avg - min) / span) * 100 : 50;
  const muted = ink ? "text-ink-fg-2" : "text-faint";
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={clsx(
          "relative h-2 rounded-full",
          ink ? "bg-ink-glass" : "bg-track",
        )}
      >
        <span
          className="absolute inset-0 rounded-full opacity-80"
          style={{ background: GRADIENT }}
        />
        <span
          title={`Средняя ${formatPrice(avg)} ${currency}`}
          className={clsx(
            "absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded-full",
            ink ? "bg-white" : "bg-fg",
          )}
          style={{ left: `${at}%` }}
        />
      </div>
      {labels && (
        <div className="grid grid-cols-3 text-xs tabular-nums">
          <span className="flex flex-col">
            <span className={muted}>мин</span>
            <b className={ink ? "text-pos-on-ink" : "text-pos"}>
              {formatPrice(min)}
            </b>
          </span>
          <span className="flex flex-col items-center">
            <span className={muted}>средняя</span>
            <b className={ink ? "text-white" : "text-fg"}>
              {formatPrice(avg)}
            </b>
          </span>
          <span className="flex flex-col items-end">
            <span className={muted}>макс</span>
            <b className={ink ? "text-neg-on-ink" : "text-bad-ink"}>
              {formatPrice(max)}
            </b>
          </span>
        </div>
      )}
    </div>
  );
}

export function BestOffers({
  steps, avg, currency, ink = false, onOffer,
}: {
  steps: LadderStep[];
  avg: number | null;
  currency: string;
  ink?: boolean;
  onOffer: (id: number) => void;
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0">
      {steps.map((s, i) => {
        const below = avg ? Math.round((1 - s.price / avg) * 100) : null;
        return (
          <li key={s.offer_id}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOffer(s.offer_id);
              }}
              className={clsx(
                "tr-soft grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2 py-1.5 text-left",
                ink ? "text-white hover:bg-[oklch(1_0_0/0.06)]"
                  : "text-fg hover:bg-subtle",
              )}
            >
              <span
                className={clsx(
                  "flex size-[22px] items-center justify-center rounded-full text-[11px] font-semibold",
                  i === 0
                    ? "bg-st-result text-white"
                    : ink ? "bg-ink-glass text-ink-fg-2" : "bg-subtle text-muted",
                )}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <b
                  className="truncate text-[13px] font-semibold uppercase"
                  title={s.maker ?? ""}
                >
                  {s.maker ?? "—"}
                </b>
                <span
                  className={clsx(
                    "truncate text-[11px]",
                    ink ? "text-ink-fg-2" : "text-faint",
                  )}
                >
                  {[s.maker_country, s.status_code,
                    s.target_country && `для ${s.target_country}`]
                    .filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span className="whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums">
                  {formatPrice(s.price)}{" "}
                  <span
                    className={clsx(
                      "font-sans text-[11px] font-normal",
                      ink ? "text-ink-fg-2" : "text-faint",
                    )}
                  >
                    {currency}
                  </span>
                </span>
                {below != null && below > 0 && (
                  <span
                    className={clsx(
                      "text-[11px] font-medium",
                      ink ? "text-pos-on-ink" : "text-pos",
                    )}
                  >
                    −{below}% к средней
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function MnnCards({
  cards, priceLabel, onPick, onOffer,
}: {
  cards: MnnCard[];
  priceLabel: string;
  onPick: (mnn: string) => void;
  onOffer: (id: number) => void;
}) {
  return (
    <section className="anim-rise flex flex-col gap-3 rounded-card bg-surface px-6 py-5 max-md:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[17px] font-semibold tracking-[-0.01em]">
          Самые предлагаемые МНН
        </span>
        <span className="text-xs text-faint">
          {priceLabel} · по основному продукту · нажмите, чтобы сравнить
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-8 max-xl:grid-cols-1">
        {cards.map((c) => (
          <Row key={c.generic} card={c} onPick={onPick} onOffer={onOffer} />
        ))}
      </div>
    </section>
  );
}

function Row({
  card: c, onPick, onOffer,
}: {
  card: MnnCard;
  onPick: (mnn: string) => void;
  onOffer: (id: number) => void;
}) {
  const product = [c.form, c.dose].filter(Boolean).join(" · ");
  const best = c.best[0];
  const price = c.price;
  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-4 border-t border-line py-2.5 max-md:grid-cols-[minmax(0,1fr)_auto]">
      <button
        type="button"
        onClick={() => onPick(c.generic)}
        className="tr-soft group flex min-w-0 flex-col items-start border-0 bg-transparent p-0 text-left leading-tight"
      >
        <b
          className="flex max-w-full items-center gap-1 truncate text-sm font-semibold text-fg group-hover:text-accent"
          title={c.generic}
        >
          <span className="truncate">{c.generic}</span>
          <ArrowRight
            size={13}
            className="tr-soft shrink-0 text-faint group-hover:translate-x-0.5 group-hover:text-accent"
          />
        </b>
        <span className="truncate text-xs text-faint">
          {[product, `${formatInt(c.offers)} предл.`,
            `${formatInt(c.makers)} ${plural(c.makers, "завод", "завода", "заводов")}`]
            .filter(Boolean).join(" · ")}
        </span>
      </button>
      <span className="flex min-w-0 flex-col gap-1 max-md:hidden">
        {price && price.max > price.min ? (
          <>
            <span className="relative h-1.5 rounded-full bg-track">
              <span
                className="absolute inset-0 rounded-full opacity-80"
                style={{ background: GRADIENT }}
              />
              <span
                className="absolute -top-[3px] h-3 w-[2px] -translate-x-1/2 rounded-full bg-fg"
                style={{
                  left: `${((price.avg - price.min) / (price.max - price.min)) * 100}%`,
                }}
              />
            </span>
            <span className="flex justify-between font-mono text-[11px] tabular-nums text-faint">
              <span className="text-pos">{formatPrice(price.min)}</span>
              <span>ср {formatPrice(price.avg)}</span>
              <span className="text-bad-ink">{formatPrice(price.max)}</span>
            </span>
          </>
        ) : (
          <span className="text-xs text-faint">
            {price ? "одна цена" : "нет цен"}
          </span>
        )}
      </span>
      {best && price ? (
        <button
          type="button"
          onClick={() => onOffer(best.offer_id)}
          title="Открыть лучшее предложение"
          className="tr-soft flex min-w-0 items-center justify-end gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-right hover:bg-subtle"
        >
          <span className="flex min-w-0 flex-col items-end leading-tight">
            <span className="max-w-full truncate text-xs font-semibold uppercase text-fg">
              {best.maker ?? "—"}
            </span>
            <span className="truncate text-[11px] text-faint">
              лучшая · {best.maker_country ?? "—"}
            </span>
          </span>
          <span className="whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums text-pos">
            {formatPrice(best.price)}
            <span className="ml-1 font-sans text-[11px] font-normal text-faint">
              {price.currency}
            </span>
          </span>
        </button>
      ) : (
        <span className="text-right text-xs text-faint">—</span>
      )}
    </div>
  );
}
