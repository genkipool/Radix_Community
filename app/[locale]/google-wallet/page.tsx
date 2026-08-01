import {
  Hero,
  Problem,
  Solution,
  InvisibleFlow,
  Resale,
  WhyRadix,
  WinWin,
  Business,
  Implementation,
  AdoptionPath,
  Rigor,
  CTAFinal,
} from '@/features/google-wallet';
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
  const t = await getFeatureDictionary(locale as Locale, ['googleWallet']);
  return buildMetadata({
    locale,
    pathname: '/google-wallet',
    title: t.seo.googleWallet.title,
    description: t.seo.googleWallet.description,
    keywords: t.seo.googleWallet.keywords,
  });
}

// ═══════ SSG — generateStaticParams ═══════
// The Google Wallet × Radix page is fully static: every section is sourced
// from the feature's i18n files, so the translated HTML is pre-rendered per
// locale at build time and served from CDN. Content only changes on deploy —
// no `revalidate` needed.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface GoogleWalletPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Google Wallet × Radix page — Server Component
 *
 * Same architecture as the home and Hyperscale pages: the dictionary is
 * fetched once, server-side, and passed as a prop to every section. All
 * sections are RSC — the page ships no page-specific JavaScript while the
 * full translated HTML remains crawlable.
 */
export default async function GoogleWalletPage({ params }: GoogleWalletPageProps) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['googleWallet']);

  return (
    <div>
      <DictionaryEnricher partial={t} />
      <Hero t={t} />
      <Problem t={t} />
      <Solution t={t} />
      <InvisibleFlow t={t} />
      <Resale t={t} />
      <WhyRadix t={t} />
      <WinWin t={t} />
      <Business t={t} />
      <Implementation t={t} />
      <AdoptionPath t={t} />
      <Rigor t={t} />
      <CTAFinal t={t} locale={locale} />
    </div>
  );
}
