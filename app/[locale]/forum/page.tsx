import { Suspense } from 'react';
import ForumClient from '@/features/forum/ForumClient';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { forumPosts, users } from '@/features/forum/data/forumData';
import { buildAlternates } from '@/lib/seo';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['forum', 'docs']);
  return {
    title: t.seo.forum.title,
    description: t.seo.forum.description,
    alternates: buildAlternates(locale, '/forum'),
  };
}


// ═══════ SSG — generateStaticParams ═══════
// Forum posts and users are static data defined in forumData.ts.
// No real-time API is involved — user interactions (likes, replies, new posts)
// are ephemeral client-state, not persisted to a backend.
//
// Strategy: SSG (Static Site Generation)
//  - Full thread list rendered in the server HTML → SEO-friendly, crawlable.
//  - All interactive features (expand, filter, like, publish) remain CSR.
//  - `language` is needed client-side for date formatting; it's passed as a prop
//    to avoid the extra context lookup on every render.
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

interface ForumPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ForumPage({ params }: ForumPageProps) {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['forum', 'docs']);

  return (
    <Suspense fallback={null}>
      <DictionaryEnricher partial={t} />
      <ForumClient
        t={t}
        language={locale as 'en' | 'es'}
        initialPosts={forumPosts}
        initialUsers={users}
      />
    </Suspense>
  );
}
