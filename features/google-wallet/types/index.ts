import type { Dictionary } from '@/types/i18n';

/**
 * Base props for Google Wallet sections that only need the dictionary.
 */
export interface GoogleWalletSectionProps {
  t: Dictionary;
}

/**
 * Props for sections that also need the locale (e.g., for building internal links).
 */
export interface GoogleWalletLocaleSectionProps {
  t: Dictionary;
  locale: string;
}
