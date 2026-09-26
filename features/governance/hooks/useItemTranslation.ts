'use client';

import { useQuery } from '@tanstack/react-query';
import type { GovernanceEntry } from '../types';
import { KIND_SEGMENT } from '../lib/paths';

export interface TranslationResponse {
    status: 'ready' | 'pending' | 'unavailable';
    title?: string;
    shortDescription?: string;
    descriptionHtml?: string;
    options?: Array<{ id: number; label: string }>;
}

/** Languages proposals are machine-translated into (English is the original). */
const TRANSLATED_LANGUAGES = new Set(['es']);

/**
 * Machine translation of a vote's texts into the reader's language. While
 * the server produces it the answer is `pending` and this polls every few
 * seconds; once stored it comes back at once for every later reader.
 */
export function useItemTranslation(entry: GovernanceEntry, language: string, initial: TranslationResponse | null) {
    return useQuery<TranslationResponse>({
        queryKey: ['governance-translation', entry.systemKey, entry.kind, entry.id, language],
        queryFn: async () => {
            const query = new URLSearchParams({ system: entry.systemKey, kind: KIND_SEGMENT[entry.kind], id: entry.id, lang: language });
            const res = await fetch(`/api/governance-translate?${query.toString()}`);
            if (!res.ok) return { status: 'unavailable' };
            return res.json();
        },
        enabled: TRANSLATED_LANGUAGES.has(language),
        initialData: initial ?? undefined,
        staleTime: Infinity,
        refetchInterval: q => (q.state.data?.status === 'pending' ? 5000 : false),
    });
}
