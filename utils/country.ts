/**
 * Country helpers shared by the server (grouping stake by country) and the
 * client (showing a country in the reader's language).
 *
 * Countries travel as ISO 3166-1 alpha-2 codes and are only turned into names
 * at the edge, with the platform's own Intl data: no table to maintain, and the
 * same code reads "Spain" in English and "España" in Spanish.
 */

const ISO_ALPHA2 = /^[A-Z]{2}$/;

/** The code in canonical upper case, or null when it is not an alpha-2 code. */
export function normalizeCountryCode(code: string | null | undefined): string | null {
    const upper = code?.trim().toUpperCase();
    return upper && ISO_ALPHA2.test(upper) ? upper : null;
}

const displayNames = new Map<string, Intl.DisplayNames | null>();

function regionNames(locale: string): Intl.DisplayNames | null {
    if (!displayNames.has(locale)) {
        try {
            displayNames.set(locale, new Intl.DisplayNames([locale], { type: 'region' }));
        } catch {
            displayNames.set(locale, null);
        }
    }
    return displayNames.get(locale) ?? null;
}

/** Localised country name for an alpha-2 code; the code itself if unknown. */
export function countryName(code: string, locale = 'en'): string {
    const normalized = normalizeCountryCode(code);
    if (!normalized) return code;
    try {
        return regionNames(locale)?.of(normalized) ?? normalized;
    } catch {
        return normalized;
    }
}
