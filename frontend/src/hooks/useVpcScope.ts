import { createContext, useContext } from "react";
import {
  type Section, countryUrl, factoryUrl, listUrl, offersUrl,
} from "../lib/vpc";

export interface VpcScope {
  market: string | null;
  base: string;
}

export const VpcScopeContext = createContext<VpcScope>({
  market: null, base: "/vpc",
});

export function useVpcScope(): VpcScope {
  return useContext(VpcScopeContext);
}

export function marketScope(code: string): VpcScope {
  return { market: code, base: `/market/${code}/vpc` };
}

export function useVpcLinks() {
  const scope = useVpcScope();
  const { base, market } = scope;
  return {
    ...scope,
    factoryUrl: (maker: string) => factoryUrl(maker, base),
    offersUrl: (params: Record<string, string | null | undefined>) =>
      offersUrl(params, base),
    listUrl: (
      section: Section,
      params: Record<string, string | null | undefined>,
    ) => listUrl(section, params, base),
    countryUrl: (code: string, mode = "target") =>
      countryUrl(code, market ? "maker" : mode, base),
  };
}
