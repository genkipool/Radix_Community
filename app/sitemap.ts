// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://radix.community'
    const locales = ['en', 'es']

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

    // We generate all the language + path combinations
    const fullSitemap = paths.flatMap((path) =>
        locales.map((locale) => ({
            url: `${baseUrl}/${locale}${path}`,
            lastModified: new Date(),
            // Priority and changeFrequency are optional
            changeFrequency: 'weekly' as const,
            priority: path === '' ? 1 : 0.8,
        }))
    )

    return fullSitemap
}
