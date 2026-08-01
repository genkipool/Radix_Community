import { translations, loadFeatureDictionaries, type FeatureKey } from './index';

export type Locale = "en" | "es";

export const LOCALES: readonly Locale[] = ["en", "es"] as const;

/**
 * Whether a route's `[locale]` segment is a language this site actually has.
 *
 * `proxy.ts` cannot answer this for every URL: its matcher skips any path
 * containing a dot so that static assets are not redirected, which means
 * `/llms.txt` and friends reach `app/[locale]` directly with "llms.txt" as the
 * locale. Without this check the segment was accepted, the home page rendered
 * under `<html lang="llms.txt">` with a 200 and a self-referencing canonical,
 * and every probed filename became another indexable copy of the home page.
 */
export const isSupportedLocale = (value: string): value is Locale =>
    (LOCALES as readonly string[]).includes(value);

export const getDictionary = async (locale: Locale) => {
    return translations[locale] || translations.en;
};

export const getFeatureDictionary = async (
    locale: Locale,
    features: FeatureKey[] = [],
) => {
    const safeLocale = (locale === 'en' || locale === 'es') ? locale : 'en';
    return loadFeatureDictionaries(safeLocale, features);
};
