import DAppsClient from '@/features/dapps/DAppsClient';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { dapps } from '@/features/dapps/data/dappsData';
import { buildAlternates } from '@/lib/seo';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['dapps']);
  return {
    title: t.seo.dapps.title,
    description: t.seo.dapps.description,
    alternates: buildAlternates(locale, '/dapps'),
  };
}


// ═══════ SSG — generateStaticParams ═══════
// The DApps catalogue is a static list defined in dappsData.ts.
// No external API is called → pure SSG is the best strategy.
//
// Benefits:
//  - Full catalogue HTML in the server response → crawlable by search engines.
//  - Filter/search/like interactions stay fully client-side (CSR inside the Client Component).
//  - `t` is resolved once at build time and passed as a prop so the client
//    component doesn't need the LanguageContext for its initial render.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface DAppsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DAppsPage({ params }: DAppsPageProps) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['dapps']);

  // Pass the full catalogue so it's part of the server-rendered HTML.
  // DAppsClient uses it as the initial list and handles client-side mutations.
  return (
    <>
      <DictionaryEnricher partial={t} />
      <DAppsClient t={t} initialDapps={dapps} />
    </>
  );
}
