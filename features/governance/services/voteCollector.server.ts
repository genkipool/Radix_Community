import 'server-only';
import { systemByComponent } from '../config/systems';

/**
 * Weighted results of Radix governance votes.
 *
 * The ledger stores who voted and what they picked, but not how much each
 * vote weighs: every governance system runs a "vote collector" that weighs
 * the votes by voting power at the snapshot and publishes the tallies. Only
 * the collectors listed in GOVERNANCE_SYSTEMS are ever queried.
 */

export type CollectorItemType = 'proposal' | 'temperature_check';

export interface VoterRow { account: string; vote: string; votePower: string }

export interface VoteTally {
    /** Voting power per choice: an option id ("0") or a stance ("For"). */
    results: Array<{ vote: string; votePower: string }>;
    /** Voting power of the requested account, when it voted. */
    accountPower: string | null;
    /** Largest voters (when requested) and how many accounts have a counted vote. */
    voters: { total: number; top: VoterRow[] } | null;
    /** Host that published the tally, shown to the user as the source. */
    source: string;
}

const TIMEOUT_MS = 8_000;

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Vote collector ${res.status}`);
    return res.json() as Promise<T>;
}

export function collectorFor(component: string): string | null {
    return systemByComponent(component)?.collector ?? null;
}

const powerOf = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export async function fetchVoteTally(
    component: string,
    type: CollectorItemType,
    entityId: string,
    options: { account?: string | null; topVoters?: number } = {},
): Promise<VoteTally | null> {
    const base = collectorFor(component);
    if (!base) return null;
    const { account = null, topVoters = 0 } = options;
    const query = `type=${type}&entityId=${encodeURIComponent(entityId)}`;
    const needAccounts = !!account || topVoters > 0;

    const [tally, accounts] = await Promise.all([
        getJson<{ results?: Array<{ vote?: unknown; votePower?: unknown }> }>(`${base}/vote-results?${query}`),
        needAccounts
            ? getJson<Array<{ accountAddress?: unknown; vote?: unknown; votePower?: unknown }>>(`${base}/account-votes?${query}`).catch(() => null)
            : Promise.resolve(null),
    ]);

    const rows: VoterRow[] = (Array.isArray(accounts) ? accounts : [])
        .filter(a => typeof a.accountAddress === 'string' && typeof a.vote === 'string' && typeof a.votePower === 'string')
        .map(a => ({ account: a.accountAddress as string, vote: a.vote as string, votePower: a.votePower as string }));
    const own = account ? rows.find(r => r.account === account) : undefined;
    // A multiple-choice ballot lists the same account once per option picked.
    const distinct = new Set(rows.map(r => r.account));

    return {
        results: (tally.results ?? [])
            .filter(r => typeof r.vote === 'string' && typeof r.votePower === 'string')
            .map(r => ({ vote: r.vote as string, votePower: r.votePower as string })),
        accountPower: own?.votePower ?? null,
        voters: topVoters > 0 && Array.isArray(accounts)
            ? { total: distinct.size, top: [...rows].sort((a, b) => powerOf(b.votePower) - powerOf(a.votePower)).slice(0, topVoters) }
            : null,
        source: new URL(base).hostname,
    };
}
