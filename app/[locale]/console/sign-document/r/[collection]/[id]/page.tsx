import { notFound } from 'next/navigation';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import ConsoleToolView from '@/features/console/components/ConsoleToolView';
import type { Metadata } from 'next';

/**
 * Directory-format share link for an on-ledger signing request:
 * `/console/sign-document/r/<collection>/<id>` — the two URL-safe halves of the
 * request key `<collection>:#<id>#`. The sign tool reads them via useParams()
 * and loads the request for the invited co-signer.
 */

interface SignRequestPageProps {
  params: Promise<{ locale: string; collection: string; id: string }>;
}

const isValidCollection = (v: string) => /^resource_[a-z0-9_]{1,200}$/.test(v);
const isValidId = (v: string) => /^\d{1,12}$/.test(v);

export async function generateMetadata({
  params,
}: SignRequestPageProps): Promise<Metadata> {
  const { locale, collection, id } = await params;
  if (!isValidCollection(collection) || !isValidId(id)) notFound();

  const t = await getFeatureDictionary(locale as Locale, ['console']);
  const labels = (
    t.console.tools as Record<string, { title: string; description: string }>
  )['sign-document'];
  return {
    title: `${labels.title} — ${t.console.heroTitle} Radix`,
    description: labels.description,
    // Shared request links are transient and per-document: keep them out of
    // search indexes.
    robots: { index: false, follow: false },
  };
}

export default async function SignRequestPage({ params }: SignRequestPageProps) {
  const { locale, collection, id } = await params;
  if (!isValidCollection(collection) || !isValidId(id)) notFound();

  const t = await getFeatureDictionary(locale as Locale, ['console']);
  return <ConsoleToolView slug="sign-document" dictionary={t} />;
}
