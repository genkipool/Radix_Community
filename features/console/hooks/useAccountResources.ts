'use client';

import Big from 'big.js';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { CARD_ENTITY_OPT_INS, gatewayPost } from '@/services/gateway/bases';
import { mapHoldings, type GatewayResourceItem } from '../lib/account-holdings';
import { browserCopyOptions, writeBrowserCopy } from '../lib/browser-copy';
import type { AccountHoldings } from '../types/console.types';

async function fetchFullAccountDetails(
  address: string,
  network: 'mainnet' | 'stokenet',
): Promise<Record<string, unknown>> {
  const details = (await apiFetchEntityDetails(address, network)) as unknown as Record<string, unknown>;
  const stateVersion = (details.ledger_state as { state_version?: number } | undefined)?.state_version;
  const atLedgerState = stateVersion ? { at_ledger_state: { state_version: stateVersion } } : {};

  const fungibleSection = details.fungible_resources as
    | { items?: GatewayResourceItem[]; next_cursor?: string | null }
    | undefined;
  let fCursor = fungibleSection?.next_cursor ?? null;
  const allFungibles: GatewayResourceItem[] = [...(fungibleSection?.items ?? [])];
  let fPages = 0;
  while (fCursor && fPages < 15) {
    fPages++;
    const page = await gatewayPost<{ items?: GatewayResourceItem[]; next_cursor?: string | null }>(
      network,
      '/state/entity/page/fungibles/',
      {
        address,
        aggregation_level: 'Vault',
        cursor: fCursor,
        opt_ins: { explicit_metadata: CARD_ENTITY_OPT_INS.explicit_metadata },
        ...atLedgerState,
      },
    ).catch(() => null);
    if (!page?.items?.length) break;
    allFungibles.push(...page.items);
    fCursor = page.next_cursor ?? null;
  }

  const nonFungibleSection = details.non_fungible_resources as
    | { items?: GatewayResourceItem[]; next_cursor?: string | null }
    | undefined;
  let nfCursor = nonFungibleSection?.next_cursor ?? null;
  const allNonFungibles: GatewayResourceItem[] = [...(nonFungibleSection?.items ?? [])];
  let nfPages = 0;
  while (nfCursor && nfPages < 15) {
    nfPages++;
    const page = await gatewayPost<{ items?: GatewayResourceItem[]; next_cursor?: string | null }>(
      network,
      '/state/entity/page/non-fungibles/',
      {
        address,
        aggregation_level: 'Vault',
        cursor: nfCursor,
        opt_ins: {
          explicit_metadata: CARD_ENTITY_OPT_INS.explicit_metadata,
          non_fungible_include_nfids: true,
        },
        ...atLedgerState,
      },
    ).catch(() => null);
    if (!page?.items?.length) break;
    allNonFungibles.push(...page.items);
    nfCursor = page.next_cursor ?? null;
  }

  return {
    ...details,
    fungible_resources: { ...fungibleSection, items: allFungibles },
    non_fungible_resources: { ...nonFungibleSection, items: allNonFungibles },
  };
}

/**
 * Loads the fungible and non-fungible holdings of one or more accounts, with metadata,
 * from the Radix Gateway (following pagination across all vault pages).
 * Used by the console tools to offer resource pickers.
 */
export function useAccountResources(accountAddresses: string[] | string | null) {
  const { activeNetwork } = useRadixWallet();

  const addresses = Array.isArray(accountAddresses) ? accountAddresses : (accountAddresses ? [accountAddresses] : []);

  const queryKey = ['console-account-resources', 'v4', activeNetwork, addresses.join(',')];
  return useQuery({
    queryKey,
    ...browserCopyOptions<AccountHoldings>(queryKey),
    queryFn: async () => {
      const mergedHoldings: AccountHoldings = { fungibles: [], nonFungibles: [], byAccount: {} };
      if (addresses.length === 0) return mergedHoldings;

      const results = await Promise.all(addresses.map((addr) => fetchFullAccountDetails(addr, activeNetwork)));

      for (let idx = 0; idx < results.length; idx++) {
        const details = results[idx];
        const accountAddr = addresses[idx];
        const holdings = mapHoldings(details);
        mergedHoldings.byAccount![accountAddr] = holdings;

        // Merge fungibles (skip historical empty vaults with 0 balance)
        for (const f of holdings.fungibles) {
          let amt: Big;
          try {
            amt = new Big(f.amount);
          } catch {
            continue;
          }
          if (amt.lte(0)) continue;
          const existing = mergedHoldings.fungibles.find((e) => e.resourceAddress === f.resourceAddress);
          if (existing) {
            try {
              existing.amount = new Big(existing.amount).plus(amt).toFixed();
            } catch {
              existing.amount = f.amount;
            }
          } else {
            mergedHoldings.fungibles.push({ ...f });
          }
        }

        // Merge nonFungibles (skip empty vaults with 0 held IDs)
        for (const nf of holdings.nonFungibles) {
          if (nf.ids.length === 0) continue;
          const existing = mergedHoldings.nonFungibles.find((e) => e.resourceAddress === nf.resourceAddress);
          if (existing) {
            existing.ids = Array.from(new Set([...existing.ids, ...nf.ids]));
          } else {
            mergedHoldings.nonFungibles.push({ ...nf, ids: [...nf.ids] });
          }
        }
      }

      // Populate missing NFT collection iconUrl from the first held NFT's key_image_url / image_url
      const missingIconNfts = mergedHoldings.nonFungibles.filter((nf) => !nf.iconUrl && nf.ids.length > 0);
      if (missingIconNfts.length > 0) {
        await Promise.all(
          missingIconNfts.map(async (nf) => {
            try {
              const dataRes = await gatewayPost<{
                non_fungible_ids?: Array<{
                  data?: {
                    programmatic_json?: {
                      fields?: Array<{ field_name?: string; value?: string }>;
                    };
                  };
                }>;
              }>(activeNetwork, '/state/non-fungible/data', {
                resource_address: nf.resourceAddress,
                non_fungible_ids: [nf.ids[0]],
              });
              const fields = dataRes.non_fungible_ids?.[0]?.data?.programmatic_json?.fields ?? [];
              const img = fields.find((f) => f.field_name === 'key_image_url' || f.field_name === 'image_url')?.value;
              if (typeof img === 'string' && img.trim()) {
                nf.iconUrl = img.trim();
              }
            } catch {
              // Ignore individual NFT data fetch errors
            }
          }),
        );
      }

      writeBrowserCopy(queryKey, mergedHoldings);
      return mergedHoldings;
    },
    enabled: addresses.length > 0,
    staleTime: 30_000,
  });
}
