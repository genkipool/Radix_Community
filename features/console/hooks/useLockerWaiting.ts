import { useQuery } from '@tanstack/react-query';

import { fetchWaitingFor, type LockerClaim } from '@/features/console/lib/locker-lookup';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';

/** Recipients whose pending claims are looked up (one Gateway request each). */
export const MAX_LOCKER_RECIPIENTS = 25;

/**
 * What still waits in a locker for each of the given recipients (the first
 * `limit` of them; every one for a recovery). Shared by the console's locker
 * info, its recovery and the explorer's locker details.
 */
export function useLockerWaiting(locker: string, recipients: string[], network: Network, limit = MAX_LOCKER_RECIPIENTS) {
    const read = recipients.slice(0, limit);
    return useQuery({
        queryKey: ['locker-waiting', network, locker, read.join(',')],
        enabled: read.length > 0,
        staleTime: 60_000,
        retry: false,
        queryFn: (): Promise<Record<string, LockerClaim[]>> => {
            const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
            return fetchWaitingFor(post, locker, read);
        },
    });
}
