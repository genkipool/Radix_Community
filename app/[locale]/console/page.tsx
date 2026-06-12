import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildAlternates } from '@/lib/seo';
import ConsoleHome from '@/features/console/components/ConsoleHome';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['console']);
  return {
    title: t.seo.console.title,
    description: t.seo.console.description,
    alternates: buildAlternates(locale, '/console'),
  };
}

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface ConsolePageProps {
  params: Promise<{ locale: string }>;
}

export default async function ConsolePage({ params }: ConsolePageProps) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['console']);
  return <ConsoleHome dictionary={t} />;
}
