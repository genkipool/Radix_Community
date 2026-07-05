'use client';

import { useQuery } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';

export type KnownAddresses = Record<string, string>;

/**
 * Well-known addresses of the active network (XRD, native packages, faucet,
 * pool package, system badges, …) from `/status/network-configuration`.
 */
export function useKnownAddresses() {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['console-known-addresses', activeNetwork],
    queryFn: async (): Promise<KnownAddresses> => {
      const data = await gatewayPost<{ well_known_addresses?: KnownAddresses }>(
        activeNetwork,
        '/status/network-configuration',
        {},
      );
      return data.well_known_addresses ?? {};
    },
    staleTime: Infinity,
  });
}
