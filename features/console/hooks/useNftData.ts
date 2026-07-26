import { useQuery } from '@tanstack/react-query';
import { apiFetchNonFungibleData, apiFetchAllNonFungibleIds, apiFetchNonFungibleLocation } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';

export interface NftData {
  id: string;
  name?: string;
  imageUrl?: string;
  vaultAddress?: string;
  /** Account that owns the holding vault (for recall/freeze targeting). */
  ownerAccount?: string;
}

interface NfDataField {
  field_name?: string;
  value?: unknown;
  /** SBOR kind: String, U64, Decimal, Reference, Enum, Array… */
  kind?: string;
}

interface NfDataItem {
  non_fungible_id: string;
  data?: { programmatic_json?: { fields?: NfDataField[] } };
}

export function useNftData(resourceAddress: string | null, ids: string[]) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['nft-data', activeNetwork, resourceAddress, ids.join(',')],
    queryFn: async () => {
      if (!resourceAddress || ids.length === 0) return [];
      const data = await apiFetchNonFungibleData(resourceAddress, ids, activeNetwork);
      return (data as unknown as NfDataItem[]).map((item) => {
        const fields = item.data?.programmatic_json?.fields || [];
        const nameField = fields.find((f) => f.field_name === 'name')?.value;
        const urlField = fields.find((f) => f.field_name === 'key_image_url')?.value;
        return {
          id: item.non_fungible_id,
          name: nameField,
          imageUrl: urlField,
        } as NftData;
      });
    },
    enabled: !!resourceAddress && ids.length > 0,
    staleTime: 60_000,
  });
}

export interface NftField {
  name: string;
  value: string;
  /** SBOR kind, so a manifest can write the value the way its type needs. */
  kind?: string;
}

/**
 * Every data field of ONE NFT with its current value, for the edit form.
 * `useNftData` only pulls out name and image; this keeps the rest, which is
 * what an editor needs to show.
 */
export function useNftFields(resourceAddress: string | null, id: string | null) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['nft-fields', activeNetwork, resourceAddress, id],
    queryFn: async (): Promise<NftField[]> => {
      if (!resourceAddress || !id) return [];
      const data = await apiFetchNonFungibleData(resourceAddress, [id], activeNetwork);
      const item = (data as unknown as NfDataItem[])[0];
      return (item?.data?.programmatic_json?.fields ?? [])
        .filter((f) => !!f.field_name)
        .map((f) => ({
          name: f.field_name!,
          kind: f.kind,
          value:
            f.value == null
              ? ''
              : typeof f.value === 'object'
                ? JSON.stringify(f.value)
                : String(f.value),
        }));
    },
    enabled: !!resourceAddress && !!id,
    staleTime: 30_000,
  });
}

export function useMissingNfts(resourceAddress: string | null, ownedIds: string[]) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['missing-nfts', activeNetwork, resourceAddress, ownedIds.join(',')],
    queryFn: async () => {
      if (!resourceAddress) return [];
      // 1. Fetch all IDs
      const allIds = await apiFetchAllNonFungibleIds(resourceAddress, activeNetwork);
      // 2. Filter out owned ones
      const missingIds = allIds.filter(id => !ownedIds.includes(id));
      if (missingIds.length === 0) return [];
      // 3. Fetch metadata for missing ones
      const data = await apiFetchNonFungibleData(resourceAddress, missingIds, activeNetwork);
      // 4. Fetch locations for missing ones
      const locations = await apiFetchNonFungibleLocation(resourceAddress, missingIds, activeNetwork);
      return (data as unknown as NfDataItem[]).map((item) => {
        const fields = item.data?.programmatic_json?.fields || [];
        const nameField = fields.find((f) => f.field_name === 'name')?.value;
        const urlField = fields.find((f) => f.field_name === 'key_image_url')?.value;
        const loc = locations[item.non_fungible_id];
        return {
          id: item.non_fungible_id,
          name: nameField,
          imageUrl: urlField,
          vaultAddress: loc?.vault,
          ownerAccount: loc?.account,
        } as NftData;
      });
    },
    enabled: !!resourceAddress,
    staleTime: 60_000,
  });
}
