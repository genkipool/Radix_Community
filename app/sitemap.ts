// app/sitemap.ts
import { MetadataRoute } from 'next'

const BASE_URL = 'https://radix-community.genkipool.com';
const LOCALES = ['en', 'es'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
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
        '/infrastructure',
        '/dashboard'
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

    return fullSitemap
}
