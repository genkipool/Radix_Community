import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['console']);
  return buildMetadata({
    locale,
    pathname: '/console',
    title: t.seo.console.title,
    description: t.seo.console.description,
  });
}

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface ConsolePageProps {
  params: Promise<{ locale: string }>;
}

/** The landing itself is rendered by the console layout (ConsoleShell), which keeps it mounted so it can fold away when a tool opens. */
export default async function ConsolePage({ params }: ConsolePageProps) {
  await params;
  return null;
}
