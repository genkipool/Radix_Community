/**
 * Share card for one console tool.
 *
 * The twenty tools are the pages a developer actually pastes into a chat, and
 * a card naming the tool is the difference between "some Radix site" and
 * "the manifest builder". Names come from this repo's own dictionaries, so
 * unlike the entity pages there is no third-party text on this card.
 */
import { notFound } from 'next/navigation';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { isConsoleToolSlug } from '@/features/console/types/console.types';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Community';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; tool: string }>;
}) {
  const { locale, tool } = await params;
  if (!isConsoleToolSlug(tool)) notFound();

  const t = await getFeatureDictionary(locale as Locale, ['console']);
  const labels = (t.console.tools as Record<string, { title: string; description: string }>)[tool];

  return ogCard({
    eyebrow: t.console.heroTitle,
    title: labels.title,
    subtitle: labels.description,
  });
}
