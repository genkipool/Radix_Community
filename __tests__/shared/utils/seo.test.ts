import { describe, it, expect } from 'vitest';
import { BASE_URL, SITE_NAME, buildAlternates, buildMetadata } from '@/lib/seo';
import { buildSiteJsonLd, jsonLdScript } from '@/lib/structured-data';

describe('buildAlternates', () => {
    it('makes the canonical self-referencing', () => {
        expect(buildAlternates('es', '/seal').canonical).toBe(`${BASE_URL}/es/seal`);
    });

    it('links every locale plus x-default', () => {
        const { languages } = buildAlternates('en', '/academy');
        expect(languages).toEqual({
            en: `${BASE_URL}/en/academy`,
            es: `${BASE_URL}/es/academy`,
            'x-default': `${BASE_URL}/academy`,
        });
    });

    it('treats the home page path as empty, not as a trailing slash', () => {
        expect(buildAlternates('en', '/').canonical).toBe(`${BASE_URL}/en`);
        expect(buildAlternates('en', '').canonical).toBe(`${BASE_URL}/en`);
    });
});

describe('buildMetadata', () => {
    const base = {
        locale: 'en',
        pathname: '/seal',
        title: 'Radix Seal',
        description: 'Self-custody trust standard.',
    };

    it('keeps og:title and og:description in sync with the page title', () => {
        const meta = buildMetadata(base);
        expect(meta.openGraph?.title).toBe(base.title);
        expect(meta.openGraph?.description).toBe(base.description);
        expect(meta.twitter?.title).toBe(base.title);
    });

    it('points og:url at the canonical URL', () => {
        const meta = buildMetadata(base);
        expect(meta.openGraph?.url).toBe(`${BASE_URL}/en/seal`);
        expect(meta.alternates?.canonical).toBe(`${BASE_URL}/en/seal`);
    });

    it('ships a large-image Twitter card', () => {
        expect(buildMetadata(base).twitter).toMatchObject({ card: 'summary_large_image' });
    });

    // Each route draws its own card in an `opengraph-image.tsx` next to its
    // page and Next wires it in. Naming an image here as well would fight that
    // and put every page back on one shared picture, so the absence is the
    // contract worth guarding.
    it('names no image, leaving that to each route opengraph-image', () => {
        const meta = buildMetadata(base);
        expect(meta.openGraph && 'images' in meta.openGraph && meta.openGraph.images).toBeFalsy();
        expect(meta.twitter && 'images' in meta.twitter && meta.twitter.images).toBeFalsy();
    });

    it('maps the locale to a full Open Graph locale and lists the other one', () => {
        expect(buildMetadata({ ...base, locale: 'es' }).openGraph).toMatchObject({
            locale: 'es_ES',
            alternateLocale: ['en_US'],
            siteName: SITE_NAME,
        });
    });

    it('omits robots unless the page opts out of indexing', () => {
        expect(buildMetadata(base).robots).toBeUndefined();
    });

    it('lets crawlers follow links out of a noindex page', () => {
        expect(buildMetadata({ ...base, noIndex: true }).robots).toEqual({
            index: false,
            follow: true,
        });
    });
});

describe('structured data', () => {
    it('ties the WebSite node to the Organization node by @id', () => {
        const graph = buildSiteJsonLd('en', 'A description.')['@graph'];
        const organization = graph.find((node) => node['@type'] === 'Organization');
        const website = graph.find((node) => node['@type'] === 'WebSite');

        expect(organization?.['@id']).toBeDefined();
        expect(website).toMatchObject({
            publisher: { '@id': organization?.['@id'] },
            inLanguage: 'en',
        });
    });

    it('escapes < so a value can never close the script tag early', () => {
        const escaped = jsonLdScript({ name: '</script><img onerror=alert(1)>' });
        expect(escaped).not.toContain('</script>');
        expect(escaped).toContain('\\u003c');
    });
});
