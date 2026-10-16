import { useQuery } from '@tanstack/react-query';

import { findLedgerEntities } from '@/features/console/lib/ledger-entities';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';

/** Pages of the account's history searched for lockers (100 transactions each). */
const HISTORY_PAGES = 3;

/**
 * The Account Lockers an account has dealt with: those that stored something
 * for it (a store names the recipients among the affected entities) and those
 * it created or used. The Gateway cannot list them otherwise, so they come from
 * the account's recent transactions. Shared by the console's locker pickers and
 * the explorer's account card.
 */
export function useAccountLockerList(account: string | null | undefined, network: Network) {
    return useQuery({
        queryKey: ['account-lockers', network, account],
        enabled: !!account,
        staleTime: 60_000,
        retry: false,
        queryFn: async () => {
            const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
            const found = await findLedgerEntities(post, { accounts: [account!], kinds: ['locker'], accountPages: HISTORY_PAGES });
            return found.filter((entity) => entity.mine).map(({ address, name }) => ({ address, name }));
        },
    });
}
