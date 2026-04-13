/**
 * SEO utilities for multi-language hreflang and canonical tag generation.
 *
 * Uses Next.js Metadata API `alternates` field to automatically generate:
 *   - <link rel="canonical" href="..." />
 *   - <link rel="alternate" hreflang="en" href="..." />
 *   - <link rel="alternate" hreflang="es" href="..." />
 *   - <link rel="alternate" hreflang="x-default" href="..." />
 */

const BASE_URL = 'https://radix-community.genkipool.com';
const LOCALES = ['en', 'es'] as const;
const DEFAULT_LOCALE = 'en';

type SupportedLocale = (typeof LOCALES)[number];

interface AlternatesResult {
  canonical: string;
  languages: Record<string, string>;
}

/**
 * Builds the `alternates` object for Next.js Metadata API.
 *
 * Google hreflang rules enforced:
 *   1. Every page links to ALL language versions (including itself).
 *   2. x-default points to the default locale (English).
 *   3. canonical is self-referencing (points to the current page URL).
 *
 * @param locale  - Current page locale ('en' | 'es')
 * @param pathname - Route segment WITHOUT locale prefix (e.g. '/academy', '' for home)
 * @returns Object ready to be spread into Metadata.alternates
 *
 * @example
 * // In generateMetadata for /en/academy:
 * return {
 *   title: '...',
 *   alternates: buildAlternates('en', '/academy'),
 * };
 */
export function buildAlternates(
  locale: string,
  pathname: string
): AlternatesResult {
  const safePath = pathname === '/' ? '' : pathname;
  const canonical = `${BASE_URL}/${locale}${safePath}`;

  const languages: Record<string, string> = {};

  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}${safePath}`;
  }

  // x-default: tells Google which version to show when no hreflang matches the user's language
  languages['x-default'] = `${BASE_URL}/${DEFAULT_LOCALE}${safePath}`;

  return { canonical, languages };
}

export type { SupportedLocale };
