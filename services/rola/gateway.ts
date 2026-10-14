/**
 * services/rola/gateway.ts
 *
 * Production `owner_keys` lookup for ROLA verification, backed by the Gateway.
 */

import { getGateway, withRetry, type Network } from '@/services/gateway/client';
import type { OwnerKeysLookup } from './verify';

interface OwnerKeysMetadataItem {
  key: string;
  value?: { typed?: { values?: Array<{ hash_hex?: string }> } };
}

/** Reads the `owner_keys` hashes of an entity (empty when not set). */
export function gatewayOwnerKeys(network: Network): OwnerKeysLookup {
  return async (address) => {
    const res = await withRetry(() =>
      getGateway(network).state.innerClient.stateEntityDetails({
        stateEntityDetailsRequest: {
          addresses: [address],
          opt_ins: { explicit_metadata: ['owner_keys'] },
        },
      }),
    );
    const item = res.items?.[0];
    if (!item) throw new Error(`Gateway returned no entity for ${address}`);
    const entries = (item.metadata?.items ?? []) as unknown as OwnerKeysMetadataItem[];
    const ownerKeys = entries.find((entry) => entry.key === 'owner_keys');
    return (ownerKeys?.value?.typed?.values ?? [])
      .map((v) => v.hash_hex ?? '')
      .filter(Boolean);
  };
}
