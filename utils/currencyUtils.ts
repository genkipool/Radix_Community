/**
 * utils/currencyUtils.ts
 *
 * Utilities for localized currency detection and formatting.
 */

const _currencyFmtCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(locale: string): Intl.NumberFormat {
    const cached = _currencyFmtCache.get(locale);
    if (cached) return cached;
    const nf = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    _currencyFmtCache.set(locale, nf);
    return nf;
}

/**
 * Returns 'EUR' for Eurozone locales, otherwise 'USD'.
 */
export function getCurrencyForLocale(locale: string): 'EUR' | 'USD' {
    const euroLocales = ['es', 'fr', 'de', 'it', 'pt', 'nl', 'be', 'at', 'fi', 'gr', 'ie', 'lu', 'sk', 'si', 'ee', 'lv', 'lt', 'hr'];
    // Split locale (e.g. 'es-ES' -> 'es')
    const primary = locale.split('-')[0].toLowerCase();
    return euroLocales.includes(primary) ? 'EUR' : 'USD';
}

export function formatCurrency(value: number, currency: 'EUR' | 'USD', locale: string): string {
    const nf = getCurrencyFormatter(locale);
    const formattedNum = nf.format(value);
    
    // The user specifically requested the currency symbol to be strictly on the right
    const symbol = currency === 'EUR' ? '€' : '$';
    return `${formattedNum} ${symbol}`;
}
