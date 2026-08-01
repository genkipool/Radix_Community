// app/sitemap.ts
import { MetadataRoute } from 'next'
import { getValidatorsCached } from '@/services/gateway/validators';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { CONSOLE_TOOL_SLUGS } from '@/features/console/types/console.types';
import { AREAS } from '@/features/community/data/communityData';
import { selectIndexableValidators } from '@/features/dashboard/lib/validatorIndexing';
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

/**
 * Deploy time, inlined by `next.config.ts`.
 *
 * `lastModified` used to be `new Date()`, evaluated per request, which told
 * Google that every URL on the site had changed today, every day. A crawler
 * that finds the claim false stops trusting the sitemap's dates altogether, so
 * the signal was worse than useless. Static pages change when the site is
 * deployed, and that is what this reports.
 */
const DEPLOYED_AT = process.env.BUILD_TIME ? new Date(process.env.BUILD_TIME) : undefined;

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
        '/dashboard/explorer',
        '/console',
        // Derived from the same lists the routes are generated from, so a new
        // tool or area cannot silently drop out of the sitemap.
        ...CONSOLE_TOOL_SLUGS.map((tool) => `/console/${tool}`),
        // `/community/admin` is deliberately absent: it is noindex.
        ...AREAS.map((area) => `/community/${area.id}`),
    ]

    // Generate all language + path combinations with hreflang alternates
    const fullSitemap = paths.flatMap((path) =>
        LOCALES.map((locale) => ({
            url: `${BASE_URL}/${locale}${path}`,
            ...(DEPLOYED_AT ? { lastModified: DEPLOYED_AT } : {}),
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
    //
    // Not every validator makes the cut. `selectIndexableValidators` explains
    // the rule; the ones it leaves out are still crawlable through the
    // validator list, they are just not URLs worth spending crawl budget on.
    let validatorSitemap: MetadataRoute.Sitemap = [];
    try {
        const data = await getValidatorsCached('mainnet');
        const validators = selectIndexableValidators(data?.validators ?? []);

        // When the payload came from Redis it carries the moment the validator
        // snapshot was refreshed, which is a real modification date for these
        // pages. Only that branch of the cache carries the timestamp; without
        // it no date is claimed at all, since an absent `lastmod` reads as
        // "unknown", which is honest, whereas a made-up one is not.
        const updatedAt = data && 'updatedAt' in data ? data.updatedAt : undefined;
        const refreshedAt = typeof updatedAt === 'number' ? new Date(updatedAt) : undefined;

        validatorSitemap = validators.flatMap((validator) =>
            LOCALES.map((locale) => ({
                url: `${BASE_URL}${dashboardRoutes.entity(locale, validator.address)}`,
                ...(refreshedAt ? { lastModified: refreshedAt } : {}),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
                alternates: {
                    languages: Object.fromEntries(
                        LOCALES.map((loc) => [
                            loc,
                            `${BASE_URL}${dashboardRoutes.entity(loc, validator.address)}`,
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
