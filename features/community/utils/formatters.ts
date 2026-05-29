/**
 * Community formatters for currency and dates.
 */

const _xrdFmt = new Intl.NumberFormat('es-ES');
const _usdFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Formats a number as XRD (e.g., 150.000 XRD).
 */
export function fmtXrd(n: number) {
    return _xrdFmt.format(Math.abs(n)) + ' XRD';
}

/**
 * Formats a number as a short XRD string (e.g., 1.5M XRD).
 */
export function fmtXrdShort(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M XRD';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k XRD';
    return n + ' XRD';
}

/**
 * Formats a number as USD (e.g., $15,000).
 */
export function fmtUsd(n: number) {
    return '$' + _usdFmt.format(Math.abs(n));
}

/**
 * Formats a date string to a localized short date (e.g., 15 ene 2025).
 */
export function fmtDate(s: string) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Truncates a hash for display (e.g., 0x1234...5678).
 */
export function truncateHash(h: string, chars = 6) {
    if (!h) return '';
    if (h.length <= chars * 2 + 1) return h;
    return `${h.slice(0, chars)}…${h.slice(-chars)}`;
}
