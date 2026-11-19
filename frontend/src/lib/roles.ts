export const ROLES = [
  {
    value: "admin",
    label: "Админ",
    note: "пользователи, загрузки ВПЦ и RGS, все рынки",
  },
  {
    value: "manager",
    label: "Руководство",
    note: "просмотр всех модулей и рынков, Excel",
  },
  {
    value: "analyst",
    label: "Аналитик",
    note: "назначенные модули и рынки, Excel, загрузка по праву",
  },
  {
    value: "viewer",
    label: "Наблюдатель",
    note: "назначенные модули и рынки, без Excel",
  },
] as const;

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  ...Object.fromEntries(ROLES.map((r) => [r.value, r.label])),
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export const ALL_MARKETS_ROLES = new Set(["owner", "admin", "manager"]);

export const MODULE_GRANTS = [
  { value: "module:vpc", label: "ВПЦ · общий" },
  { value: "module:vpc_market", label: "ВПЦ · рынок" },
  { value: "module:rgs", label: "RGS" },
];

export const UPLOAD_GRANTS = [
  { value: "upload:vpc", label: "Загрузка ВПЦ" },
  { value: "upload:rgs", label: "Загрузка RGS" },
];

export const GRANTABLE: Record<string, string[]> = {
  analyst: [...MODULE_GRANTS, ...UPLOAD_GRANTS].map((g) => g.value),
  viewer: MODULE_GRANTS.map((g) => g.value),
};

const GRANT_LABELS: Record<string, string> = Object.fromEntries(
  [...MODULE_GRANTS, ...UPLOAD_GRANTS].map((g) => [g.value, g.label]),
);

export function grantLabel(value: string): string {
  return GRANT_LABELS[value] ?? value;
}

export const AUDIT_LABELS: Record<string, string> = {
  login: "Вход",
  login_failed: "Неудачный вход",
  password_change: "Сменил свой пароль",
  user_create: "Создан пользователь",
  user_update: "Изменён пользователь",
  user_password_reset: "Сброшен пароль",
  user_delete: "Удалён пользователь",
  market_create: "Создан рынок",
  market_update: "Изменён рынок",
  vpc_import: "Загружена выгрузка ВПЦ",
  rgs_import: "Загружен трекер RGS",
  vpc_export: "Выгрузка ВПЦ в Excel",
  rgs_export: "Выгрузка RGS в Excel",
  import_current: "Снимок сделан текущим",
  import_delete: "Удалён снимок",
};
