import { Link } from "react-router-dom";
import { getVpcMeta } from "../../api/vpc";
import { useFetch } from "../../hooks/useFetch";
import { useSession } from "../../hooks/useSession";
import { formatDate, formatInt } from "../../lib/format";

export function VpcCapsule() {
  const { can } = useSession();
  const meta = useFetch((signal) => getVpcMeta(signal), []);
  const data = meta.data;
  const canUpload = can("upload:vpc");

  return (
    <div className="flex h-12 items-center gap-3 rounded-full bg-surface py-1.5 pl-4 pr-1.5 text-[13px] max-md:hidden">
      <span
        className="size-2 rounded-full"
        style={{
          background: data?.loaded
            ? "var(--color-pos)"
            : "var(--color-faintest)",
        }}
      />
      <span className="whitespace-nowrap text-muted">
        {data?.loaded
          ? `Выгрузка ВПЦ · ${formatDate(data.data_date)} · `
            + `${formatInt(data.rows ?? 0)} позиций`
          : "Выгрузка ВПЦ не загружена"}
      </span>
      {canUpload ? (
        <Link
          to="/imports"
          className="tr-soft flex h-9 items-center whitespace-nowrap rounded-full bg-fg px-4 font-medium text-white hover:bg-fg-2 hover:text-white"
        >
          Обновить выгрузку
        </Link>
      ) : (
        <span className="w-2" />
      )}
    </div>
  );
}
