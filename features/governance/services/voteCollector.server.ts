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

/** One (account, choice) pair with the voting power behind it, per the collector. */
export interface CollectorVote { account: string; vote: string; votePower: string }

export interface VoteTally {
    /** Voting power per choice: an option id ("0") or a stance ("For"). */
    results: Array<{ vote: string; votePower: string }>;
    /** Voting power of the requested account, when it voted. */
    accountPower: string | null;
    /** Every counted vote (when requested). Multiple-choice ballots list an account once per option. */
    accountVotes: CollectorVote[] | null;
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

export async function fetchVoteTally(
    component: string,
    type: CollectorItemType,
    entityId: string,
    options: { account?: string | null; withVoters?: boolean } = {},
): Promise<VoteTally | null> {
    const base = collectorFor(component);
    if (!base) return null;
    const { account = null, withVoters = false } = options;
    const query = `type=${type}&entityId=${encodeURIComponent(entityId)}`;

    const [tally, accounts] = await Promise.all([
        getJson<{ results?: Array<{ vote?: unknown; votePower?: unknown }> }>(`${base}/vote-results?${query}`),
        account || withVoters
            ? getJson<Array<{ accountAddress?: unknown; vote?: unknown; votePower?: unknown }>>(`${base}/account-votes?${query}`).catch(() => null)
            : Promise.resolve(null),
    ]);

    const rows: CollectorVote[] = (Array.isArray(accounts) ? accounts : [])
        .filter(a => typeof a.accountAddress === 'string' && typeof a.vote === 'string' && typeof a.votePower === 'string')
        .map(a => ({ account: a.accountAddress as string, vote: a.vote as string, votePower: a.votePower as string }));

    return {
        results: (tally.results ?? [])
            .filter(r => typeof r.vote === 'string' && typeof r.votePower === 'string')
            .map(r => ({ vote: r.vote as string, votePower: r.votePower as string })),
        accountPower: account ? rows.find(r => r.account === account)?.votePower ?? null : null,
        accountVotes: withVoters && Array.isArray(accounts) ? rows : null,
        source: new URL(base).hostname,
    };
}
