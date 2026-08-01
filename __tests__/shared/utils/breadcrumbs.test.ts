import { describe, it, expect } from 'vitest';
import { resolveBreadcrumbs } from '@/lib/breadcrumbs';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { BASE_URL } from '@/lib/seo';

describe('resolveBreadcrumbs', () => {
    it('builds a two-step trail for a top-level section', async () => {
        expect(await resolveBreadcrumbs('en', '/en/seal')).toEqual([
            { name: 'Home', url: `${BASE_URL}/en` },
            { name: 'Radix Seal', url: `${BASE_URL}/en/seal` },
        ]);
    });

    it('translates the trail', async () => {
        const crumbs = await resolveBreadcrumbs('es', '/es/blog');
        expect(crumbs?.[0]).toEqual({ name: 'Inicio', url: `${BASE_URL}/es` });
    });

    it('resolves a console tool from the console dictionary', async () => {
        const crumbs = await resolveBreadcrumbs('en', '/en/console/create-token');
        expect(crumbs).toHaveLength(3);
        expect(crumbs?.[1].name).toBe('Console');
        expect(crumbs?.[2].url).toBe(`${BASE_URL}/en/console/create-token`);
        expect(crumbs?.[2].name.length).toBeGreaterThan(0);
    });

    it('resolves a community area name', async () => {
        const crumbs = await resolveBreadcrumbs('en', '/en/community/development');
        expect(crumbs?.[2]).toEqual({
            name: 'Development',
            url: `${BASE_URL}/en/community/development`,
        });
    });

    it('resolves the dashboard views', async () => {
        const crumbs = await resolveBreadcrumbs('en', '/en/dashboard/staking');
        expect(crumbs?.map((c) => c.name)).toEqual(['Home', 'Dashboard', 'Staking']);
    });

    // A breadcrumb is displayed verbatim in search results, so a guess is worse
    // than nothing at all.
    it('returns null rather than guessing an unknown label', async () => {
        expect(await resolveBreadcrumbs('en', '/en/console/not-a-real-tool')).toBeNull();
        expect(await resolveBreadcrumbs('en', '/en/community/not-an-area')).toBeNull();
        expect(await resolveBreadcrumbs('en', '/en/dashboard/not-a-view')).toBeNull();
        expect(await resolveBreadcrumbs('en', '/en/invented-section')).toBeNull();
    });

    it('returns null for the home page and for entity pages', async () => {
        expect(await resolveBreadcrumbs('en', '/en')).toBeNull();
        expect(
            await resolveBreadcrumbs('en', '/en/dashboard/validator/validator_rdx1abc'),
        ).toBeNull();
    });

    it('returns null when the pathname header is absent', async () => {
        expect(await resolveBreadcrumbs('en', null)).toBeNull();
    });
});

describe('buildBreadcrumbJsonLd', () => {
    it('numbers positions from 1, contiguously', async () => {
        const jsonLd = buildBreadcrumbJsonLd(
            await resolveBreadcrumbs('en', '/en/console/create-token'),
        );
        expect(jsonLd?.['@type']).toBe('BreadcrumbList');
        expect(jsonLd?.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    });

    it('emits nothing for an absent or single-item trail', () => {
        expect(buildBreadcrumbJsonLd(null)).toBeNull();
        expect(buildBreadcrumbJsonLd([{ name: 'Home', url: BASE_URL }])).toBeNull();
    });
});
