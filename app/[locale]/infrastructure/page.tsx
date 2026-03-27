import InfrastructureClient from '@/features/infrastructure/InfrastructureClient';
import { getDictionary, type Locale } from '@/i18n/dictionaries';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === 'es';
  return {
    title: isEs ? 'Infraestructura | Ejecuta un Nodo Radix' : 'Infrastructure | Run a Radix Node',
    description: isEs
      ? 'Todo lo que necesitas para ejecutar un nodo validador Radix — guías de configuración, requisitos de hardware y monitoreo.'
      : 'Everything you need to run a Radix validator node — setup guides, hardware requirements, and monitoring.',
  };
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
  const { locale } = await params;
  const t = await getDictionary(locale as Locale);

  return <InfrastructureClient t={t} />;
}
