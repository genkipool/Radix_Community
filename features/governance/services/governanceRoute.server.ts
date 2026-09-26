import 'server-only';
import { systemByKey } from '../config/systems';
import { kindFromSegment } from '../lib/paths';
import { after } from 'next/server';
import { fetchGovernanceEntries, fetchGovernanceEntry } from './governanceLedger.server';
import { getCachedTranslation, isTranslatable, requestTranslation } from './translation.server';
import type { GovernanceEntry } from '../types';

export interface GovernanceRouteParams { locale: string; system: string; kind: string; id: string }

/** Resolves a vote page's URL segments to its system and entry, or null. */
export async function resolveGovernanceRoute(params: GovernanceRouteParams) {
    const system = systemByKey(params.system);
    const kind = kindFromSegment(params.kind);
    if (!system || !kind || !/^\d{1,19}$/.test(params.id)) return null;
    const entry = await fetchGovernanceEntry(system.key, kind, params.id).catch(() => null);
    if (!entry || entry.item.hidden) return null;
    return { system, entry, serverNow: requestTime() };
}

/**
 * The request's time in unix seconds. Taken while loading data rather than in
 * a component body, and handed to the client so its first render matches the
 * server HTML (see `useNow`).
 */
export function requestTime(): number {
    return Math.floor(Date.now() / 1000);
}

/**
 * Every visible vote plus the time they were read at, with titles and
 * summaries in the reader's language where a translation is stored. Missing
 * translations are produced in the background, one at a time, after the
 * response has been sent, so the next visit shows them.
 */
export async function loadGovernanceList(locale: string) {
    const entries = await fetchGovernanceEntries();
    if (!isTranslatable(locale)) return { entries, serverNow: requestTime() };

    const missing: GovernanceEntry[] = [];
    const localized = await Promise.all(entries.map(async (e) => {
        // The list is read without descriptions; the cache key needs the full item.
        const full = await fetchGovernanceEntry(e.systemKey, e.kind, e.id).catch(() => null);
        const t = full ? await getCachedTranslation(full.item, locale) : null;
        if (!t) {
            if (full) missing.push(full);
            return e;
        }
        return { ...e, item: { ...e.item, title: t.title || e.item.title, shortDescription: t.shortDescription || e.item.shortDescription } };
    }));

    if (missing.length) {
        after(async () => {
            for (const e of missing) {
                const { run } = await requestTranslation(e.item, locale);
                if (run) await run();
            }
        });
    }
    return { entries: localized, serverNow: requestTime() };
}
