/** Locale-aware number, cost and date formatting for the admin view. */

export function formatNumber(
  value: number | null | undefined,
  locale: string,
  empty = '—',
): string {
  return value === null || value === undefined
    ? empty
    : new Intl.NumberFormat(locale).format(value);
}

/** Small per-request costs need more precision than cents. */
export function formatUsd(value: number | null | undefined, locale: string, empty = '—'): string {
  if (value === null || value === undefined) return empty;
  const digits = value !== 0 && Math.abs(value) < 0.01 ? 6 : value < 1 ? 4 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDateTime(
  iso: string | null | undefined,
  locale: string,
  empty = '—',
): string {
  if (!iso) return empty;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

export function formatDuration(ms: number | null | undefined, locale: string, empty = '—'): string {
  if (ms === null || ms === undefined) return empty;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(ms / 1000)} s`;
}
