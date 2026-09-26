/**
 * Weighted results of Radix governance votes.
 *
 * The ledger stores who voted and what they picked, but not how much each
 * vote weighs: every governance dApp runs a "vote collector" that weighs the
 * votes by the voter's XRD (and staked XRD) and publishes the tallies. The
 * collectors are listed explicitly here, keyed by governance component, so the
 * server never fetches a URL taken from user input or ledger metadata.
 * Supporting a new governance dApp only needs one more entry.
 */

export const VOTE_COLLECTORS: Readonly<Record<string, string>> = {
    // Radix DAO (vote.radixdao.org)
    component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k: 'https://vote.radixdao.org',
    // Radix Consultation V2 (consultation.mountain-top.live)
    component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt: 'https://api-consultation.mountain-top.live',
};

export type CollectorItemType = 'proposal' | 'temperature_check';

export interface VoteTally {
    /** Voting power per choice: an option id ("0") or a stance ("For"). */
    results: Array<{ vote: string; votePower: string }>;
    /** Voting power of the requested account, when it voted. */
    accountPower: string | null;
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
    return Object.hasOwn(VOTE_COLLECTORS, component) ? VOTE_COLLECTORS[component] : null;
}

export async function fetchVoteTally(
    component: string,
    type: CollectorItemType,
    entityId: string,
    account: string | null,
): Promise<VoteTally | null> {
    const base = collectorFor(component);
    if (!base) return null;
    const query = `type=${type}&entityId=${encodeURIComponent(entityId)}`;

    const [tally, accounts] = await Promise.all([
        getJson<{ results?: Array<{ vote?: unknown; votePower?: unknown }> }>(`${base}/vote-results?${query}`),
        account
            ? getJson<Array<{ accountAddress?: unknown; votePower?: unknown }>>(`${base}/account-votes?${query}`).catch(() => [])
            : Promise.resolve([]),
    ]);

    const own = Array.isArray(accounts) ? accounts.find(a => a.accountAddress === account) : undefined;
    return {
        results: (tally.results ?? [])
            .filter(r => typeof r.vote === 'string' && typeof r.votePower === 'string')
            .map(r => ({ vote: r.vote as string, votePower: r.votePower as string })),
        accountPower: typeof own?.votePower === 'string' ? own.votePower : null,
        source: new URL(base).hostname,
    };
}
