import { useQuery } from '@tanstack/react-query';

import { fetchLockerActivity } from '@/features/console/lib/locker-lookup';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';

/** Transactions read to add up a locker's contents and recipients (pages of 100). */
export const LOCKER_HISTORY_PAGES = 5;

/**
 * What a locker holds and has done, from its history: contents, recipients,
 * deposits, claims and recoveries. One read per locker, shared by the
 * console's locker info, its recovery and the explorer's locker card.
 */
export function useLockerActivity(locker: string | null | undefined, network: Network, enabled = true) {
    return useQuery({
        queryKey: ['locker-activity', network, locker],
        enabled: !!locker && enabled,
        staleTime: 60_000,
        retry: false,
        queryFn: () => {
            const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
            return fetchLockerActivity(post, locker!, LOCKER_HISTORY_PAGES);
        },
    });
}
