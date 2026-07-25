// app/sitemap.ts
import { MetadataRoute } from 'next'
import { getValidatorsCached } from '@/services/gateway/validators';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import logger from '@/lib/logger';

const BASE_URL = 'https://radix-community.genkipool.com';
const LOCALES = ['en', 'es'] as const;

/**
 * Generated per request rather than at build time: the validator list comes
 * from Redis (a `no-store` read), which cannot be prerendered, and building it
 * statically silently produced a sitemap with no validators in it. The service
 * layer caches the data, so the cost per crawl is negligible.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Base routes of the application (based on the [locale] folder structure)
    const paths = [
        '',
        '/forum',
        '/docs',
        '/dapps',
        '/games',
        '/academy',
        '/blog',
        '/community',
        '/hyperscale',
        '/seal',
        '/google-wallet',
        '/infrastructure',
        '/dashboard/staking',
        '/dashboard/explorer'
    ]

    // Generate all language + path combinations with hreflang alternates
    const fullSitemap = paths.flatMap((path) =>
        LOCALES.map((locale) => ({
            url: `${BASE_URL}/${locale}${path}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: path === '' ? 1 : 0.8,
            alternates: {
                languages: {
                    ...Object.fromEntries(
                        LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}${path}`])
                    ),
                    'x-default': `${BASE_URL}${path || '/'}`
                },
            },
        }))
    )

    // ── Validator pages ────────────────────────────────────────────────────
    // Validators are the ONE enumerable entity kind (a few hundred on mainnet)
    // and the one people actually search for by name, so each gets its own
    // sitemap entry. Resources, accounts and transactions are unbounded: they
    // stay indexable through internal linking instead of being listed here.
    // Mainnet only — Stokenet pages are marked noindex, so listing them would
    // contradict the page's own robots directive.
    let validatorSitemap: MetadataRoute.Sitemap = [];
    try {
        const data = await getValidatorsCached('mainnet');
        const addresses = (data?.validators ?? [])
            .map((v) => v.address)
            .filter((address): address is string => typeof address === 'string');

        validatorSitemap = addresses.flatMap((address) =>
            LOCALES.map((locale) => ({
                url: `${BASE_URL}${dashboardRoutes.entity(locale, address)}`,
                lastModified: new Date(),
                changeFrequency: 'daily' as const,
                priority: 0.6,
                alternates: {
                    languages: Object.fromEntries(
                        LOCALES.map((loc) => [
                            loc,
                            `${BASE_URL}${dashboardRoutes.entity(loc, address)}`,
                        ])
                    ),
                },
            }))
        );
    } catch (error) {
        // A sitemap must never fail the build: without validators it is simply
        // the static routes, and the next revalidation picks them up.
        logger.error({ err: error }, '[sitemap] Failed to list validators');
    }

    return [...fullSitemap, ...validatorSitemap]
}
