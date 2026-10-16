import { useQuery } from '@tanstack/react-query';

import { fetchLockerClaims, type LockerClaim } from '@/features/console/lib/locker-lookup';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';

/** Recipients whose pending claims are looked up (one Gateway request each). */
export const MAX_LOCKER_RECIPIENTS = 25;

/**
 * What still waits in a locker for each of the given recipients (the first
 * MAX_LOCKER_RECIPIENTS of them). Shared by the console's locker info and the
 * explorer's locker details.
 */
export function useLockerWaiting(locker: string, recipients: string[], network: Network) {
    const read = recipients.slice(0, MAX_LOCKER_RECIPIENTS);
    return useQuery({
        queryKey: ['locker-waiting', network, locker, read.join(',')],
        enabled: read.length > 0,
        staleTime: 60_000,
        retry: false,
        queryFn: async (): Promise<Record<string, LockerClaim[]>> => {
            const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
            const claims = await Promise.all(read.map((account) => fetchLockerClaims(post, locker, account).catch(() => [])));
            return Object.fromEntries(read.map((account, i) => [account, claims[i]]));
        },
    });
}
