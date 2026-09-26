import type { GovernanceItemKind } from '../lib/governanceVotes';

export interface TallyResponse {
    results: Array<{ vote: string; votePower: string }>;
    accountPower: string | null;
    voters: { total: number; top: Array<{ account: string; vote: string; votePower: string }> } | null;
    source: string;
}

/** Weighted tally of a governance vote (see /api/governance-votes). Null when the system has no collector. */
export async function apiFetchGovernanceTally(params: {
    component: string;
    type: GovernanceItemKind;
    id: string;
    account?: string | null;
    top?: number;
}): Promise<TallyResponse | null> {
    const query = new URLSearchParams({ component: params.component, type: params.type, id: params.id });
    if (params.account) query.set('account', params.account);
    if (params.top) query.set('top', String(params.top));
    const res = await fetch(`/api/governance-votes?${query.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}
