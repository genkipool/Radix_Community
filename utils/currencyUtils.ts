/**
 * utils/currencyUtils.ts
 *
 * Utilities for localized currency detection and formatting.
 */

const _currencyFmtCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(locale: string): Intl.NumberFormat {
    const cached = _currencyFmtCache.get(locale);
    if (cached) return cached;
    const I = Intl;
    const nf = new I.NumberFormat(locale, {
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

/**
 * A fiat value that may be tiny (a token's unit price, a small balance): two
 * decimals from 1 up, otherwise four significant digits, so 0.000251 € does
 * not show as 0,00 €.
 */
export function formatFiatPrecise(value: number, currency: 'EUR' | 'USD', locale: string): string {
    if (!Number.isFinite(value) || value === 0 || Math.abs(value) >= 1) return formatCurrency(value, currency, locale);
    const symbol = currency === 'EUR' ? '€' : '$';
    const formatted = new Intl.NumberFormat(locale, { maximumSignificantDigits: 4 }).format(value);
    return `${formatted} ${symbol}`;
}
