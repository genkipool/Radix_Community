import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { buildAlternates } from '@/lib/seo';
import GamesClient from '@/features/games/GamesClient';
import { SuspenseSidebarFallback } from '@/components/ui/SuspenseSidebarFallback';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['games']);
  return {
    title: t.seo.games.title,
    description: t.seo.games.description,
    alternates: buildAlternates(locale, '/games'),
  };
}


// ═══════ SSG — generateStaticParams ═══════
// The games catalogue is static (gamesData.ts). The page shell is pre-rendered
// at build time for each locale, serving the catalogue from CDN instantly.
// GamesClient uses useSearchParams() for ?game=… selection → must stay inside
// <Suspense>. The game iframe (GamePlayer) only mounts after user interaction,
// so there is no CSR penalty on the initial page load.
export async function generateStaticParams() {
    return [{ locale: 'en' }, { locale: 'es' }];
}

interface GamesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function GamesPage({ params }: GamesPageProps) {
    const [{ locale }, cookieStore] = await Promise.all([params, cookies()]);
    const t = await getFeatureDictionary(locale as Locale, ['games']);

    const initialGridView = cookieStore.get('games_grid_view')?.value === 'true';
    const initialTheaterMode = cookieStore.get('games_theater_mode')?.value === 'true';
    const initialAutoCollapse = cookieStore.get('games_auto_collapse')?.value === 'true';
    const initialExpandedTopics = cookieStore.get('games_expanded_cats')?.value || '';

    return (
        <Suspense fallback={<SuspenseSidebarFallback />}>
            <DictionaryEnricher partial={t} />
            <GamesClient
                initialGridView={initialGridView}
                initialTheaterMode={initialTheaterMode}
                initialAutoCollapse={initialAutoCollapse}
                initialExpandedTopics={initialExpandedTopics}
                dictionary={t}
            />
        </Suspense>
    );
}
