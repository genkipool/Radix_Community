import { translations } from './index';

export type Locale = "en" | "es";

export const getDictionary = async (locale: Locale) => {
    return translations[locale] || translations.en;
};
