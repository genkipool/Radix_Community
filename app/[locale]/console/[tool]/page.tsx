import { notFound } from 'next/navigation';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { buildAlternates } from '@/lib/seo';
import ConsoleToolView from '@/features/console/components/ConsoleToolView';
import { CONSOLE_TOOL_SLUGS, isConsoleToolSlug } from '@/features/console/types/console.types';
import type { Metadata } from 'next';

interface ConsoleToolPageProps {
  params: Promise<{ locale: string; tool: string }>;
}

export async function generateStaticParams() {
  return (['en', 'es'] as const).flatMap((locale) =>
    CONSOLE_TOOL_SLUGS.map((tool) => ({ locale, tool })),
  );
}

export async function generateMetadata({ params }: ConsoleToolPageProps): Promise<Metadata> {
  const { locale, tool } = await params;
  // Thrown here (before streaming starts) so unknown tools get a real 404 status
  if (!isConsoleToolSlug(tool)) notFound();

  const t = await getFeatureDictionary(locale as Locale, ['console']);
  const labels = (t.console.tools as Record<string, { title: string; description: string }>)[tool];
  return {
    title: `${labels.title} — ${t.console.heroTitle} Radix`,
    description: labels.description,
    alternates: buildAlternates(locale, `/console/${tool}`),
  };
}

export default async function ConsoleToolPage({ params }: ConsoleToolPageProps) {
  const { locale, tool } = await params;
  if (!isConsoleToolSlug(tool)) notFound();

  const t = await getFeatureDictionary(locale as Locale, ['console']);
  return <ConsoleToolView slug={tool} dictionary={t} />;
}
