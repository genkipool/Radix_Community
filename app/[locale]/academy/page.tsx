import AcademyClient from '@/features/academy/AcademyClient';
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
    title: isEs ? 'Academia | Aprende Radix' : 'Academy | Learn Radix',
    description: isEs
      ? 'Aprende Radix desde cero — fundamentos de DeFi, desarrollo con Scrypto, operaciones de staking y más.'
      : 'Learn Radix from the ground up — DeFi fundamentals, Scrypto development, validator operations, and more.',
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
  const { locale } = await params;
  const t = await getDictionary(locale as Locale);

  // Pass the resolved dictionary to the client component so all sections
  // are present in the server-rendered HTML (SEO + FCP improvement).
  return <AcademyClient t={t} />;
}
