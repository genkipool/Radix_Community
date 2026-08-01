import {
  Hero,
  Capabilities,
  TrustModel,
  Anatomy,
  Encryption,
  Privacy,
  Institutions,
  Comparison,
  OpenVerification,
  CTAFinal,
} from '@/features/seal';
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
  const t = await getFeatureDictionary(locale as Locale, ['seal']);
  return buildMetadata({
    locale,
    pathname: '/seal',
    title: t.seo.seal.title,
    description: t.seo.seal.description,
    keywords: t.seo.seal.keywords,
  });
}

// ═══════ SSG — generateStaticParams ═══════
// The Radix Seal page is fully static: every section is sourced from the
// feature's i18n files, so the translated HTML is pre-rendered per locale at
// build time and served from CDN. Content only changes on deploy — no
// `revalidate` needed.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface SealPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Radix Seal page — Server Component
 *
 * Same architecture as the home and Hyperscale pages: the dictionary is
 * fetched once, server-side, and passed as a prop to every section. All
 * sections are RSC, so the JavaScript bundle cost of the page is minimal while
 * the full translated HTML remains crawlable.
 */
export default async function SealPage({ params }: SealPageProps) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['seal']);

  return (
    <div>
      <DictionaryEnricher partial={t} />
      <Hero t={t} locale={locale} />
      <Capabilities t={t} locale={locale} />
      <TrustModel t={t} />
      <Anatomy t={t} />
      <Encryption t={t} />
      <Privacy t={t} locale={locale} />
      <Institutions t={t} />
      <Comparison t={t} />
      <OpenVerification t={t} locale={locale} />
      <CTAFinal t={t} locale={locale} />
    </div>
  );
}
