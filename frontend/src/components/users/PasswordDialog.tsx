import { useState } from "react";
import { changePassword } from "../../api/client";
import { apiErrorText } from "../../lib/apiError";
import {
  BTN_PRIMARY, BTN_SECONDARY, FIELD, Field, Modal,
} from "../ui/Modal";
import { ErrorNote } from "../ui/states";

export function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (newPassword.length < 8) {
      setError("Новый пароль — не короче 8 символов");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(oldPassword, newPassword);
      setDone(true);
    } catch (e) {
      setError(apiErrorText(e, "Не удалось сменить пароль"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Смена пароля"
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
            disabled={busy || !oldPassword || !newPassword}
            onClick={submit}
          >
            Сменить
          </button>
        </>
      )}
    >
      {done ? (
        <p className="m-0 text-sm text-muted-2">
          Пароль изменён. На других устройствах нужно войти заново.
        </p>
      ) : (
        <>
          <Field label="Текущий пароль">
            <input
              type="password"
              autoComplete="current-password"
              className={FIELD}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </Field>
          <Field label="Новый пароль">
            <input
              type="password"
              autoComplete="new-password"
              className={FIELD}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
        </>
      )}
    </Modal>
  );
}
