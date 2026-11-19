const DATE_TIME = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Сервер отдаёт время в UTC без зоны.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const value = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(value.getTime()) ? "—" : DATE_TIME.format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : "—";
}

const INT = new Intl.NumberFormat("ru-RU");

export function formatInt(value: number): string {
  return INT.format(value);
}
