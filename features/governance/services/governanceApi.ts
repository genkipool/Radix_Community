import type { GovernanceItemKind } from '../lib/governanceVotes';
import type { VoterRow } from '../types';

export interface TallyResponse {
    results: Array<{ vote: string; votePower: string }>;
    accountPower: string | null;
    /** Every voter, when requested with `voters`. */
    voters: VoterRow[] | null;
    /** Host of the collector that weighed the votes; null when it was unavailable. */
    source: string | null;
}

/** Weighted tally of a governance vote (see /api/governance-votes). Null when the system has no collector. */
export async function apiFetchGovernanceTally(params: {
    component: string;
    type: GovernanceItemKind;
    id: string;
    account?: string | null;
    voters?: boolean;
}): Promise<TallyResponse | null> {
    const query = new URLSearchParams({ component: params.component, type: params.type, id: params.id });
    if (params.account) query.set('account', params.account);
    if (params.voters) query.set('voters', '1');
    const res = await fetch(`/api/governance-votes?${query.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

/** Accounts per account-ages request: keeps each call short; the client asks in batches. */
export const AGE_BATCH = 40;

/** Full years on the ledger of each account when a vote opened (see /api/governance-votes/account-ages). */
export async function apiFetchAgeYears(network: string, atSec: number, accounts: string[]): Promise<Record<string, number>> {
    const query = new URLSearchParams({ network, at: String(atSec), accounts: accounts.join(',') });
    const res = await fetch(`/api/governance-votes/account-ages?${query.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json() as { years?: Record<string, number> } | null;
    return data?.years ?? {};
}
