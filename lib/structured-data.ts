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

import type { Crumb } from './breadcrumbs';
import { BASE_URL, SITE_NAME } from './seo';

const LOGO_URL = `${BASE_URL}/icon-512.png`;

/**
 * Request header carrying the full pathname, set by `proxy.ts`.
 *
 * A layout only receives its own route segment, so without this the root
 * layout cannot know which page it is wrapping, and the breadcrumb would have
 * to be repeated in every page file (and forgotten in the next one added).
 */
export const PATHNAME_HEADER = 'x-pathname';

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
        // Deliberately no `sameAs`. That property asserts the listed URLs are
        // the SAME entity, and this site is an independent community project,
        // not Radix DLT. Pointing it at radixdlt.com would merge the two in a
        // search engine's entity graph, which is simply false. The relationship
        // is expressed on the WebSite node as `about` instead.
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: BASE_URL,
        name: SITE_NAME,
        description,
        publisher: { '@id': organizationId },
        inLanguage: locale,
        // What the site is ABOUT, which is the honest relation: it covers Radix
        // without claiming to be it.
        about: {
          '@type': 'Thing',
          name: 'Radix DLT',
          sameAs: ['https://www.radixdlt.com', 'https://x.com/radixdlt'],
        },
      },
    ],
  };
}

/**
 * BreadcrumbList for a resolved trail, or `null` when there is no trail.
 *
 * This is the markup Google reads to replace the raw URL in a result with a
 * readable path, so the positions must be contiguous and start at 1.
 */
export function buildBreadcrumbJsonLd(crumbs: Crumb[] | null) {
  if (!crumbs || crumbs.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

interface ToolJsonLdInput {
  name: string;
  description: string;
  /** Canonical URL of the tool's page. */
  url: string;
  locale: string;
}

/**
 * `SoftwareApplication` for a console tool.
 *
 * These pages are not articles about a tool, they ARE the tool: it runs in the
 * browser on that URL. Saying so lets a search engine classify the page as
 * software rather than as prose that happens to mention Radix.
 *
 * `offers` at price 0 is what marks it free. Omitting it does not imply free,
 * it implies unknown, and these tools genuinely cost nothing to use.
 */
export function buildToolJsonLd({ name, description, url, locale }: ToolJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web browser',
    inLanguage: locale,
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: { '@id': `${BASE_URL}/#organization` },
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
