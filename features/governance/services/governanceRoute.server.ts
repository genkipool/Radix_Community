import 'server-only';
import { systemByKey } from '../config/systems';
import { kindFromSegment } from '../lib/paths';
import { fetchGovernanceEntries, fetchGovernanceEntry } from './governanceLedger.server';

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

/** Every visible vote plus the time they were read at. */
export async function loadGovernanceList() {
    const entries = await fetchGovernanceEntries();
    return { entries, serverNow: requestTime() };
}
