import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import { getSession } from "../api/client";
import type { SessionUser } from "../types/api";

export interface SessionState {
  user: SessionUser | null;
  pending: boolean;
  set: (user: SessionUser) => void;
  clear: () => void;
  can: (permission: string) => boolean;
}

export const SessionContext = createContext<SessionState>({
  user: null,
  pending: true,
  set: () => {},
  clear: () => {},
  can: () => false,
});

export function useSession(): SessionState {
  return useContext(SessionContext);
}

export function useSessionState(): SessionState {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = useCallback((u: SessionUser) => {
    setUser(u);
    setPending(false);
  }, []);
  const clear = useCallback(() => setUser(null), []);

  // «*» у владельца — полный доступ, как на сервере.
  const can = useCallback(
    (permission: string) =>
      !!user
      && (user.permissions.includes("*")
        || user.permissions.includes(permission)),
    [user],
  );

  return { user, pending, set, clear, can };
}
