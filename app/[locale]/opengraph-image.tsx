/**
 * Default share card, inherited by every route that does not define its own.
 *
 * A route file cannot see which of its children is being rendered, so this one
 * cannot speak for `/seal` or `/blog`; it describes the site. Sections worth
 * their own wording carry their own `opengraph-image.tsx` next to their page,
 * and anything added later falls back here rather than to nothing.
 */
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { ogCard, headline, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Community';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, []);

  return ogCard({
    title: headline(t.seo.root.title),
    subtitle: t.seo.root.description,
  });
}
