import AcademyClient from '@/features/academy/AcademyClient';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { buildAlternates } from '@/lib/seo';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['academy']);
  return {
    title: t.seo.academy.title,
    description: t.seo.academy.description,
    alternates: buildAlternates(locale, '/academy'),
  };
}


// ═══════ SSG — generateStaticParams ═══════
// Academy content is 100% static: it comes entirely from i18n translation files
// (course modules, comparisons, FAQs, code examples). No external API is called.
//
// Strategy: SSG (Static Site Generation)
//   - Build-time HTML contains all translated text → fully crawlable by search engines.
//   - Zero server work per request; served instantly from CDN edge cache.
//   - `t` is resolved on the server and passed as a prop so the page renders
//     correctly without depending on the React LanguageContext at runtime.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface AcademyPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AcademyPage({ params }: AcademyPageProps) {
  "use cache";
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['academy']);

  // Pass the resolved dictionary to the client component so all sections
  // are present in the server-rendered HTML (SEO + FCP improvement).
  return (
    <>
      <DictionaryEnricher partial={t} />
      <AcademyClient t={t} />
    </>
  );
}
