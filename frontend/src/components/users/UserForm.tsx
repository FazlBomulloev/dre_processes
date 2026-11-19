import { useState, type ReactNode } from "react";
import { createUser, updateUser } from "../../api/client";
import { useSession } from "../../hooks/useSession";
import { apiErrorText } from "../../lib/apiError";
import {
  ALL_MARKETS_ROLES, GRANTABLE, MODULE_GRANTS, ROLES, UPLOAD_GRANTS,
} from "../../lib/roles";
import type { Market, UserRow } from "../../types/api";
import {
  BTN_PRIMARY, BTN_SECONDARY, FIELD, Field, Modal,
} from "../ui/Modal";
import { ErrorNote } from "../ui/states";
import { toggled } from "../../lib/list";
import { ToggleChip } from "../ui/ToggleChip";

export function UserForm({
  user, markets, onClose, onSaved,
}: {
  user: UserRow | null;
  markets: Market[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can } = useSession();
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "analyst");
  const [grants, setGrants] = useState<string[]>(user?.grants ?? []);
  const [codes, setCodes] = useState<string[]>(user?.markets ?? []);
  const [active, setActive] = useState(user?.is_active ?? true);
  const [ownOnly, setOwnOnly] = useState(user?.own_only ?? false);
  const [names, setNames] = useState(user?.source_names ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roles = ROLES.filter(
    (r) => r.value !== "admin" || can("users:manage_admins"),
  );
  const grantable = GRANTABLE[role] ?? [];
  const perMarket = !ALL_MARKETS_ROLES.has(role);
  const shownGrants = grants.filter((g) => grantable.includes(g));

  const submit = async () => {
    if (!user && password.length < 8) {
      setError("Пароль — не короче 8 символов");
      return;
    }
    setBusy(true);
    setError("");
    const body = {
      role,
      grants: shownGrants,
      markets: perMarket ? codes : [],
      own_only: perMarket && ownOnly,
      source_names: names.trim() || null,
    };
    try {
      if (user) {
        await updateUser(user.id, { ...body, is_active: active });
      } else {
        await createUser({ ...body, username: username.trim(), password });
      }
      onSaved();
    } catch (e) {
      setError(apiErrorText(e, "Не удалось сохранить пользователя"));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={user ? `Пользователь ${user.username}` : "Новый пользователь"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy || (!user && !username.trim())}
            onClick={submit}
          >
            {user ? "Сохранить" : "Создать"}
          </button>
        </>
      }
    >
      {!user && (
        <>
          <Field label="Логин">
            <input
              className={FIELD}
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="Пароль">
            <input
              className={FIELD}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </>
      )}

      <Group label="Роль">
        <div className="flex flex-col gap-1.5">
          {roles.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-subtle"
            >
              <input
                type="radio"
                name="role"
                className="mt-1 accent-fg"
                checked={role === r.value}
                onChange={() => setRole(r.value)}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-xs text-faint">{r.note}</span>
              </span>
            </label>
          ))}
        </div>
      </Group>

      {grantable.length > 0 && (
        <Group label="Модули и права">
          <div className="flex flex-wrap gap-1.5">
            {[...MODULE_GRANTS, ...UPLOAD_GRANTS]
              .filter((g) => grantable.includes(g.value))
              .map((g) => (
                <ToggleChip
                  key={g.value}
                  active={shownGrants.includes(g.value)}
                  onClick={() => setGrants(toggled(shownGrants, g.value))}
                >
                  {g.label}
                </ToggleChip>
              ))}
          </div>
        </Group>
      )}

      {perMarket ? (
        <Group label="Рынки">
          <div className="flex flex-wrap gap-1.5">
            {markets.map((m) => (
              <ToggleChip
                key={m.code}
                active={codes.includes(m.code)}
                onClick={() => setCodes(toggled(codes, m.code))}
              >
                {m.code} · {m.name}
              </ToggleChip>
            ))}
          </div>
        </Group>
      ) : (
        <span className="text-xs text-faint">
          Эта роль видит все модули и рынки.
        </span>
      )}

      {perMarket && (
        <Group label="Строки данных">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="accent-fg"
              checked={ownOnly}
              onChange={(e) => setOwnOnly(e.target.checked)}
            />
            Видит только свои строки
          </label>
          {ownOnly && (
            <Field label="Имя в выгрузках (несколько — через «;»)">
              <input
                className={FIELD}
                value={names}
                placeholder="Anna Petrova; ЧС"
                onChange={(e) => setNames(e.target.value)}
              />
            </Field>
          )}
          <span className="text-xs text-faint">
            ВПЦ — по колонкам «БДМ» и «Аналитик», RGS — по «Ответственный».
          </span>
        </Group>
      )}

      {user && (
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="accent-fg"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Доступ включён
        </label>
      )}
      {user && (
        <span className="text-xs text-faint">
          После сохранения пользователь войдёт заново.
        </span>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </Modal>
  );
}

function Group({
  label, children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}
