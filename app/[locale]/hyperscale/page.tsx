import {
  Hero,
  ProofOfScale,
  Architecture,
  Banking,
  MachineEconomy,
  XianRoadmap,
  OpenSource,
  Participate,
  CTAFinal,
} from '@/features/hyperscale';
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
  const t = await getFeatureDictionary(locale as Locale, ['hyperscale']);
  return buildMetadata({
    locale,
    pathname: '/hyperscale',
    title: t.seo.hyperscale.title,
    description: t.seo.hyperscale.description,
    keywords: t.seo.hyperscale.keywords,
  });
}


// ═══════ SSG — generateStaticParams ═══════
// The Hyperscale page is fully static: every section is sourced from the
// feature's i18n files, so the translated HTML is pre-rendered per locale at
// build time and served from CDN. Content only changes on deploy — no
// `revalidate` needed.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface HyperscalePageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Hyperscale page — Server Component
 *
 * Same architecture as the home page: the dictionary is fetched once,
 * server-side, and passed as a prop to every section. All sections are RSC
 * except the hero carousel client island, so the JavaScript bundle cost of
 * the page is minimal while the full translated HTML remains crawlable.
 */
export default async function HyperscalePage({ params }: HyperscalePageProps) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['hyperscale']);

  return (
    <div>
      <DictionaryEnricher partial={t} />
      <Hero t={t} />
      <ProofOfScale t={t} />
      <Architecture t={t} />
      <Banking t={t} />
      <MachineEconomy t={t} />
      <XianRoadmap t={t} />
      <OpenSource t={t} />
      <Participate t={t} />
      <CTAFinal t={t} locale={locale} />
    </div>
  );
}
// force reload
