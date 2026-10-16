import { useQueries } from '@tanstack/react-query';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import type { Network } from '@/features/dashboard/types';
import { canWithdraw } from '../lib/role-lookup';

/**
 * Which of these resources can never leave an account (withdrawer DenyAll),
 * so a list sending them is stopped before the simulation fails on it.
 */
export function useLockedResources(resources: string[], network: Network): Set<string> {
    const unique = [...new Set(resources.filter((r) => r.startsWith('resource_')))];
    const results = useQueries({
        queries: unique.map((address) => ({
            queryKey: ['console-resource-withdrawable', network, address],
            staleTime: 5 * 60_000,
            retry: false,
            queryFn: async () => canWithdraw(await apiFetchEntityDetails(address, network)),
        })),
    });
    return new Set(unique.filter((_, i) => results[i]?.data === false));
}
