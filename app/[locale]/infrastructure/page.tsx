import InfrastructureClient from '@/features/infrastructure/InfrastructureClient';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { buildMetadata } from '@/lib/seo';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['infrastructure']);
  return buildMetadata({
    locale,
    pathname: '/infrastructure',
    title: t.seo.infrastructure.title,
    description: t.seo.infrastructure.description,
  });
}


// ═══════ SSG — generateStaticParams ═══════
// The infrastructure page is a static catalogue of 8 Radix technology layers,
// all sourced from i18n files and infrastructureData.ts.
//
// Strategy: SSG (Static Site Generation)
//  - Full layer/item HTML in the server response → crawlable by search engines.
//  - Search and expand/collapse interactions stay purely client-side.
//  - `t` is resolved at build time and passed as a prop (no LanguageContext needed
//    for the initial render, removing a round-trip to the context provider).
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface InfrastructurePageProps {
  params: Promise<{ locale: string }>;
}

export default async function InfrastructurePage({ params }: InfrastructurePageProps) {
  "use cache";
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['infrastructure']);

  return (
    <>
      <DictionaryEnricher partial={t} />
      <InfrastructureClient t={t} />
    </>
  );
}
