import { useQuery } from '@tanstack/react-query';

import { fetchPoolContributions } from '@/features/console/lib/pool-history';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';

/** Transactions read to add up what participants put in and took out (pages of 100). */
export const POOL_HISTORY_PAGES = 5;

/**
 * What every participant of a pool has put in and taken out, from the pool's
 * history. One read per pool, shared by the pool card's participants and an
 * account's pool position.
 */
export function usePoolContributions(
    pool: { address: string; poolUnit: string; resources: string[] } | null | undefined,
    network: Network,
) {
    return useQuery({
        queryKey: ['explorer-pool-contributions', network, pool?.address],
        enabled: !!pool,
        staleTime: 60_000,
        retry: false,
        queryFn: () => {
            const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
            return fetchPoolContributions(post, pool!, POOL_HISTORY_PAGES);
        },
    });
}
