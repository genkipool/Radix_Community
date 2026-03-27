import DAppsClient from '@/features/dapps/DAppsClient';
import { getDictionary, type Locale } from '@/i18n/dictionaries';
import { dapps } from '@/features/dapps/data/dappsData';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    title: isEs ? 'DApps | Aplicaciones del Ecosistema Radix' : 'DApps | Radix Ecosystem Applications',
    description: isEs
      ? 'Descubre aplicaciones descentralizadas construidas en Radix — DEXs, protocolos de préstamos, plataformas NFT y más.'
      : 'Discover decentralized applications built on Radix — DEXs, lending protocols, NFT platforms, and more.',
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
  const t = await getDictionary(locale as Locale);

  // Pass the full catalogue so it's part of the server-rendered HTML.
  // DAppsClient uses it as the initial list and handles client-side mutations.
  return <DAppsClient t={t} initialDapps={dapps} />;
}
