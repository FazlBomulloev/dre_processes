import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getVpcMeta } from "../../api/vpc";
import { useFetch } from "../../hooks/useFetch";
import { useSession } from "../../hooks/useSession";
import { Page } from "../layout/Layout";
import { PageHeader } from "../ui/Card";
import { BTN_PRIMARY } from "../ui/Modal";
import { EmptyCard, ErrorNote, Loading } from "../ui/states";

export function VpcGate({
  title, children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { can } = useSession();
  const meta = useFetch((signal) => getVpcMeta(signal), []);

  if (meta.error) {
    return <Page><ErrorNote>{meta.error}</ErrorNote></Page>;
  }
  if (!meta.data) return <Page><Loading className="py-16" /></Page>;
  if (meta.data.loaded) return children;
  return (
    <Page>
      <PageHeader title={title} />
      <EmptyCard
        title="Выгрузка ВПЦ ещё не загружена"
        description="Как только администратор загрузит файл ВПЦ, здесь появятся цены и условия заводов."
      >
        {can("upload:vpc") && (
          <Link to="/imports" className={BTN_PRIMARY}>
            Загрузить выгрузку
          </Link>
        )}
      </EmptyCard>
    </Page>
  );
}
