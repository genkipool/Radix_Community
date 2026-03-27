import type { Dictionary } from '@/types/i18n';

/**
 * Base props for most Home sections that only need the dictionary.
 */
export interface BaseSectionProps {
  t: Dictionary;
}

/**
 * Props for sections that need both the dictionary and a language code (e.g., for filtering).
 */
export interface LanguageSectionProps {
  t: Dictionary;
  language: string;
}

/**
 * Props for sections that need both the dictionary and a locale string (e.g., for routing).
 */
export interface LocaleSectionProps {
  t: Dictionary;
  locale: string;
}

// Aliases for specific sections (reusing generic ones for consistency)
export type EcosystemProps = LanguageSectionProps;
export type HeroProps = LocaleSectionProps;
export type RadixLearningProps = LanguageSectionProps;
export type StakingProps = LanguageSectionProps;
export type DAppsExchangesProps = LanguageSectionProps;
export type CTAFinalProps = LocaleSectionProps;

export interface WalletFloatingBadgesProps {
  t: Dictionary;
}

import type { Locale } from '@/i18n/dictionaries';

export interface InstitutionalPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Dictionary;
  lang: Locale;
}

export interface InfraReadButtonProps {
  label: string;
  className?: string;
}

export interface DevShellProps {
  t: Dictionary;
  tabs: string[];
  tab0: React.ReactNode;
  tab1: React.ReactNode;
  tab2: React.ReactNode;
  tab3: React.ReactNode;
}

export interface InstitutionalPilotButtonProps {
  label: string;
  className?: string;
}

export interface GraphicProps {
  t?: Dictionary;
}

export interface SectionHeaderProps {
  title: string;
  titleAccent?: string;
  subtitle?: string;
}
