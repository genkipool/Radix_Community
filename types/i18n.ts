import { translations } from '@/i18n';

/**
 * The full translations dictionary type, inferred from the English locale.
 * Used as the `t` prop type in server and client components that receive
 * translations as props instead of reading from LanguageContext.
 */
export type Dictionary = typeof translations.en;
