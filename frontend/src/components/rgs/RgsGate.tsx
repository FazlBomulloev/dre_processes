import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getRgsMeta } from "../../api/rgs";
import { useFetch } from "../../hooks/useFetch";
import { useSession } from "../../hooks/useSession";
import type { RgsMeta } from "../../types/rgs";
import { Page } from "../layout/Layout";
import { BTN_PRIMARY } from "../ui/Modal";
import { EmptyCard, ErrorNote, Loading } from "../ui/states";

export function RgsGate({
  code, children,
}: {
  code: string;
  children: (meta: RgsMeta) => ReactNode;
}) {
  const { can } = useSession();
  const meta = useFetch((signal) => getRgsMeta(code, signal), [code]);
  const m = meta.loading ? null : meta.data;

  if (meta.error) return <Page><ErrorNote>{meta.error}</ErrorNote></Page>;
  if (!m) return <Page><Loading className="py-16" /></Page>;
  if (m.loaded) return children(m);
  return (
    <Page>
      <EmptyCard
        title={`Трекер RGS для ${m.name} ещё не загружен`}
        description="Как только трекер будет загружен, здесь появятся этапы регистрации, план и сроки."
      >
        {can("upload:rgs") && (
          <Link to="/imports" className={BTN_PRIMARY}>
            Загрузить трекер
          </Link>
        )}
      </EmptyCard>
    </Page>
  );
}
