import { useState } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import {
  deleteUser, getMarkets, getUsers, resetPassword,
} from "../api/client";
import { Page } from "../components/layout/Layout";
import { Card, PageHeader } from "../components/ui/Card";
import {
  BTN_PRIMARY, BTN_SECONDARY, FIELD, Field, Modal,
} from "../components/ui/Modal";
import { ErrorNote, Loading } from "../components/ui/states";
import { UserForm } from "../components/users/UserForm";
import { useFetch } from "../hooks/useFetch";
import { useSession } from "../hooks/useSession";
import { apiErrorText } from "../lib/apiError";
import { formatDateTime } from "../lib/format";
import { ALL_MARKETS_ROLES, grantLabel, roleLabel } from "../lib/roles";
import type { UserRow } from "../types/api";

type Dialog =
  | { kind: "form"; user: UserRow | null }
  | { kind: "password"; user: UserRow }
  | { kind: "delete"; user: UserRow };

const LINK_BASE =
  "tr-soft border-0 bg-transparent p-0 text-[13px] font-medium";
const LINK = `${LINK_BASE} text-accent hover:text-accent-hover`;
const LINK_DANGER = `${LINK_BASE} text-bad-ink hover:text-bad`;
const BTN_DANGER =
  "tr-soft rounded-[9px] border-0 bg-bad px-3.5 py-[9px] text-sm font-semibold text-white hover:bg-bad-ink disabled:cursor-default disabled:opacity-60";

export default function UsersPage() {
  const { can } = useSession();
  const users = useFetch((signal) => getUsers(signal), []);
  const markets = useFetch((signal) => getMarkets(signal), []);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const editable = (u: UserRow) =>
    u.role !== "owner"
    && (u.role !== "admin" || can("users:manage_admins"));

  const saved = () => {
    setDialog(null);
    users.reload();
  };

  return (
    <Page>
      <PageHeader
        title="Пользователи"
        subtitle="Роли, модули и рынки. После изменения прав пользователь входит заново."
      >
        <button
          type="button"
          className={clsx(BTN_PRIMARY, "flex items-center gap-1.5")}
          onClick={() => setDialog({ kind: "form", user: null })}
        >
          <Plus size={16} /> Добавить
        </button>
      </PageHeader>
      <Card className="overflow-x-auto px-0 py-2">
        {users.error && <ErrorNote className="mx-6">{users.error}</ErrorNote>}
        {users.loading && !users.data && <Loading className="py-10" />}
        {users.data && (
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="px-6 py-3 font-normal">Пользователь</th>
                <th className="px-3 py-3 font-normal">Роль</th>
                <th className="px-3 py-3 font-normal">Модули и права</th>
                <th className="px-3 py-3 font-normal">Рынки</th>
                <th className="px-3 py-3 font-normal">Последний вход</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr
                  key={u.id}
                  className={clsx(
                    "border-t border-line align-top",
                    !u.is_active && "opacity-55",
                  )}
                >
                  <td className="px-6 py-3.5">
                    <span className="font-medium">{u.username}</span>
                    {!u.is_active && (
                      <span className="ml-2 rounded-full bg-track px-2 py-0.5 text-[11px] text-muted">
                        отключён
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">{roleLabel(u.role)}</td>
                  <td className="px-3 py-3.5 text-muted-2">
                    {ALL_MARKETS_ROLES.has(u.role)
                      ? "все модули"
                      : u.grants.map(grantLabel).join(", ") || "—"}
                    {u.own_only && !ALL_MARKETS_ROLES.has(u.role) && (
                      <span
                        className="mt-0.5 block text-xs text-faint"
                        title={u.source_names ?? ""}
                      >
                        только свои: {u.source_names ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-muted-2">
                    {ALL_MARKETS_ROLES.has(u.role)
                      ? "все"
                      : u.markets.join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3.5 text-muted-2">
                    {formatDateTime(u.last_login_at)}
                  </td>
                  <td className="px-6 py-3.5">
                    {editable(u) && (
                      <span className="flex justify-end gap-4">
                        <button
                          type="button"
                          className={LINK}
                          onClick={() => setDialog({ kind: "form", user: u })}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className={LINK}
                          onClick={() =>
                            setDialog({ kind: "password", user: u })}
                        >
                          Пароль
                        </button>
                        <button
                          type="button"
                          className={LINK_DANGER}
                          onClick={() =>
                            setDialog({ kind: "delete", user: u })}
                        >
                          Удалить
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog?.kind === "form" && (
        <UserForm
          user={dialog.user}
          markets={markets.data ?? []}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.kind === "password" && (
        <ResetDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onDone={saved}
        />
      )}
    </Page>
  );
}

function ResetDialog({
  user, onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 8) {
      setError("Пароль — не короче 8 символов");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPassword(user.id, password);
      setDone(true);
    } catch (e) {
      setError(apiErrorText(e, "Не удалось сбросить пароль"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Пароль для ${user.username}`}
      onClose={onClose}
      footer={done ? (
        <button type="button" className={BTN_PRIMARY} onClick={onClose}>
          Готово
        </button>
      ) : (
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy || !password}
            onClick={submit}
          >
            Задать
          </button>
        </>
      )}
    >
      {done ? (
        <p className="m-0 text-sm text-muted-2">
          Пароль задан, все сессии пользователя закрыты.
        </p>
      ) : (
        <>
          <Field label="Новый пароль">
            <input
              className={FIELD}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
        </>
      )}
    </Modal>
  );
}

function DeleteDialog({
  user, onClose, onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteUser(user.id);
      onDone();
    } catch (e) {
      setError(apiErrorText(e, "Не удалось удалить пользователя"));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Удалить ${user.username}?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={BTN_DANGER}
            disabled={busy}
            onClick={submit}
          >
            Удалить
          </button>
        </>
      }
    >
      <p className="m-0 text-sm text-muted-2">
        Записи журнала сохранятся с его логином.
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Modal>
  );
}
