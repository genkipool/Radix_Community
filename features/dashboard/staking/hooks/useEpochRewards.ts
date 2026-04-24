'use client';

import { useQuery } from '@tanstack/react-query';

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

    return useQuery({
        queryKey: ['epoch-rewards', network, validatorAddress],
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
