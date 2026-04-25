/**
 * utils/currencyUtils.ts
 *
 * Utilities for localized currency detection and formatting.
 */

/**
 * Returns 'EUR' for Eurozone locales, otherwise 'USD'.
 */
export function getCurrencyForLocale(locale: string): 'EUR' | 'USD' {
    const euroLocales = ['es', 'fr', 'de', 'it', 'pt', 'nl', 'be', 'at', 'fi', 'gr', 'ie', 'lu', 'sk', 'si', 'ee', 'lv', 'lt', 'hr'];
    // Split locale (e.g. 'es-ES' -> 'es')
    const primary = locale.split('-')[0].toLowerCase();
    return euroLocales.includes(primary) ? 'EUR' : 'USD';
}

/**
 * Formats a numeric value as a currency string.
 */
export function formatCurrency(value: number, currency: 'EUR' | 'USD', locale: string): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
