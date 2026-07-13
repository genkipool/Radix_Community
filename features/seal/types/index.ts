import type { Dictionary } from '@/types/i18n';

/**
 * Base props for Radix Seal sections that only need the dictionary.
 */
export interface SealSectionProps {
  t: Dictionary;
}

/**
 * Props for sections that also need the locale (e.g., for building internal links).
 */
export interface SealLocaleSectionProps {
  t: Dictionary;
  locale: string;
}
