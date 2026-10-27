'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { mapHoldings } from '../lib/account-holdings';
import { browserCopyOptions, writeBrowserCopy } from '../lib/browser-copy';
import type { AccountHoldings } from '../types/console.types';

/**
 * Loads the fungible and non-fungible holdings of one or more accounts, with metadata,
 * from the Radix Gateway. Used by the console tools to offer resource pickers.
 * The last answer is kept in the browser and shown at once on the next visit,
 * then replaced by the live one (see `browser-copy`).
 */
export function useAccountResources(accountAddresses: string[] | string | null) {
  const { activeNetwork } = useRadixWallet();

  const addresses = Array.isArray(accountAddresses) ? accountAddresses : (accountAddresses ? [accountAddresses] : []);

  const queryKey = ['console-account-resources', activeNetwork, addresses.join(',')];
  return useQuery({
    queryKey,
    ...browserCopyOptions<AccountHoldings>(queryKey),
    queryFn: async () => {
      const mergedHoldings: AccountHoldings = { fungibles: [], nonFungibles: [] };
      if (addresses.length === 0) return mergedHoldings;

      const promises = addresses.map(addr => apiFetchEntityDetails(addr, activeNetwork));
      const results = await Promise.all(promises);

      for (const details of results) {
        const holdings = mapHoldings(details as unknown as Record<string, unknown>);
        
        // Merge fungibles
        for (const f of holdings.fungibles) {
          const existing = mergedHoldings.fungibles.find(e => e.resourceAddress === f.resourceAddress);
          if (existing) {
            existing.amount = String(Number(existing.amount) + Number(f.amount));
          } else {
            mergedHoldings.fungibles.push(f);
          }
        }

        // Merge nonFungibles
        for (const nf of holdings.nonFungibles) {
          const existing = mergedHoldings.nonFungibles.find(e => e.resourceAddress === nf.resourceAddress);
          if (existing) {
            existing.ids = Array.from(new Set([...existing.ids, ...nf.ids]));
          } else {
            mergedHoldings.nonFungibles.push(nf);
          }
        }
      }

      writeBrowserCopy(queryKey, mergedHoldings);
      return mergedHoldings;
    },
    enabled: addresses.length > 0,
    staleTime: 30_000,
  });
}
