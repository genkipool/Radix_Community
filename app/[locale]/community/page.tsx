// ═══════ SSG — generateStaticParams ═══════
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['community']);
  return buildMetadata({
    locale,
    pathname: '/community',
    title: t.seo.community.title,
    description: t.seo.community.description,
  });
}

// Community data is static (communityData.ts). The page shell is pre-rendered
// at build time for each locale.
//
// All rendering is handled by the parent community layout (CommunityClient
// in layout.tsx). This page only exists to declare generateStaticParams so
// Next.js pre-builds /en/community and /es/community at deploy time.
export async function generateStaticParams() {
    return [{ locale: 'en' }, { locale: 'es' }];
}

export default function CommunityPage() {
    return null;
}
