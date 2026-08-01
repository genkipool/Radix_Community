/**
 * Share card for this section. The words are the same ones the page already
 * puts in its <title> and description, so the card and the search result
 * cannot drift apart; the artwork lives in `lib/og-card`.
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
  const t = await getFeatureDictionary(locale as Locale, ['seal']);

  return ogCard({
    title: headline(t.seo.seal.title),
    subtitle: t.seo.seal.description,
    // The page is about the seal, so the artwork shows the seal rather than
    // the generic app tile.
    backdrop: 'seal',
  });
}
