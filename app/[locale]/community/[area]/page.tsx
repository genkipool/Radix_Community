import type { Metadata } from 'next';
import { AREAS } from '@/features/community/data/communityData';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

/**
 * Each area is its own indexable URL, so it needs its own canonical and social
 * card. A bare `metadata.title` here would leave og:title inherited from the
 * root layout, i.e. describing the site instead of the page.
 *
 * `/community/admin` is a members-only panel, kept out of the index.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; area: string }>;
}): Promise<Metadata> {
  const { locale, area } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['community']);
  const areaNames: Record<string, string> = t.community_transparency.area_names;
  const areaLabel = areaNames[area];

  return buildMetadata({
    locale,
    pathname: `/community/${area}`,
    title: areaLabel ? `${areaLabel} · ${t.seo.community.title}` : t.seo.community.title,
    description: t.seo.community.description,
    noIndex: area === 'admin',
  });
}

// ═══════ SSG — generateStaticParams ═══════
// Pre-renders one URL per locale × area segment and the admin panel:
//   /en/community/development  /es/community/development
//   /en/community/marketing    /es/community/marketing
//   …
//   /en/community/admin        /es/community/admin
//
// All rendering is handled by the parent community layout (CommunityClient).
// CommunityClient reads usePathname() to derive the active segment on load.
export async function generateStaticParams() {
    const locales = ['en', 'es'];
    const segments = [...AREAS.map(a => a.id), 'admin'];

    return locales.flatMap(locale =>
        segments.map(area => ({ locale, area }))
    );
}

export default function CommunityAreaPage() {
    return null;
}
