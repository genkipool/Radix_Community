'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { subscribeToLiveData, getLiveSnapshot } from '@/services/liveDataStore';

/**
 * useEpochRewards
 *
 * Fetches per-epoch XRD rewards for a specific validator.
 * Uses React Query for automatic caching and localStorage for instant hydration.
 *
 * @param validatorAddress - The address of the validator to fetch rewards for.
 * @param network - The network name (mainnet/stokenet).
 */
export function useEpochRewards(validatorAddress: string | undefined, network = 'mainnet') {
    const cacheKey = `epoch-rewards-${network}-${validatorAddress}`;

    // The live epoch is part of the key on purpose. When an epoch closes, its
    // rewards become available and the row that just moved down the table needs
    // them; with a five-minute staleTime and no window-focus refetch, that row
    // sat empty until the query happened to go stale. A new epoch changes the
    // key, which refetches, while `placeholderData` below keeps the previous
    // values on screen so nothing blanks out meanwhile.
    const { currentEpoch } = useSyncExternalStore(
        subscribeToLiveData,
        getLiveSnapshot,
        getLiveSnapshot,
    );

    return useQuery({
        queryKey: ['epoch-rewards', network, validatorAddress, currentEpoch],
        queryFn: async () => {
            if (!validatorAddress) return {};

            const res = await fetch(`/api/validator-rewards?address=${encodeURIComponent(validatorAddress)}&action=epochs`);
            if (!res.ok) return {};

            const data = await res.json();
            if (!data?.rewards) return {};

            // Convert string keys to numbers accurately
            const parsed: Record<number, { fee: number; pool: number }> = {};
            for (const [k, v] of Object.entries(data.rewards)) {
                parsed[parseInt(k, 10)] = v as { fee: number; pool: number };
            }

            // Persistence for maximal hydration (instant display on next mount)
            if (typeof window !== 'undefined') {
                localStorage.setItem(cacheKey, JSON.stringify(parsed));
            }

            return parsed;
        },
        enabled: !!validatorAddress,
        staleTime: 5 * 60_000, // 5 minutes cache (aligns with server)
        refetchOnWindowFocus: false,
        // Refetching on the epoch change is not enough on its own: the rewards
        // for an epoch only exist once the sync job has written them, which
        // happens some moments after it closes. So while the freshly finished
        // epoch is still missing, retry every minute — and stop as soon as it
        // arrives, so this never becomes a background poller.
        refetchInterval: (query) => {
            const data = query.state.data as Record<number, unknown> | undefined;
            if (!currentEpoch || !data) return false;
            return data[currentEpoch - 1] === undefined ? 60_000 : false;
        },
        placeholderData: (previousData) => {
            if (previousData) return previousData;
            // Try to recover from localStorage for instant "hydration" UI
            if (typeof window === 'undefined') return undefined;
            const stored = localStorage.getItem(cacheKey);
            if (!stored) return undefined;
            try {
                return JSON.parse(stored);
            } catch {
                return undefined;
            }
        },
    });
}
