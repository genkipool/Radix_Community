/**
 * Share card for an invitation to co-sign a document. It names the tool and
 * what the link is for, never the document or anyone involved: the request is
 * private to whoever was sent the link.
 */
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Community';

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['console']);
  const labels = (t.console.tools as Record<string, { title: string }>)['sign-document'];

  return ogCard({ title: t.console.signRequestOg.title, subtitle: `${t.console.signRequestOg.subtitle} · ${labels.title}` });
}
