'use client';

import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { Network } from '@/features/dashboard/types';
import { apiFetchAgeYears, AGE_BATCH } from '../services/governanceApi';

/** Batches asked at the same time. */
const PARALLEL = 2;

export interface AccountAgesState {
    /** Full years on the ledger when the vote opened; missing when unknown. */
    years: Map<string, number>;
    /** Accounts answered so far, out of `total`. */
    loaded: number;
    total: number;
    done: boolean;
}

/**
 * How many full years each voter's account had been on the ledger when the
 * vote opened, asked in batches so progress shows as they arrive. Only a few
 * batches run at a time so the Gateway's rate limit is not hit, and a failed
 * batch is asked again rather than leaving accounts without an age. A past
 * state never changes, so answers are kept for the whole session.
 */
export function useAccountAges(accounts: string[], network: Network, atSec: number, enabled = true): AccountAgesState {
    const sorted = [...new Set(accounts)].sort();
    const batches: string[][] = [];
    for (let i = 0; i < sorted.length; i += AGE_BATCH) batches.push(sorted.slice(i, i + AGE_BATCH));
    const key = (batch: string[]) => ['governance-account-ages', network, atSec, batch] as const;

    const client = useQueryClient();
    const settled = batches.map(batch => {
        const status = client.getQueryState(key(batch))?.status;
        return status === 'success' || status === 'error';
    });
    const settledBefore = (i: number) => settled.slice(0, i).filter(Boolean).length;

    const results = useQueries({
        queries: batches.map((batch, i) => ({
            queryKey: key(batch),
            queryFn: () => apiFetchAgeYears(network, atSec, batch),
            // A sliding window: batch i starts once all but PARALLEL of the earlier ones are settled.
            enabled: enabled && i < PARALLEL + settledBefore(i),
            staleTime: Infinity,
            gcTime: Infinity,
            retry: 5,
            retryDelay: (attempt: number) => Math.min(20_000, 2_000 * 2 ** attempt),
        })),
    });

    const years = new Map<string, number>();
    let loaded = 0;
    results.forEach((r, i) => {
        if (!r.data && !r.isError) return;
        loaded += batches[i].length;
        for (const account of batches[i]) {
            const y = r.data?.[account];
            if (typeof y === 'number') years.set(account, y);
        }
    });
    return { years, loaded, total: sorted.length, done: loaded >= sorted.length };
}
