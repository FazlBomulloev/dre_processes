import { api } from "./client";
import type {
  RgsGroups, RgsMeta, RgsOverview, RgsProduct, RgsProducts,
} from "../types/rgs";

type Params = Record<string, string>;

async function get<T>(
  url: string, params: Params, signal?: AbortSignal,
): Promise<T> {
  const { data } = await api.get<T>(url, { params, signal });
  return data;
}

const base = (code: string) => `/rgs/${encodeURIComponent(code)}`;

export function rgsExportUrl(code: string, params: Params): string {
  const query = new URLSearchParams(params).toString();
  return `/api${base(code)}/products.xlsx${query ? `?${query}` : ""}`;
}

export const getRgsMeta = (code: string, signal?: AbortSignal) =>
  get<RgsMeta>(`${base(code)}/meta`, {}, signal);

export const getRgsOverview = (
  code: string, params: Params, signal?: AbortSignal,
) => get<RgsOverview>(`${base(code)}/overview`, params, signal);

export const getRgsMonth = (
  code: string, month: string, params: Params, signal?: AbortSignal,
) => get<RgsGroups>(`${base(code)}/months/${month}`, params, signal);

export const getRgsStops = (
  code: string, params: Params, signal?: AbortSignal,
) => get<RgsGroups>(`${base(code)}/stops`, params, signal);

export const getRgsProducts = (
  code: string, params: Params, signal?: AbortSignal,
) => get<RgsProducts>(`${base(code)}/products`, params, signal);

export const getRgsProduct = (
  code: string, id: number, signal?: AbortSignal,
) => get<RgsProduct>(`${base(code)}/products/${id}`, {}, signal);
