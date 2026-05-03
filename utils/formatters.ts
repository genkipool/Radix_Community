export function formatNumber(n: number, decimals: number = 8, locale: string = 'en'): string {
    return Number(n.toFixed(decimals)).toLocaleString(locale, {
        maximumFractionDigits: decimals
    });
}

/**
 * Formats a 0-100 value as a localized percentage (e.g., 99.5 -> "99,50%")
 */
export function formatPercent(n: number, decimals: number = 2, locale: string = 'en'): string {
    return (n / 100).toLocaleString(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

export function formatXRD(n: number, locale: string = 'en'): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
    if (n >= 1_000) return (n / 1_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'K';
    return formatNumber(n, 8, locale);
}

export function formatShortXRD(n: number, locale: string = 'en'): string {
    if (n === 0) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
    if (n >= 1_000) return (n / 1_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'K';
    return Number(n.toFixed(2)).toLocaleString(locale);
}

export function truncateAddress(address: string, start: number = 12, end: number = 6): string {
    if (!address) return '';
    if (address.length <= (start + end + 2)) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
}
