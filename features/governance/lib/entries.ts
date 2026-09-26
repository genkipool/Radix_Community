import type { GovernanceEntry } from '../types';
import { votingPhase, type VotingPhase } from './governanceVotes';

/** Groups shown in the sidebar and filters, in display order. */
export const PHASE_ORDER: readonly VotingPhase[] = ['open', 'upcoming', 'closed'];

export const entryKey = (e: Pick<GovernanceEntry, 'systemKey' | 'kind' | 'id'>) => `${e.systemKey}:${e.kind}:${e.id}`;

/**
 * Open votes first (closing soonest on top), then upcoming (opening soonest),
 * then closed (most recent first).
 */
export function sortEntries(entries: GovernanceEntry[], now: number): GovernanceEntry[] {
    const rank = (e: GovernanceEntry) => PHASE_ORDER.indexOf(votingPhase(e.item, now)) + 1 || PHASE_ORDER.length + 1;
    return [...entries].sort((a, b) => {
        const byPhase = rank(a) - rank(b);
        if (byPhase !== 0) return byPhase;
        const phase = votingPhase(a.item, now);
        if (phase === 'open') return (a.item.deadline ?? 0) - (b.item.deadline ?? 0);
        if (phase === 'upcoming') return (a.item.start ?? 0) - (b.item.start ?? 0);
        return (b.item.deadline ?? 0) - (a.item.deadline ?? 0);
    });
}

export function groupByPhase(entries: GovernanceEntry[], now: number): Record<VotingPhase, GovernanceEntry[]> {
    const groups: Record<VotingPhase, GovernanceEntry[]> = { open: [], upcoming: [], closed: [], unknown: [] };
    for (const e of sortEntries(entries, now)) groups[votingPhase(e.item, now)].push(e);
    return groups;
}

export function matchesQuery(entry: GovernanceEntry, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [entry.item.title, entry.item.shortDescription, entry.systemName, `#${entry.id}`]
        .some(text => text?.toLowerCase().includes(q));
}
