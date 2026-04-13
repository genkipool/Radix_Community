import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getDictionary, type Locale } from '@/i18n/dictionaries';
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
  const t = await getDictionary(locale as Locale);
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

export default async function DocsPage() {
    const cookieStore = await cookies();
    const initialAutoCollapse = cookieStore.get('docs_auto_collapse')?.value === 'true';
    const initialExpandedTopics = cookieStore.get('docs_open_topics')?.value || '';

    // Parse compact sidebar meta: [{i: id, t: title, p: topic}]
    // Written by saveUserDocs on the client whenever docs are created/updated/deleted.
    let initialUserDocMeta: UserDocMeta[] = [];
    try {
        const raw = cookieStore.get('docs_sidebar_meta')?.value;
        if (raw) {
            const compact = JSON.parse(raw) as Array<{ i?: string; t?: string; p?: string }>;
            initialUserDocMeta = compact
                .map(x => ({ id: x.i ?? '', title: x.t ?? '', topic: x.p ?? '' }))
                .filter(x => x.id && x.title && x.topic);
        }
    } catch { /* ignore malformed cookie */ }

    return (
        <Suspense fallback={<SuspenseSidebarFallback />}>
            <DocsClient
                initialAutoCollapse={initialAutoCollapse}
                initialExpandedTopics={initialExpandedTopics}
                initialUserDocMeta={initialUserDocMeta}
            />
        </Suspense>
    );
}
