'use client';

import { useQueries } from '@tanstack/react-query';

import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';
import { fetchLockerClaims, parseLockerState } from '../lib/locker-lookup';
import type { GatewayPost } from '../lib/resource-holders';
import { heldBadgeFor } from '../lib/role-lookup';
import { useAccountLockerList } from './useAccountLockerList';
import { useAccountResources } from './useAccountResources';

/** What an account can do with one of the lockers it has dealt with. */
export interface AccountLockerRole {
  address: string;
  name: string;
  /** Something waits there for the account: it can claim. */
  hasClaims: boolean;
  /** The account holds the recoverer badge of a locker that allows recovery. */
  canRecover: boolean;
  /** The account holds the storer badge: it airdrops through this locker. */
  canStore: boolean;
}

/**
 * The lockers an account has dealt with, each with what the account can do
 * there, so every locker tool suggests only its own: the claim tool the
 * lockers keeping something for the account, the recover tool those whose
 * recoverer badge it holds. Having touched a locker once (a claim, a store
 * by someone else) is not enough to be suggested.
 */
export function useAccountLockerRoles(account: string | null | undefined, network: Network) {
  const { data: lockers, isLoading: loadingList } = useAccountLockerList(account, network);
  const { data: holdings, isLoading: loadingHoldings } = useAccountResources(account ?? null);
  const roles = useQueries({
    queries: (lockers ?? []).map((locker) => ({
      queryKey: ['locker-role', network, locker.address, account],
      enabled: !!account,
      staleTime: 30_000,
      retry: false,
      queryFn: async () => {
        const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
        const [details, claims] = await Promise.all([
          post<{ items?: unknown[] }>('/state/entity/details', { addresses: [locker.address] }),
          fetchLockerClaims(post, locker.address, account!).catch(() => []),
        ]);
        return { state: parseLockerState(details.items?.[0]), hasClaims: claims.length > 0 };
      },
    })),
  });

  const data: AccountLockerRole[] | undefined =
    // A locker that could not be read counts as one the account has no part in.
    lockers && holdings && roles.every((r) => !r.isPending)
      ? lockers.map((locker, i) => {
          const { state, hasClaims } = roles[i].data ?? { state: null, hasClaims: false };
          const holds = (rule: NonNullable<typeof state>['storer']) => !!heldBadgeFor(rule, holdings.fungibles, holdings.nonFungibles);
          return {
            ...locker,
            hasClaims,
            canRecover: !!state && state.recoverer.type !== 'denyAll' && holds(state.recoverer),
            canStore: !!state && state.storer.type !== 'allowAll' && holds(state.storer),
          };
        })
      : undefined;

  return { data, isLoading: !!account && (loadingList || loadingHoldings || roles.some((r) => r.isPending)) };
}
