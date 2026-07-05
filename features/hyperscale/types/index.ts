import type { Dictionary } from '@/types/i18n';

/**
 * Base props for Hyperscale sections that only need the dictionary.
 */
export interface HyperscaleSectionProps {
  t: Dictionary;
}

/**
 * Props for sections that also need the locale (e.g., for building internal links).
 */
export interface HyperscaleLocaleSectionProps {
  t: Dictionary;
  locale: string;
}
