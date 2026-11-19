import axios from "axios";
import type {
  AuditPage,
  ImportRow,
  Market,
  MarketCreateBody,
  MarketUpdateBody,
  SessionUser,
  UserCreateBody,
  UserRow,
  UserUpdateBody,
} from "../types/api";

export const api = axios.create({ baseURL: "/api", withCredentials: true });

// Истёкшая сессия уводит на вход и запоминает, куда человек шёл.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    if (status === 401 && !url.startsWith("/auth/")) {
      const here = window.location.pathname + window.location.search;
      if (window.location.pathname !== "/login") {
        window.location.replace(`/login?from=${encodeURIComponent(here)}`);
      }
    }
    return Promise.reject(error);
  },
);

export async function getSession(): Promise<SessionUser | null> {
  const { data } = await api.get<{ user: SessionUser | null }>(
    "/auth/session",
  );
  return data.user;
}

export async function login(
  username: string, password: string,
): Promise<SessionUser> {
  const { data } = await api.post<SessionUser>("/auth/login", {
    username, password,
  });
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function changePassword(
  old_password: string, new_password: string,
): Promise<void> {
  await api.post("/auth/password", { old_password, new_password });
}

export async function getMarkets(signal?: AbortSignal): Promise<Market[]> {
  const { data } = await api.get<Market[]>("/markets", { signal });
  return data;
}

export async function createMarket(body: MarketCreateBody): Promise<Market> {
  const { data } = await api.post<Market>("/markets", body);
  return data;
}

export async function updateMarket(
  code: string, body: MarketUpdateBody,
): Promise<Market> {
  const { data } = await api.patch<Market>(`/markets/${code}`, body);
  return data;
}

export async function getUsers(signal?: AbortSignal): Promise<UserRow[]> {
  const { data } = await api.get<UserRow[]>("/users", { signal });
  return data;
}

export async function createUser(body: UserCreateBody): Promise<UserRow> {
  const { data } = await api.post<UserRow>("/users", body);
  return data;
}

export async function updateUser(
  id: number, body: UserUpdateBody,
): Promise<UserRow> {
  const { data } = await api.patch<UserRow>(`/users/${id}`, body);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function resetPassword(
  id: number, password: string,
): Promise<void> {
  await api.post(`/users/${id}/password`, { password });
}

export async function getAudit(
  params: { offset: number; limit: number; action?: string },
  signal?: AbortSignal,
): Promise<AuditPage> {
  const { data } = await api.get<AuditPage>("/audit", { params, signal });
  return data;
}

export async function getImports(
  kind?: string, signal?: AbortSignal,
): Promise<ImportRow[]> {
  const { data } = await api.get<ImportRow[]>("/imports", {
    params: kind ? { kind } : undefined, signal,
  });
  return data;
}

export async function getImport(id: number): Promise<ImportRow> {
  const { data } = await api.get<ImportRow>(`/imports/${id}`);
  return data;
}

export async function uploadVpc(file: File): Promise<ImportRow> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<ImportRow>("/imports/vpc", form, {
    timeout: 10 * 60 * 1000,
  });
  return data;
}

export async function uploadRgs(
  file: File, market: string, dataDate: string,
): Promise<ImportRow> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<ImportRow>("/imports/rgs", form, {
    params: { market, data_date: dataDate },
    timeout: 5 * 60 * 1000,
  });
  return data;
}

export async function makeImportCurrent(id: number): Promise<ImportRow> {
  const { data } = await api.post<ImportRow>(`/imports/${id}/current`);
  return data;
}

export async function deleteImport(id: number): Promise<void> {
  await api.delete(`/imports/${id}`);
}
