import { useSyncExternalStore } from "react";

// Граница мобильной раскладки — md из Tailwind (48rem); та же константа
// в index.css. Ниже неё стили идут через max-md:, выше — десктоп как был.
export const MOBILE_QUERY = "(max-width: 767.98px)";

const media = window.matchMedia(MOBILE_QUERY);

function subscribe(onChange: () => void) {
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => media.matches);
}
