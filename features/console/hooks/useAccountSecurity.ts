'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails, apiFetchNonFungibleLocation } from '@/features/dashboard/services/apiClient';
import { gatewayPost } from '@/services/gateway/bases';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { inspectAddress } from '../lib/address-inspect';
import {
  NotAnAccountError,
  probeAccountSecurity,
  type AccountSecurityReport,
  type SecurityProbe,
} from '../services/accountSecurity';

/** The browser half of the probe: the same reads, through the client fetchers. */
const browserProbe = (network: 'mainnet' | 'stokenet'): SecurityProbe => ({
  entityDetails: (address) => apiFetchEntityDetails(address, network),
  wellKnownAddresses: async () => {
    const data = await gatewayPost<{ well_known_addresses?: Record<string, string> }>(
      network,
      '/status/network-configuration',
      {},
    );
    return data.well_known_addresses ?? {};
  },
  badgeLocation: async (resource, localId) => {
    const located = await apiFetchNonFungibleLocation(resource, [localId], network);
    return located[localId] ?? null;
  },
});

/**
 * Who controls `address`, checked against the ledger.
 *
 * Only runs once the input is a well-formed account address for the active
 * network, so typing does not fire a request per keystroke and a typo never
 * reaches the Gateway.
 */
export function useAccountSecurity(address: string) {
  const { activeNetwork } = useRadixWallet();
  const trimmed = address.trim();
  const inspection = trimmed ? inspectAddress(trimmed) : null;
  const isAccount =
    !!inspection && inspection.checksumValid && inspection.entityType === 'account';
  const networkMatches = inspection?.network === activeNetwork;

  return useQuery<AccountSecurityReport>({
    queryKey: ['console-account-security', activeNetwork, trimmed],
    queryFn: () => probeAccountSecurity(trimmed, browserProbe(activeNetwork)),
    enabled: isAccount && networkMatches,
    staleTime: 30_000,
    retry: (failureCount, error) => !(error instanceof NotAnAccountError) && failureCount < 2,
  });
}

/** Why the check is not running, when it is not. */
export type SecurityInputState = 'empty' | 'malformed' | 'notAccount' | 'wrongNetwork' | 'ready';

export function securityInputState(
  address: string,
  activeNetwork: 'mainnet' | 'stokenet',
): SecurityInputState {
  const trimmed = address.trim();
  if (!trimmed) return 'empty';
  const inspection = inspectAddress(trimmed);
  if (!inspection || !inspection.checksumValid) return 'malformed';
  if (inspection.entityType !== 'account') return 'notAccount';
  if (inspection.network !== activeNetwork) return 'wrongNetwork';
  return 'ready';
}
