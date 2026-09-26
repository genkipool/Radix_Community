/** Formatting shared by the governance UI and its share cards (server-safe). */

export const fill = (tpl: string, values: Record<string, string>) =>
    Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), tpl);

export const formatXrd = (n: number, locale?: string) =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const formatPct = (n: number, locale?: string) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(n);

/** Date (and time) in the viewer's locale; `mode: 'date'` drops the time. */
export function formatDate(sec: number, locale?: string, timeZone?: string, mode: 'datetime' | 'date' = 'datetime') {
    const opts: Intl.DateTimeFormatOptions = mode === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' };
    try {
        return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(sec * 1000);
    } catch {
        return new Intl.DateTimeFormat(locale, opts).format(sec * 1000);
    }
}

/** "in 3 days" / "2 hours ago", relative to `nowSec` (defaults to the clock). */
export function formatRelative(sec: number, locale?: string, nowSec = Date.now() / 1000) {
    const diff = sec - nowSec;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs >= 86_400) return rtf.format(Math.round(diff / 86_400), 'day');
    if (abs >= 3_600) return rtf.format(Math.round(diff / 3_600), 'hour');
    return rtf.format(Math.round(diff / 60), 'minute');
}

/** Compact duration ("6 days", "14 h", "35 min") for a span of seconds. */
export function formatDuration(seconds: number, locale?: string): string {
    const abs = Math.max(0, seconds);
    const [value, unit]: [number, 'day' | 'hour' | 'minute'] = abs >= 86_400
        ? [Math.floor(abs / 86_400), 'day']
        : abs >= 3_600 ? [Math.floor(abs / 3_600), 'hour'] : [Math.max(1, Math.floor(abs / 60)), 'minute'];
    return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: unit === 'day' ? 'long' : 'short' }).format(value);
}

/** A share of a total, never rounding a real but tiny share down to "0 %". */
export function formatShare(share: number, locale?: string): string {
    if (share > 0 && share < 0.001) return `< ${formatPct(0.001, locale)}`;
    return formatPct(share, locale);
}
