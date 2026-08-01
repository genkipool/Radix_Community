/**
 * JSON-LD structured data.
 *
 * Search engines and AI summarisers parse schema.org graphs far more reliably
 * than they parse the rendered layout, so the site identity (who publishes it,
 * what it is, which languages it exists in) is stated once here and emitted
 * from the root layout on every page.
 *
 * Validate changes at https://validator.schema.org/ before shipping.
 */

import { BASE_URL, SITE_NAME } from './seo';

const LOGO_URL = `${BASE_URL}/icon-512.png`;

/**
 * Organization + WebSite as a single `@graph`, cross-referenced by `@id` so
 * the two nodes are understood as one entity rather than two unrelated ones.
 */
export function buildSiteJsonLd(locale: string, description: string) {
  const organizationId = `${BASE_URL}/#organization`;
  const websiteId = `${BASE_URL}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        url: BASE_URL,
        logo: {
          '@type': 'ImageObject',
          url: LOGO_URL,
          width: 512,
          height: 512,
        },
        description,
        sameAs: ['https://x.com/radixdlt', 'https://www.radixdlt.com'],
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: BASE_URL,
        name: SITE_NAME,
        description,
        publisher: { '@id': organizationId },
        inLanguage: locale,
      },
    ],
  };
}

/**
 * Serialises a JSON-LD object for `dangerouslySetInnerHTML`.
 *
 * `<` is escaped because a `</script>` sequence inside any string value would
 * otherwise close the script tag early and turn the rest of the payload into
 * markup.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
