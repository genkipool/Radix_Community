/**
 * Share card for one community area: its name over the section's words, the
 * same ones its <title> uses.
 */
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { ogCard, headline, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Community';

export default async function Image({ params }: { params: Promise<{ locale: string; area: string }> }) {
  const { locale, area } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['community']);
  const areaNames: Record<string, string> = t.community_transparency.area_names;

  return ogCard({
    title: areaNames[area] ?? headline(t.seo.community.title),
    subtitle: t.seo.community.description,
  });
}
