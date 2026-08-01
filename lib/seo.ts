/**
 * SEO utilities: canonical/hreflang alternates plus the Open Graph and Twitter
 * Card blocks that social platforms read.
 *
 * Uses Next.js Metadata API `alternates` field to automatically generate:
 *   - <link rel="canonical" href="..." />
 *   - <link rel="alternate" hreflang="en" href="..." />
 *   - <link rel="alternate" hreflang="es" href="..." />
 *   - <link rel="alternate" hreflang="x-default" href="..." />
 *
 * Every page should go through `buildMetadata` rather than assembling a
 * `Metadata` object by hand. Next.js does NOT deep-merge `openGraph` from a
 * parent layout into a child page: the moment a page returns its own
 * `openGraph`, the layout's is dropped, and a page that returns none inherits
 * the layout's og:title, i.e. the wrong title. Building the whole block per
 * page is the only way to keep the two in sync.
 */

import type { Metadata } from 'next';

export const BASE_URL = 'https://radix-community.genkipool.com';
export const SITE_NAME = 'Radix Community';

/** Absolute path (from the site root) of the 1200x630 social card. */
export const OG_IMAGE_PATH = '/og-image.png';

/** Radix DLT's account; the site is a community project around the network. */
export const TWITTER_SITE = '@RadixDLT';

const LOCALES = ['en', 'es'] as const;

/** Open Graph wants a full locale, not the bare language code. */
const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  es: 'es_ES',
};

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
  // Pointing to the root URL (middleware will handle the redirection)
  languages['x-default'] = `${BASE_URL}${safePath || '/'}`;

  return { canonical, languages };
}

interface BuildMetadataOptions {
  /** Current page locale ('en' | 'es'). */
  locale: string;
  /** Route segment WITHOUT the locale prefix (e.g. '/academy', '' for home). */
  pathname: string;
  title: string;
  description: string;
  keywords?: string[];
  /**
   * Open Graph type. Articles (blog posts, docs) should pass 'article' so
   * platforms render the byline/date treatment instead of a plain link card.
   */
  type?: 'website' | 'article';
  /**
   * Overrides the default social card. Accepts a site-root path or an absolute
   * URL; relative paths are resolved against `metadataBase`.
   */
  image?: string;
  /**
   * Keeps a page out of the index while still letting crawlers follow its
   * links: `noindex, nofollow` would also strand every page it links to.
   */
  noIndex?: boolean;
}

/**
 * Assembles the full metadata block for a page: title, description, canonical
 * and hreflang alternates, Open Graph, and Twitter Card.
 */
export function buildMetadata({
  locale,
  pathname,
  title,
  description,
  keywords,
  type = 'website',
  image = OG_IMAGE_PATH,
  noIndex = false,
}: BuildMetadataOptions): Metadata {
  const alternates = buildAlternates(locale, pathname);
  const ogLocale = OG_LOCALES[locale] ?? OG_LOCALES.en;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates,
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type,
      title,
      description,
      url: alternates.canonical,
      siteName: SITE_NAME,
      locale: ogLocale,
      // The alternates let a platform know a translation exists without
      // duplicating the card for it.
      alternateLocale: Object.entries(OG_LOCALES)
        .filter(([loc]) => loc !== locale)
        .map(([, og]) => og),
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_SITE,
      title,
      description,
      images: [image],
    },
  };
}

export type { SupportedLocale, BuildMetadataOptions };
