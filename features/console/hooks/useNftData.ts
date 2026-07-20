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
