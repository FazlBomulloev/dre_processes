import { api } from "./client";
import type {
  RgsChanges, RgsGroups, RgsKpiTable, RgsMeta, RgsOverview,
  RgsProduct, RgsProducts,
} from "../types/rgs";

export type RgsParams = Record<string, string | string[]>;

export function rgsQuery(params: RgsParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v) query.append(key, v);
    }
  }
  return query;
}

async function get<T>(
  url: string, params: RgsParams, signal?: AbortSignal,
): Promise<T> {
  const { data } = await api.get<T>(url, {
    params: rgsQuery(params), signal,
  });
  return data;
}

const base = (code: string) => `/rgs/${encodeURIComponent(code)}`;

export function rgsExportUrl(code: string, params: RgsParams): string {
  const query = rgsQuery(params).toString();
  return `/api${base(code)}/products.xlsx${query ? `?${query}` : ""}`;
}

export const getRgsMeta = (code: string, signal?: AbortSignal) =>
  get<RgsMeta>(`${base(code)}/meta`, {}, signal);

export const getRgsOverview = (
  code: string, params: RgsParams, signal?: AbortSignal,
) => get<RgsOverview>(`${base(code)}/overview`, params, signal);

export const getRgsMonth = (
  code: string, month: string, params: RgsParams, signal?: AbortSignal,
) => get<RgsGroups>(`${base(code)}/months/${month}`, params, signal);

export const getRgsStops = (
  code: string, params: RgsParams, signal?: AbortSignal,
) => get<RgsGroups>(`${base(code)}/stops`, params, signal);

export const getRgsProducts = (
  code: string, params: RgsParams, signal?: AbortSignal,
) => get<RgsProducts>(`${base(code)}/products`, params, signal);

export const getRgsProduct = (
  code: string, id: number, signal?: AbortSignal,
) => get<RgsProduct>(`${base(code)}/products/${id}`, {}, signal);

export const getRgsKpi = (
  code: string, params: RgsParams, signal?: AbortSignal,
) => get<RgsKpiTable>(`${base(code)}/kpi`, params, signal);

export const getRgsChanges = (
  code: string, params: RgsParams, signal?: AbortSignal,
) => get<RgsChanges>(`${base(code)}/changes`, params, signal);
