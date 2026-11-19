import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function useOpenOffer() {
  const [, setSearch] = useSearchParams();
  return useCallback((id: number) => setSearch((prev) => {
    const next = new URLSearchParams(prev);
    next.set("offer", String(id));
    return next;
  }), [setSearch]);
}
