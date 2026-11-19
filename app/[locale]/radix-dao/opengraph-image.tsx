import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { ogCard, headline, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix DAO | Radix Community';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['radixDao']);

  return ogCard({
    title: headline(t.seo.radixDao.title),
    subtitle: t.seo.radixDao.description,
  });
}
