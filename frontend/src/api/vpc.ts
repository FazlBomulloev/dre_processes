import { api } from "./client";
import type {
  CountriesResponse, CountryDetail, FactoriesResponse, FactoryProfile,
  FunnelResponse, Suggestion, VpcCard, VpcFacets, VpcMeta,
  VpcOffersResponse, VpcOverview, VpcSummary,
} from "../types/vpc";

export type Params = Record<string, string>;

export async function getVpcMeta(signal?: AbortSignal): Promise<VpcMeta> {
  const { data } = await api.get<VpcMeta>("/vpc/meta", { signal });
  return data;
}

export async function getOffers(
  params: Params, signal?: AbortSignal,
): Promise<VpcOffersResponse> {
  const { data } = await api.get<VpcOffersResponse>("/vpc/offers", {
    params, signal,
  });
  return data;
}

export async function getFacets(
  params: Params, signal?: AbortSignal,
): Promise<VpcFacets> {
  const { data } = await api.get<VpcFacets>("/vpc/facets", {
    params, signal,
  });
  return data;
}

export async function getSuggest(
  q: string, signal?: AbortSignal,
): Promise<Suggestion[]> {
  const { data } = await api.get<Suggestion[]>("/vpc/suggest", {
    params: { q }, signal,
  });
  return data;
}

export async function getOfferCard(
  id: number, params: Params, signal?: AbortSignal,
): Promise<VpcCard> {
  const { data } = await api.get<VpcCard>(`/vpc/offers/${id}`, {
    params, signal,
  });
  return data;
}

async function fetchJson<T>(
  url: string, params: Params, signal?: AbortSignal,
): Promise<T> {
  const { data } = await api.get<T>(url, { params, signal });
  return data;
}

export const getFactories = (params: Params, signal?: AbortSignal) =>
  fetchJson<FactoriesResponse>("/vpc/factories", params, signal);

export const getFactory = (
  maker: string, target: string | null, signal?: AbortSignal,
) => fetchJson<FactoryProfile>(
  "/vpc/factory", target ? { maker, target } : { maker }, signal,
);

export const getCountries = (params: Params, signal?: AbortSignal) =>
  fetchJson<CountriesResponse>("/vpc/countries", params, signal);

export const getCountry = (params: Params, signal?: AbortSignal) =>
  fetchJson<CountryDetail>("/vpc/country", params, signal);

export const getFunnel = (params: Params, signal?: AbortSignal) =>
  fetchJson<FunnelResponse>("/vpc/funnel", params, signal);

export const getSummary = (params: Params, signal?: AbortSignal) =>
  fetchJson<VpcSummary>("/vpc/summary", params, signal);

export const getOverview = (params: Params, signal?: AbortSignal) =>
  fetchJson<VpcOverview>("/vpc/overview", params, signal);
