import {
  Hero,
  TheProblem,
  Institutions,
  Comparison,
  DevSection,
  Ecosystem,
  LargeStats,
  Wallet,
  Security,
  RadixLearning,
  DAppsExchanges,
  BuyXRD,
  Staking,
  Interoperability,
  Roadmap,
  Community,
  Documentation,
  AboutRadix,
  CTAFinal,
} from '@/features/home';
import { getDictionary, type Locale } from '@/i18n/dictionaries';
import { buildAlternates } from '@/lib/seo';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getDictionary(locale as Locale);
  return {
    title: t.seo.home.title,
    description: t.seo.home.description,
    keywords: t.seo.home.keywords,
    alternates: buildAlternates(locale, ''),
  };
}


// ═══════ SSG — generateStaticParams ═══════
// Pre-renders this page at build time for each supported locale.
// The fully-translated HTML is served from CDN on every request:
// zero server computation per visitor → best TTFB + Core Web Vitals.
// Content only changes on deploy (translations live in the repo), so no
// `revalidate` is needed.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Home page — Server Component
 *
 * Previously ALL sections were forced to be Client Components just to call
 * `useLanguage()`. Now the page fetches the dictionary once, server-side,
 * and passes `t` as a prop to every section.
 *
 * Result:
 *  - Static sections (Problema, Roadmap, Comparativa, etc.) become RSC:
 *    their code is NOT shipped in the JavaScript bundle.
 *  - Interactive sections (Hero carousel, Ecosistema filters, etc.)
 *    remain Client Components but no longer depend on React Context —
 *    they just receive props like any normal component.
 *  - The full HTML is server-rendered with all translated text, improving
 *    First Contentful Paint and SEO indexability.
 */
export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getDictionary(locale as Locale);
  const language = locale as string;

  return (
    <div>
      <Hero t={t} locale={locale} />
      <TheProblem t={t} />
      <Institutions t={t} />
      <Comparison t={t} />
      <DevSection t={t} />
      <Ecosystem t={t} language={language} />
      <LargeStats t={t} />
      <Wallet t={t} />
      <BuyXRD t={t} />
      <RadixLearning t={t} language={language} />
      <Security t={t} />
      <DAppsExchanges t={t} language={locale} />
      <Interoperability t={t} />
      <Staking t={t} language={language} />
      <Community t={t} />
      <Roadmap t={t} />
      <Documentation t={t} />
      <AboutRadix t={t} />
      <CTAFinal t={t} locale={locale} />
    </div>
  );
}
