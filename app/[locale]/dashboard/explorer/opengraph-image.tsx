/**
 * Share card for the transaction explorer. The words are the same ones the page
 * already puts in its <title> and description, so the card and the search
 * result cannot drift apart; the artwork lives in `lib/og-card`.
 *
 * Its own card rather than the site-wide one: the explorer and staking are two
 * different pages, and a link to either was previewing the same generic tile.
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
  const t = await getFeatureDictionary(locale as Locale, ['dashboard']);

  return ogCard({
    title: headline(t.seo.explorer.title),
    subtitle: t.seo.explorer.description,
  });
}
