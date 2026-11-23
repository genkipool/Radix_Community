'use client';

import { useQuery } from '@tanstack/react-query';
import { gatewayPost } from '@/services/gateway/bases';

export interface NftCardEntry {
  id: string;
  name?: string;
  image?: string;
}

/**
 * Fetches NFT IDs + individual names/images for any collection (either from
 * the caller's held IDs or, when empty, from `/state/non-fungible/ids`).
 */
export function useCollectionNfts(
  resourceAddress: string,
  enabled: boolean,
  network: 'mainnet' | 'stokenet',
  localIds: string[],
  /** When true, only load IDs present in `localIds` (never fall back to unheld collection IDs). */
  heldOnly = false,
): { items: NftCardEntry[]; isLoading: boolean } {
  const trimmed = resourceAddress.trim();
  const { data, isLoading } = useQuery<NftCardEntry[]>({
    queryKey: ['console', 'nft-collection-cards', network, trimmed, heldOnly ? 'held' : 'all', localIds.slice(0, 24).join(',')],
    enabled: enabled && trimmed.startsWith('resource_') && trimmed.length >= 20 && (!heldOnly || localIds.length > 0),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      let ids = localIds.slice(0, 24);
      if (ids.length === 0 && !heldOnly) {
        const res = await gatewayPost<{ non_fungible_ids?: { items?: string[] } }>(
          network,
          '/state/non-fungible/ids',
          { resource_address: trimmed },
        );
        ids = (res.non_fungible_ids?.items ?? []).slice(0, 24);
      }
      if (ids.length === 0) return [];

      try {
        const dataRes = await gatewayPost<{
          non_fungible_ids?: Array<{
            non_fungible_id: string;
            data?: {
              programmatic_json?: {
                fields?: Array<{ field_name?: string; value?: string }>;
              };
            };
          }>;
        }>(network, '/state/non-fungible/data', {
          resource_address: trimmed,
          non_fungible_ids: ids,
        });
        const metaMap = new Map<string, { name?: string; image?: string }>();
        for (const entry of dataRes.non_fungible_ids ?? []) {
          const fields = entry.data?.programmatic_json?.fields ?? [];
          const name = fields.find((f) => f.field_name === 'name')?.value;
          const image = fields.find((f) => f.field_name === 'key_image_url' || f.field_name === 'image_url')?.value;
          metaMap.set(entry.non_fungible_id, {
            name: typeof name === 'string' ? name : undefined,
            image: typeof image === 'string' ? image : undefined,
          });
        }
        return ids.map((id) => ({ id, ...metaMap.get(id) }));
      } catch {
        return ids.map((id) => ({ id }));
      }
    },
  });
  return { items: data ?? localIds.map((id) => ({ id })), isLoading };
}
