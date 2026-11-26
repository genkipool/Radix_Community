import 'server-only';
import { systemByComponent } from '../config/systems';
import type { MajorityJudgmentCandidateResult, MajorityJudgmentElectionData, MajorityJudgmentTcResult } from '../types';

/**
 * Weighted results of Radix governance votes.
 *
 * The ledger stores who voted and what they picked, but not how much each
 * vote weighs: every governance system runs a "vote collector" that weighs
 * the votes by voting power at the snapshot and publishes the tallies. Only
 * the collectors listed in GOVERNANCE_SYSTEMS are ever queried.
 */

export type CollectorItemType = 'proposal' | 'temperature_check' | 'election';

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
    /** Full Majority Judgment election payload when `type === 'election'`. */
    electionData?: MajorityJudgmentElectionData | null;
}

const TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 30_000;

const inFlight = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();

async function getJson<T>(url: string): Promise<T> {
    const useCache = !process.env.VITEST;
    if (useCache) {
        const cached = responseCache.get(url);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data as T;
        }
    }

    const existing = inFlight.get(url);
    if (existing) return existing as Promise<T>;

    const request = (async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 60 } });
        if (!res.ok) throw new Error(`Vote collector ${res.status}`);
        const data = (await res.json()) as T;
        if (useCache) {
            responseCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        }
        return data;
    })().finally(() => {
        inFlight.delete(url);
    });

    inFlight.set(url, request);
    return request;
}

export function collectorFor(component: string): string | null {
    return systemByComponent(component)?.collector ?? null;
}

const POWER_CONCURRENCY = 6;

/**
 * Queries `/voting-power?accountAddress=…` for a list of accounts (used for
 * Majority Judgment elections, whose `/account-votes` endpoint is not exposed).
 */
export async function fetchAccountVotingPowers(component: string, accounts: string[]): Promise<Map<string, string>> {
    const base = collectorFor(component);
    const out = new Map<string, string>();
    if (!base || accounts.length === 0) return out;
    const unique = [...new Set(accounts)];
    for (let i = 0; i < unique.length; i += POWER_CONCURRENCY) {
        const batch = unique.slice(i, i + POWER_CONCURRENCY);
        const settled = await Promise.all(
            batch.map(async acc => {
                try {
                    const data = await getJson<{ votePower?: unknown }>(
                        `${base}/voting-power?accountAddress=${encodeURIComponent(acc)}`,
                    );
                    return typeof data.votePower === 'string' ? ([acc, data.votePower] as const) : null;
                } catch {
                    return null;
                }
            }),
        );
        for (const pair of settled) {
            if (pair) out.set(pair[0], pair[1]);
        }
    }
    return out;
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

    if (type === 'election') {
        const data = await getJson<{
            election?: {
                reserveListDays?: unknown;
                parameterSetId?: unknown;
                parameterSetVersion?: unknown;
                tcVotingStart?: unknown;
                tcVotingEnd?: unknown;
            };
            temperatureCheckResult?: MajorityJudgmentTcResult | null;
            result?: {
                status?: unknown;
                round?: unknown;
                provisional?: unknown;
                totalVotingPower?: unknown;
                quorumXrd?: unknown;
                quorumMet?: unknown;
                minimumMedianGrade?: unknown;
                gradeQuantileApplied?: unknown;
                candidateResults?: MajorityJudgmentCandidateResult[];
            } | null;
            results?: Array<{
                status?: unknown;
                round?: unknown;
                provisional?: unknown;
                totalVotingPower?: unknown;
                quorumXrd?: unknown;
                quorumMet?: unknown;
                minimumMedianGrade?: unknown;
                gradeQuantileApplied?: unknown;
                candidateResults?: MajorityJudgmentCandidateResult[];
            }>;
        }>(`${base}/majority-judgment-election?electionId=${encodeURIComponent(entityId)}`);
        const latest = data.result ?? data.results?.[data.results.length - 1] ?? null;
        const totalPower = typeof latest?.totalVotingPower === 'string' ? latest.totalVotingPower : null;
        const electionData: MajorityJudgmentElectionData | null = latest ? {
            status: typeof latest.status === 'string' ? latest.status : 'LIVE',
            round: latest.round === 'Rerun' ? 'Rerun' : 'RoundOne',
            provisional: Boolean(latest.provisional),
            totalVotingPower: totalPower ?? '0',
            quorumXrd: typeof latest.quorumXrd === 'string' ? latest.quorumXrd : '0',
            quorumMet: Boolean(latest.quorumMet),
            minimumMedianGrade: typeof latest.minimumMedianGrade === 'number' ? latest.minimumMedianGrade : 2,
            gradeQuantileApplied: typeof latest.gradeQuantileApplied === 'string' ? latest.gradeQuantileApplied : '3/5',
            reserveListDays: typeof data.election?.reserveListDays === 'number' ? data.election.reserveListDays : null,
            parameterSetId: typeof data.election?.parameterSetId === 'string' ? data.election.parameterSetId : null,
            parameterSetVersion: typeof data.election?.parameterSetVersion === 'number' ? data.election.parameterSetVersion : null,
            tcVotingStart: typeof data.election?.tcVotingStart === 'string' ? data.election.tcVotingStart : null,
            tcVotingEnd: typeof data.election?.tcVotingEnd === 'string' ? data.election.tcVotingEnd : null,
            temperatureCheckResult: data.temperatureCheckResult ?? null,
            candidateResults: Array.isArray(latest.candidateResults) ? latest.candidateResults : [],
        } : null;
        return {
            results: totalPower ? [{ vote: 'turnout', votePower: totalPower }] : [],
            accountPower: null,
            accountVotes: null,
            source: new URL(base).hostname,
            electionData,
        };
    }

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
