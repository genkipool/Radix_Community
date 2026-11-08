/**
 * Number and date formatting for Olympia values. Amounts arrive as exact
 * decimal strings; they are grouped by locale without going through a float,
 * so 2,400,000,000.1 XRD stays exactly that.
 */
import { formatNumber } from '@/utils/formatters';

/** An exact decimal string, grouped for the locale, cut to `maxDecimals`. */
export function formatDecimal(value: string, locale: string, maxDecimals = 4): string {
  const neg = value.startsWith('-');
  const [int, frac = ''] = (neg ? value.slice(1) : value).split('.');
  const grouped = BigInt(int || '0').toLocaleString(locale);
  const cut = frac.slice(0, maxDecimals).replace(/0+$/, '');
  const sep = (1.1).toLocaleString(locale).charAt(1);
  return `${neg ? '-' : ''}${grouped}${cut ? sep + cut : ''}`;
}

/** A float amount (rewards, sums) for display. */
export function formatAmount(n: number, locale: string, decimals = 2): string {
  return formatNumber(n, decimals, locale);
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function shortHash(hash: string, head = 8, tail = 6): string {
  return hash.length > head + tail + 1 ? `${hash.slice(0, head)}…${hash.slice(-tail)}` : hash;
}
