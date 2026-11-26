'use client';

import { useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Network } from '@/features/dashboard/types';
import type { VoterRow } from '../types';
import type { MethodVoter } from '../lib/votingMethods';
import { apiFetchAccountHistory, AGE_BATCH } from '../services/governanceApi';

/** Batches asked at the same time. */
const PARALLEL = 2;

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

/**
 * Historical ledger metrics for each voter when the vote opened (account age,
 * staked XRD, 90-day TWAB and minimum 90-day held balance), asked in batches so
 * progress shows as they arrive. Past states never change, so answers are kept
 * for the whole session.
 */
export function useAccountAges(accounts: string[], network: Network, atSec: number, enabled = true): AccountAgesState {
    const sorted = [...new Set(accounts)].sort();
    const batches: string[][] = [];
    for (let i = 0; i < sorted.length; i += AGE_BATCH) batches.push(sorted.slice(i, i + AGE_BATCH));
    const key = (batch: string[]) => ['governance-account-history', network, atSec, batch] as const;

    const client = useQueryClient();
    const batchKeys = batches.map(key);
    const canRun = slidingWindowEnabled(client, batchKeys, PARALLEL);

    const results = useQueries({
        queries: batches.map((batch, i) => ({
            queryKey: batchKeys[i],
            queryFn: () => apiFetchAccountHistory(network, atSec, batch),
            enabled: enabled && canRun(i),
            staleTime: Infinity,
            gcTime: Infinity,
            retry: 5,
            retryDelay: (attempt: number) => Math.min(20_000, 2_000 * 2 ** attempt),
        })),
    });

    const years = new Map<string, number>();
    const stakedXrd = new Map<string, number>();
    const twab90Xrd = new Map<string, number>();
    const min90Xrd = new Map<string, number>();
    let loaded = 0;
    results.forEach((r, i) => {
        if (!r.data && !r.isError) return;
        loaded += batches[i].length;
        for (const account of batches[i]) {
            const y = r.data?.years?.[account];
            if (typeof y === 'number') years.set(account, y);
            const s = r.data?.stakedXrd?.[account];
            if (typeof s === 'number') stakedXrd.set(account, s);
            const t = r.data?.twab90Xrd?.[account];
            if (typeof t === 'number') twab90Xrd.set(account, t);
            const m = r.data?.min90Xrd?.[account];
            if (typeof m === 'number') min90Xrd.set(account, m);
        }
    });
    return { years, stakedXrd, twab90Xrd, min90Xrd, loaded, total: sorted.length, done: loaded >= sorted.length };
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
