'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { Network } from '@/services/gateway/client';
import { gatewayPost } from '@/services/gateway/bases';
import { fetchDepositSettings } from '../lib/account-deposits';
import type { GatewayPost } from '../lib/resource-holders';

export const DEPOSIT_SETTINGS_KEY = 'deposit-settings';

/**
 * An account's deposit rules, shared by the console's "Account deposits" tool
 * and the explorer's account card (one cache entry per account).
 * `keepPrevious` keeps the last account's rules on screen while the next
 * one's load, so switching accounts does not make the page jump.
 */
export function useDepositSettings(account: string | null | undefined, network: Network, { keepPrevious = false } = {}) {
  return useQuery({
    queryKey: [DEPOSIT_SETTINGS_KEY, network, account],
    enabled: !!account,
    staleTime: 15_000,
    retry: false,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    queryFn: () => {
      const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
      return fetchDepositSettings(post, account!);
    },
  });
}
