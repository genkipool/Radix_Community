'use client';

import { useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Network } from '@/features/dashboard/types';
import type { VoterRow } from '../types';
import type { MethodVoter } from '../lib/votingMethods';
import { apiFetchAccountHistory, AGE_BATCH } from '../services/governanceApi';

/** Batches asked at the same time. */
const PARALLEL = 3;

/**
 * Sliding-window concurrency helper for `useQueries`: item `i` is enabled once
 * enough earlier queries have settled so at most `parallel` run concurrently.
 */
export function slidingWindowEnabled(
    client: QueryClient,
    keys: ReadonlyArray<readonly unknown[]>,
    parallel: number,
): (index: number) => boolean {
    const settled = keys.map(k => {
        const status = client.getQueryState(k)?.status;
        return status === 'success' || status === 'error';
    });
    return (i: number) => i < parallel + settled.slice(0, i).filter(Boolean).length;
}

export interface AccountAgesState {
    /** Full years on the ledger when the vote opened; missing when unknown. */
    years: Map<string, number>;
    /** XRD staked in validators when the vote opened; missing when unknown. */
    stakedXrd: Map<string, number>;
    /** 90-day time-weighted average XRD (liquid + staked); missing when unknown. */
    twab90Xrd: Map<string, number>;
    /** Minimum XRD (liquid + staked) held across the 90-day checkpoints; missing when unknown. */
    min90Xrd: Map<string, number>;
    /** Accounts answered so far, out of `total`. */
    loaded: number;
    total: number;
    done: boolean;
}

export interface AccountAgesByVoteState {
    /** Ledger metrics of each group, measured at that group's own date. */
    byGroup: AccountAgesState[];
    /** Batched accounts answered so far, out of `total`, across every group. */
    loaded: number;
    total: number;
    done: boolean;
    /** Distinct accounts with any ledger figure (age, stake, TWAB, 90-day minimum) unread in at least one group (only once done). */
    unknown: number;
}

/**
 * Historical ledger metrics for several votes at once, each measured when its
 * own vote opened (account age, staked XRD, 90-day TWAB and minimum 90-day
 * held balance). Batches use the same query key as the single-vote tab, so a
 * vote opened there is not asked again. Past states never change, so answers
 * are kept for the whole session.
 */
export function useAccountAgesByVote(
    groups: ReadonlyArray<{ accounts: string[]; atSec: number }>,
    network: Network,
    enabled = true,
): AccountAgesByVoteState {
    const key = (atSec: number, batch: string[]) => ['governance-account-history', network, atSec, batch] as const;
    // Cheap identity for a batch: accounts are sorted and unique, so date + first + last + size is enough.
    const id = (atSec: number, batch: string[]) => `${atSec}|${batch[0]}|${batch[batch.length - 1]}|${batch.length}`;
    const groupBatches = groups.map(g => {
        const sorted = [...new Set(g.accounts)].sort();
        const batches: string[][] = [];
        for (let i = 0; i < sorted.length; i += AGE_BATCH) batches.push(sorted.slice(i, i + AGE_BATCH));
        return { atSec: g.atSec, sorted, batches };
    });
    // One query per distinct (date, batch): two votes opened at the same second share answers.
    const unique = new Map<string, { atSec: number; batch: string[] }>();
    for (const g of groupBatches) {
        for (const batch of g.batches) unique.set(id(g.atSec, batch), { atSec: g.atSec, batch });
    }
    const uniqueList = [...unique.values()];
    const batchKeys = uniqueList.map(u => key(u.atSec, u.batch));

    const client = useQueryClient();
    const canRun = slidingWindowEnabled(client, batchKeys, PARALLEL);

    const results = useQueries({
        queries: uniqueList.map((u, i) => ({
            queryKey: batchKeys[i],
            queryFn: () => apiFetchAccountHistory(network, u.atSec, u.batch),
            enabled: enabled && canRun(i),
            staleTime: Infinity,
            gcTime: Infinity,
            retry: 5,
            retryDelay: (attempt: number) => Math.min(20_000, 2_000 * 2 ** attempt),
        })),
    });
    const resultByKey = new Map(uniqueList.map((u, i) => [id(u.atSec, u.batch), results[i]] as const));

    let loaded = 0;
    let total = 0;
    uniqueList.forEach((u, i) => {
        total += u.batch.length;
        if (results[i].data || results[i].isError) loaded += u.batch.length;
    });
    const done = loaded >= total;

    const unknownAccounts = new Set<string>();
    const byGroup = groupBatches.map(g => {
        const years = new Map<string, number>();
        const stakedXrd = new Map<string, number>();
        const twab90Xrd = new Map<string, number>();
        const min90Xrd = new Map<string, number>();
        let groupLoaded = 0;
        for (const batch of g.batches) {
            const r = resultByKey.get(id(g.atSec, batch));
            if (!r || (!r.data && !r.isError)) continue;
            groupLoaded += batch.length;
            for (const account of batch) {
                const y = r.data?.years?.[account];
                if (typeof y === 'number') years.set(account, y);
                const st = r.data?.stakedXrd?.[account];
                if (typeof st === 'number') stakedXrd.set(account, st);
                const t = r.data?.twab90Xrd?.[account];
                if (typeof t === 'number') twab90Xrd.set(account, t);
                const m = r.data?.min90Xrd?.[account];
                if (typeof m === 'number') min90Xrd.set(account, m);
                // Any missing figure leaves the account out of some rule: report it.
                if (done && [y, st, t, m].some(x => typeof x !== 'number')) unknownAccounts.add(account);
            }
        }
        return {
            years, stakedXrd, twab90Xrd, min90Xrd,
            loaded: groupLoaded, total: g.sorted.length, done: groupLoaded >= g.sorted.length,
        };
    });
    return { byGroup, loaded, total, done, unknown: unknownAccounts.size };
}

/** Ledger metrics of one vote's voters when it opened (see `useAccountAgesByVote`). */
export function useAccountAges(accounts: string[], network: Network, atSec: number, enabled = true): AccountAgesState {
    const state = useAccountAgesByVote([{ accounts, atSec }], network, enabled);
    return state.byGroup[0];
}

/** Converts weighed tally voter rows + loaded ledger history into `MethodVoter[]`. */
export function toMethodVoters(rows: VoterRow[], ages: AccountAgesState): MethodVoter[] {
    return rows.map(v => ({
        account: v.account,
        choices: v.choices,
        power: Number(v.votePower),
        ageDays: ages.years.has(v.account) ? (ages.years.get(v.account) as number) * 365 : null,
        stakedXrd: ages.stakedXrd.has(v.account) ? (ages.stakedXrd.get(v.account) as number) : null,
        twab90Xrd: ages.twab90Xrd.has(v.account) ? (ages.twab90Xrd.get(v.account) as number) : null,
        min90Xrd: ages.min90Xrd.has(v.account) ? (ages.min90Xrd.get(v.account) as number) : null,
        ...(v.grades ? { grades: v.grades } : {}),
    }));
}
