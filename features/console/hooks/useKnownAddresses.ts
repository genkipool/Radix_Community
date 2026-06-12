'use client';

import { useQuery } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { Network } from '@/services/gateway/client';

const GATEWAY_BASES: Record<Network, string> = {
  mainnet: 'https://mainnet.radixdlt.com',
  stokenet: 'https://gateway-stokenet.radix.community',
};

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
      const res = await fetch(`${GATEWAY_BASES[activeNetwork]}/status/network-configuration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error(`Gateway ${res.status}`);
      const data = (await res.json()) as { well_known_addresses?: KnownAddresses };
      return data.well_known_addresses ?? {};
    },
    staleTime: Infinity,
  });
}
