import { useNavigate, useSearchParams } from "react-router-dom";
import { OfferPanel } from "./OfferPanel";
import { useVpcLinks } from "../../hooks/useVpcScope";

export function OfferFromUrl({
  params = {},
}: {
  params?: Record<string, string>;
}) {
  const { factoryUrl, offersUrl } = useVpcLinks();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const id = Number(search.get("offer")) || null;
  if (!id) return null;
  return (
    <OfferPanel
      id={id}
      params={params}
      onClose={() => setSearch((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("offer");
        return next;
      })}
      onMnn={(card) => navigate(offersUrl({ mnn: card.generic }))}
      onMaker={(maker) => navigate(factoryUrl(maker))}
    />
  );
}
