import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useVpcScope } from "./useVpcScope";

export const MAIN_FILTERS = [
  "mnn", "form", "dose", "pack", "status", "target", "maker",
  "responsible",
] as const;
export const MORE_FILTERS = ["maker_country", "bdm", "analyst"] as const;
export const DEFAULT_PRICE = "usd";
export const FILTER_KEYS = [...MAIN_FILTERS, ...MORE_FILTERS, "q"];

const DEPENDENTS: Record<string, string[]> = {
  mnn: ["form", "dose", "pack"],
};

export const PAGE_SIZE = 50;

export type Patch = Record<string, string | null>;

export function useVpcParams() {
  const { market } = useVpcScope();
  const [search, setSearch] = useSearchParams();

  const get = useCallback(
    (key: string) => search.get(key) ?? "",
    [search],
  );

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const value = search.get(key);
      if (value) out[key] = value;
    }
    if (market) out.target = market;
    out.priced = search.get("priced") === "1" ? "true" : "false";
    out.price = search.get("price") || DEFAULT_PRICE;
    out.active = search.get("active") === "1" ? "true" : "false";
    return out;
  }, [search, market]);

  const page = Math.max(1, Number(search.get("page")) || 1);
  const table = useMemo(() => ({
    tab: search.get("tab") || "all",
    sort: search.get("sort") || "price",
    desc: search.get("desc") === "1" ? "true" : "false",
    offset: String((page - 1) * PAGE_SIZE),
    limit: String(PAGE_SIZE),
  }), [search, page]);

  const set = useCallback((patch: Patch, keepPage = false) => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
        for (const dep of DEPENDENTS[key] ?? []) {
          if (!(dep in patch)) next.delete(dep);
        }
      }
      if (!keepPage) next.delete("page");
      return next;
    });
  }, [setSearch]);

  const reset = useCallback(() => {
    setSearch((prev) => {
      const next = new URLSearchParams();
      const offer = prev.get("offer");
      if (offer) next.set("offer", offer);
      return next;
    });
  }, [setSearch]);

  const active = FILTER_KEYS.some((k) => search.get(k))
    || search.get("priced") === "1" || !!search.get("price")
    || search.get("active") === "1";

  return { get, filters, table, page, set, reset, active };
}
