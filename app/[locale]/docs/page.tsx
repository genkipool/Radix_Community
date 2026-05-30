import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { buildAlternates } from '@/lib/seo';
import DocsClient from '@/features/docs/DocsClient';
import { SuspenseSidebarFallback } from '@/components/ui/SuspenseSidebarFallback';
import type { UserDocMeta } from '@/features/docs/types/components.types';

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['docs']);
  return {
    title: t.seo.docs.title,
    description: t.seo.docs.description,
    alternates: buildAlternates(locale, '/docs'),
  };
}


// ═══════ SSG + dynamic cookies ═══════
// generateStaticParams pre-renders the shell at build time, but calling cookies()
// below opts this page into dynamic rendering per-request so the server can include
// the correct user-doc titles in the initial HTML — eliminating the sidebar flash.
export async function generateStaticParams() {
    return [{ locale: 'en' }, { locale: 'es' }];
}

interface DocsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
    const p = await params;
    const locale = p.locale;
    const [cookieStore, t] = await Promise.all([
        cookies(),
        getFeatureDictionary(locale as Locale, ['docs'])
    ]);
    const initialAutoCollapse = cookieStore.get('docs_auto_collapse')?.value === 'true';
    const initialExpandedTopics = cookieStore.get('docs_open_topics')?.value || '';

    // Parse compact sidebar meta: [{i: id, t: title, p: topic}]
    // Written by saveUserDocs on the client whenever docs are created/updated/deleted.
    let initialUserDocMeta: UserDocMeta[] = [];
    try {
        const raw = cookieStore.get('docs_sidebar_meta')?.value;
        if (raw) {
            const compact = JSON.parse(raw) as Array<{ i?: string; t?: string; p?: string }>;
            initialUserDocMeta = compact.reduce<Array<{ id: string; title: string; topic: string }>>((acc, x) => {
                const id = x.i ?? '';
                const title = x.t ?? '';
                const topic = x.p ?? '';
                if (id && title && topic) acc.push({ id, title, topic });
                return acc;
            }, []);
        }
    } catch { /* ignore malformed cookie */ }

    return (
        <Suspense fallback={<SuspenseSidebarFallback />}>
            <DictionaryEnricher partial={t} />
            <DocsClient
                initialAutoCollapse={initialAutoCollapse}
                initialExpandedTopics={initialExpandedTopics}
                initialUserDocMeta={initialUserDocMeta}
                dictionary={t}
            />
        </Suspense>
    );
}
