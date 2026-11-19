import { Link } from "react-router-dom";
import { formatInt } from "../../lib/format";
import { type Section, formatPct, hue } from "../../lib/vpc";
import type { CountryDetail, StageCount } from "../../types/vpc";
import { HeroStat, IndexBadge, SectionCard } from "./insight";
import {
  ConversionNote, LinksCard, MoleculesCard, StatusLine, StopsCard,
} from "./CountryInsights";
import { useVpcLinks } from "../../hooks/useVpcScope";

export function CountryDetailView({ d }: { d: CountryDetail }) {
  const { factoryUrl, listUrl } = useVpcLinks();
  const key = d.mode === "target" ? "target" : "maker_country";
  const scope = { [key]: d.code };

  return (
    <>
      <section className="anim-rise flex flex-col gap-6 rounded-hero bg-ink px-[30px] py-7 text-white max-md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-fg-2">
              {d.mode === "target" ? "Ищем для страны" : "Страна завода"}
            </span>
            <span className="flex items-center gap-3">
              {d.mode === "target" && (
                <span className="rounded-md bg-ink-glass px-2 py-1 text-sm font-semibold">
                  {d.code}
                </span>
              )}
              <h1 className="m-0 text-[38px] font-semibold leading-none tracking-[-0.02em] max-md:text-[28px]">
                {d.name}
              </h1>
            </span>
          </div>
          <div className="grid grid-cols-4 gap-x-8 gap-y-4 max-lg:grid-cols-3 max-md:grid-cols-2">
            <HeroStat label="Предложений" value={formatInt(d.offers)} />
            <HeroStat label="Продуктов" value={formatInt(d.products)} />
            <HeroStat
              label="Контрактов"
              value={formatInt(d.contracts)}
              color="oklch(0.85 0.1 200)"
            />
            <HeroStat
              label="Конверсия"
              value={formatPct(d.conversion)}
              color="var(--color-pos-on-ink)"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <StatusLine d={d} />
          <StageStrip stages={d.stages} scope={scope} />
          <ConversionNote d={d} onInk />
        </div>
      </section>
      <LinksCard d={d} />
      <MoleculesCard d={d} />
      <StopsCard d={d} />
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        <SectionCard
          title={`Ведущие заводы${d.mode === "target" ? ` для ${d.code}` : ""}`}
          note="предложений · ценовой индекс"
        >
          <ol className="m-0 flex list-none flex-col p-0">
            {d.makers.map((m, i) => (
              <li key={m.maker}>
                <Link
                  to={factoryUrl(m.maker)}
                  className="tr-soft grid grid-cols-[20px_minmax(0,1fr)_44px_64px] items-center gap-3 border-t border-line px-1 py-2.5 text-sm text-fg hover:bg-subtle hover:text-fg"
                >
                  <span className="text-faint">{i + 1}</span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <b className="truncate font-semibold uppercase">
                      {m.maker}
                    </b>
                    <span className="truncate text-xs text-faint">
                      {m.country ?? "—"}
                    </span>
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {formatInt(m.offers)}
                  </span>
                  <span className="text-right">
                    <IndexBadge value={m.index} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </SectionCard>
        <SectionCard
          title={`Кто ведёт${d.mode === "target" ? ` ${d.code}` : ""}`}
          note="предложений в работе · дошли до контракта"
        >
          <ol className="m-0 flex list-none flex-col p-0">
            {d.people.map((p) => (
              <li key={`${p.role}:${p.name}`}>
                <Link
                  to={listUrl("countries", {
                    ...scope,
                    [p.role === "БДМ" ? "bdm" : "analyst"]: p.name,
                  })}
                  className="tr-soft grid grid-cols-[36px_minmax(0,1fr)_44px_36px] items-center gap-3 border-t border-line px-1 py-2.5 text-sm text-fg hover:bg-subtle hover:text-fg"
                >
                  <Avatar name={p.name} />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <b className="truncate font-semibold">{p.name}</b>
                    <span className="text-xs text-faint">{p.role}</span>
                  </span>
                  <span className="text-right font-mono text-[13px]">
                    {formatInt(p.work)}
                  </span>
                  <span className="text-right font-semibold text-pos">
                    {formatInt(p.contracts)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const h = hue(name);
  const initials = name.split(/\s+/).slice(0, 2)
    .map((part) => part[0] ?? "").join("").toUpperCase();
  return (
    <span
      className="flex size-8 items-center justify-center rounded-full text-[11px] font-bold"
      style={{
        background: `oklch(0.93 0.05 ${h})`,
        color: `oklch(0.4 0.12 ${h})`,
      }}
    >
      {initials}
    </span>
  );
}

export function StageStrip({
  stages, scope, section = "countries",
}: {
  stages: StageCount[];
  scope: Record<string, string>;
  section?: Section;
}) {
  const { listUrl } = useVpcLinks();
  const live = stages.filter((s) => s.code !== "stop");
  const stopped = stages.find((s) => s.code === "stop")?.count ?? 0;
  const active = live.reduce((sum, s) => sum + s.count, 0);
  const total = active + stopped;
  const max = Math.max(1, ...live.map((s) => s.count));
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-ink-fg-2">
        Где стоят предложения · активных{" "}
        <b className="font-semibold text-white">{formatInt(active)}</b> из{" "}
        {formatInt(total)} · клик по этапу — список
      </span>
      <div className="flex gap-3 max-lg:flex-col">
        <div
          className="grid min-w-0 flex-1 gap-1.5 max-md:!grid-cols-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(live.length, 1)},`
              + " minmax(0, 1fr))",
          }}
        >
          {live.map((s) => (
            <Link
              key={s.code}
              to={listUrl(section, { ...scope, stage: s.code })}
              title={`${s.name}: ${formatInt(s.count)}`}
              className="tr-soft group flex min-w-0 flex-col gap-1.5 rounded-xl px-2 pb-2 pt-2 text-white hover:bg-ink-glass hover:text-white"
            >
              <span className="flex h-16 items-end">
                <span
                  className="w-full rounded-md group-hover:brightness-110"
                  style={{
                    height: `${Math.max((s.count / max) * 100, 6)}%`,
                    background: stageFill(s.code),
                  }}
                />
              </span>
              <b className="text-[17px] font-semibold leading-none tabular-nums">
                {formatInt(s.count)}
              </b>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-xs font-semibold">{s.code}</span>
                <span className="truncate text-[11px] text-ink-fg-2">
                  {s.name}
                </span>
              </span>
              <span className="text-[11px] tabular-nums text-ink-fg-2">
                {formatPct(active ? (s.count / active) * 100 : null)}
              </span>
            </Link>
          ))}
        </div>
        {stopped > 0 && (
          <div className="flex w-[200px] shrink-0 flex-col justify-between gap-3 rounded-xl bg-ink-glass px-4 py-3 max-lg:w-full">
            <Link
              to={listUrl(section, { ...scope, tab: "stop" })}
              className="flex flex-col gap-1 text-white hover:text-white"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-fg-2">
                Остановлено
              </span>
              <b className="text-[28px] font-semibold leading-none tabular-nums">
                {formatInt(stopped)}
              </b>
              <span className="text-xs text-ink-fg-2">
                {formatPct((stopped / total) * 100)} всех предложений
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function stageFill(code: string): string {
  if (code === "Кк") return "oklch(0.78 0.12 200)";
  if (code === "Р" || code === "За") return "oklch(0.8 0.15 155)";
  return "oklch(0.75 0.1 268)";
}
