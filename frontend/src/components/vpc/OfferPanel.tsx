import type { ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import clsx from "clsx";
import { getOfferCard, type Params } from "../../api/vpc";
import { useEscape } from "../../hooks/useDismiss";
import { useFetch } from "../../hooks/useFetch";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useBodyScrollLock } from "../../hooks/useOverlay";
import { formatDate } from "../../lib/format";
import {
  PRICE_SOURCES, STATE_COLORS, formatPrice,
} from "../../lib/vpc";
import type { VpcCard } from "../../types/vpc";
import { BTN_PRIMARY, BTN_SECONDARY } from "../ui/Modal";
import { ErrorNote, Loading } from "../ui/states";

export function OfferPanel({
  id, params, onClose, onMnn, onMaker,
}: {
  id: number;
  params: Params;
  onClose: () => void;
  onMnn: (card: VpcCard) => void;
  onMaker: (maker: string) => void;
}) {
  useEscape(true, onClose);
  useBodyScrollLock(useIsMobile());
  const card = useFetch(
    (signal) => getOfferCard(id, params, signal),
    [id, params],
    "Не удалось загрузить предложение",
  );
  const data = card.loading ? null : card.data;

  return (
    <>
      <div
        className="anim-overlay fixed inset-0 z-40 bg-[rgba(22,24,29,.18)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Карточка предложения"
        className="anim-panel fixed inset-y-0 right-0 z-[41] flex w-[min(620px,100%)] flex-col overflow-auto bg-white shadow-panel max-md:overscroll-contain"
      >
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="tr-soft absolute right-5 top-5 z-[2] flex size-9 items-center justify-center rounded-full border-0 bg-ink-glass text-white hover:bg-[oklch(1_0_0/0.16)]"
        >
          <X size={16} />
        </button>
        {card.error && (
          <div className="bg-ink px-7 pb-6 pt-16">
            <ErrorNote>{card.error}</ErrorNote>
          </div>
        )}
        {!data && !card.error && (
          <div className="bg-ink px-7 py-16">
            <Loading className="text-ink-fg-2" />
          </div>
        )}
        {data && (
          <Body
            card={data}
            onMnn={() => onMnn(data)}
            onMaker={onMaker}
          />
        )}
      </aside>
    </>
  );
}

function Body({
  card, onMnn, onMaker,
}: {
  card: VpcCard;
  onMnn: () => void;
  onMaker: (maker: string) => void;
}) {
  const lastDate = card.last_comment_date ?? null;

  return (
    <>
      <header className="flex flex-col gap-3 bg-ink px-7 pb-6 pt-6 text-white max-md:px-4">
        <span className="pr-12 text-[13px] text-ink-fg-2">
          Предложение № {card.offer_no ?? card.id}
          {card.maker && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => onMaker(card.maker!)}
                className="border-0 bg-transparent p-0 text-white underline underline-offset-2"
              >
                {card.maker}
              </button>
            </>
          )}
          {card.maker_country && ` · ${card.maker_country}`}
        </span>
        <h2 className="m-0 break-words text-[30px] font-semibold leading-tight tracking-[-0.02em]">
          {card.generic}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {[card.form, card.dose, card.pack_n ? `№${card.pack_n}` : null]
            .filter(Boolean)
            .map((t) => (
              <span
                key={t}
                className="rounded-md bg-ink-glass px-2 py-1 text-xs font-semibold"
              >
                {t}
              </span>
            ))}
          <span className="flex items-center gap-1.5 rounded-md bg-ink-glass px-2 py-1 text-xs font-semibold">
            <span
              className="size-1.5 rounded-full"
              style={{
                background: STATE_COLORS[card.state],
              }}
            />
            {card.status_code ?? card.status_raw ?? "—"} · {card.status_name}
            {card.days != null && ` · ${card.days} дн.`}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 max-md:grid-cols-2">
          <Tile
            value={
              <>
                {formatPrice(card.price_agreed)}{" "}
                {card.price_agreed != null && (
                  <span className="text-xs font-normal text-ink-fg-2">
                    {card.agreed_currency}
                  </span>
                )}
              </>
            }
            note="Согл. цена, за уп."
          />
          <Tile
            value={
              <>
                {formatPrice(card.price_usd)}{" "}
                {card.price_usd != null && (
                  <span className="text-xs font-normal text-ink-fg-2">
                    USD
                  </span>
                )}
              </>
            }
            note="Цена в USD, за уп."
          />
          <Tile
            value={
              card.rank?.to_min == null ? "—"
                : card.rank.to_min === 0 ? "мин."
                  : `+${card.rank.to_min}%`
            }
            color={
              card.rank?.to_min ? "var(--color-neg-on-ink)"
                : "var(--color-pos-on-ink)"
            }
            note={
              card.rank && card.rank.of > 1
                ? `к минимуму ${formatPrice(card.rank.min)}`
                  + (card.rank.min_maker ? ` (${card.rank.min_maker})` : "")
                : "не с чем сравнить"
            }
          />
          <Tile
            value={card.rank ? `${card.rank.place} из ${card.rank.of}` : "—"}
            note="место по цене"
          />
        </div>
      </header>
      <div className="flex flex-col gap-7 px-7 pb-10 pt-6 max-md:px-4">
        <Section title="Предложение">
          <Rows
            items={[
              {
                label: "Завод",
                value: card.maker ? (
                  <button
                    type="button"
                    onClick={() => onMaker(card.maker!)}
                    className="flex items-center gap-1 border-0 bg-transparent p-0 font-semibold text-accent hover:text-accent-hover"
                  >
                    {card.maker} <ArrowRight size={13} />
                  </button>
                ) : "—",
              },
              { label: "Категория завода", value: card.maker_category },
              { label: "Для страны", value: card.target_country },
              { label: "Упаковка", value: card.pack_raw },
              { label: "БДМ", value: card.bdm },
              { label: "Аналитик", value: card.analyst },
              { label: "Ответственный", value: card.responsible },
              { label: "Создано", value: dateOrNull(card.created_at) },
              { label: "Обновлено", value: dateOrNull(card.updated_at) },
            ]}
          />
        </Section>
        <Section title="Цены">
          <Rows
            mono
            items={Object.entries(PRICE_SOURCES).map(([key, label]) => ({
              label,
              value: card.prices[key] != null
                ? `${formatPrice(card.prices[key])} ${card.currency ?? ""}`
                : null,
            }))}
          />
        </Section>
        {card.conditions.length > 0 && (
          <Section title="Условия">
            <Rows items={card.conditions} />
          </Section>
        )}
        <Section
          title="Комментарии"
          note={lastDate ? `последний ${formatDate(lastDate)}` : null}
        >
          {card.comments.length === 0 ? (
            <span className="text-sm text-faint">Комментариев нет</span>
          ) : (
            <div className="flex flex-col gap-2">
              {card.comments.map((c, i) => (
                <p
                  key={`${i}:${c}`}
                  className={clsx(
                    "m-0 whitespace-pre-line break-words rounded-xl px-3.5 py-2.5 text-sm",
                    i === 0 ? "bg-accent-tint text-fg" : "bg-subtle text-fg-2",
                  )}
                >
                  {c}
                </p>
              ))}
            </div>
          )}
        </Section>
        <Section title="Этапы">
          <ol className="m-0 flex list-none flex-col gap-0 p-0">
            {card.timeline.map((step) => (
              <li
                key={step.code}
                className="flex items-center gap-3 py-[7px] text-sm"
              >
                <span
                  className={clsx(
                    "size-3.5 shrink-0 rounded-full",
                    step.reached
                      ? "bg-st-work"
                      : "border-[1.5px] border-line-strong",
                  )}
                />
                <span
                  className={clsx(
                    "flex-1",
                    step.current && "font-semibold",
                    !step.reached && "text-faint",
                  )}
                >
                  {step.name}
                </span>
                {step.date && (
                  <span className="font-mono text-xs text-faint">
                    {formatDate(step.date)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Section>
        {card.other.length > 0 && (
          <Section title="Прочие поля">
            <Rows items={card.other} />
          </Section>
        )}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={onMnn} className={BTN_PRIMARY}>
            Все предложения по {card.generic}
          </button>
          {card.maker && (
            <button
              type="button"
              onClick={() => onMaker(card.maker!)}
              className={BTN_SECONDARY}
            >
              Профиль завода {card.maker}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function dateOrNull(iso: string | null): string | null {
  return iso ? formatDate(iso) : null;
}

function Tile({
  value, note, color,
}: {
  value: ReactNode;
  note: string;
  color?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-ink-glass px-3.5 py-3">
      <span
        className="text-[22px] font-semibold tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </span>
      <span className="truncate text-xs text-ink-fg-2" title={note}>
        {note}
      </span>
    </div>
  );
}

function Section({
  title, note, children,
}: {
  title: string;
  note?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold">{title}</span>
        {note && <span className="text-xs text-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Rows({
  items, mono = false,
}: {
  items: { label: string; value: ReactNode }[];
  mono?: boolean;
}) {
  const filled = items.filter((i) => i.value != null && i.value !== "");
  if (filled.length === 0) {
    return <span className="text-sm text-faint">Нет данных</span>;
  }
  return (
    <dl className="m-0 grid grid-cols-[180px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm max-md:grid-cols-[130px_minmax(0,1fr)]">
      {filled.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-faint">{i.label}</dt>
          <dd
            className={clsx(
              "m-0 break-words",
              mono && "font-mono text-[13px]",
            )}
          >
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
