import { translations, loadFeatureDictionaries, type FeatureKey } from './index';

export type Locale = "en" | "es";

export const getDictionary = async (locale: Locale) => {
    return translations[locale] || translations.en;
};

export const getFeatureDictionary = async (
    locale: Locale,
    features: FeatureKey[] = [],
) => {
    return loadFeatureDictionaries(locale, features);
};
