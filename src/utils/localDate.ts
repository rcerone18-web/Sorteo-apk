/** Fecha civil del dispositivo (no UTC): evita desfase con toISOString() cerca de medianoche. */
export function localCalendarYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normaliza respuesta API (YYYY-MM-DD o ISO) a YYYY-MM-DD según calendario local. */
export function toCalendarYmdFromApi(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return localCalendarYmd(d);
}
