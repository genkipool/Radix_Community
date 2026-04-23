'use client';

import { useState, useEffect } from 'react';

/**
 * Fetches per-epoch XRD rewards for a specific validator from the API.
 * Returns a map of epoch number → fee and pool rewards.
 */
export function useEpochRewards(validatorAddress: string | undefined) {
    const [rewards, setRewards] = useState<Record<number, { fee: number; pool: number }>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!validatorAddress) return;

        let cancelled = false;
        setLoading(true);

        fetch(`/api/validator-rewards?address=${encodeURIComponent(validatorAddress)}&action=epochs`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled && data?.rewards) {
                    // Convert string keys to numbers
                    const parsed: Record<number, { fee: number; pool: number }> = {};
                    for (const [k, v] of Object.entries(data.rewards)) {
                        parsed[parseInt(k, 10)] = v as { fee: number; pool: number };
                    }
                    setRewards(parsed);
                }
            })
            .catch(() => {
                // Silently fail — rewards column just stays empty
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [validatorAddress]);

    return { rewards, loading };
}
