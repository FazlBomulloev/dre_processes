import { useState, type FormEvent } from "react";
import { login } from "../api/client";
import { Logo } from "../components/layout/Logo";
import { ErrorNote } from "../components/ui/states";
import { useSession } from "../hooks/useSession";
import { apiErrorText } from "../lib/apiError";

const INPUT =
  "h-11 w-full rounded-ctl border border-line-strong bg-white px-3.5 text-[15px] outline-none focus:border-accent";

export default function LoginPage() {
  const { set } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(username.trim(), password);
      set(user);
    } catch (err) {
      setError(apiErrorText(err, "Не удалось войти"));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-(--screen-h) items-center justify-center bg-ink px-4">
      <form
        onSubmit={submit}
        className="anim-rise flex w-[min(380px,100%)] flex-col gap-5 rounded-hero bg-white px-8 py-9 max-md:px-5"
      >
        <span className="flex w-fit rounded-2xl bg-ink px-4 py-3">
          <Logo />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
            Вход
          </h1>
          <span className="text-sm text-muted-2">
            Предложения заводов и регистрация препаратов
          </span>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted">
          Логин
          <input
            className={INPUT}
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted">
          Пароль
          <input
            className={INPUT}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="tr-soft h-11 rounded-ctl border-0 bg-fg text-[15px] font-semibold text-white hover:bg-ink disabled:cursor-default disabled:opacity-50"
        >
          {busy ? "Входим…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
