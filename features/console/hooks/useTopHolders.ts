import { useQuery } from '@tanstack/react-query';

import { fetchAllHolders, type GatewayPost } from '@/features/console/lib/resource-holders';
import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';

/** Holders read at most (one Gateway page): enough for any "largest holders" view. */
export const TOP_HOLDERS = 100;

/**
 * The largest holders of a resource, largest first, with the total count: a
 * pool's participants (its pool unit) or a validator's stakers (its LSU).
 * One read per resource, shared by the console and the explorer.
 */
export function useTopHolders(resource: string | null | undefined, network: Network) {
    return useQuery({
        queryKey: ['top-holders', network, resource, TOP_HOLDERS],
        enabled: !!resource,
        staleTime: 60_000,
        retry: false,
        queryFn: () => {
            const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
            return fetchAllHolders(post, resource!, { max: TOP_HOLDERS });
        },
    });
}
