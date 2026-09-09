'use client';

import { useQuery } from '@tanstack/react-query';

import {
  apiFetchEntityDetails,
  apiFetchNonFungibleData,
} from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import {
  epochOf,
  nonFungibleHoldingsOf,
  parseClaimNft,
  sortClaimNfts,
  validatorOfResource,
  type ClaimableNft,
  type NonFungibleDataItem,
} from '../lib/validator-lookup';

export type { ClaimableNft } from '../lib/validator-lookup';

/**
 * Every stake claim NFT the account holds, resolved to the validator that
 * minted it. The parsing lives in `validator-lookup`, shared with the MCP
 * server; this only supplies the browser's fetchers and caching.
 */
export function useClaimableNfts(account: string | null) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['console-claimable-nfts', activeNetwork, account],
    enabled: !!account,
    staleTime: 30_000,
    queryFn: async (): Promise<ClaimableNft[]> => {
      if (!account) return [];

      const accountDetails = await apiFetchEntityDetails(account, activeNetwork, true);
      const currentEpoch = epochOf(accountDetails);
      const holdings = nonFungibleHoldingsOf(accountDetails);
      if (holdings.length === 0) return [];

      const perResource = await Promise.all(
        holdings.map(async (holding) => {
          const resource = await apiFetchEntityDetails(holding.resourceAddress, activeNetwork);
          const validatorAddress = validatorOfResource(resource);
          if (!validatorAddress) return [];

          const [validatorDetails, data] = await Promise.all([
            apiFetchEntityDetails(validatorAddress, activeNetwork).catch(() => null),
            apiFetchNonFungibleData(holding.resourceAddress, holding.ids, activeNetwork),
          ]);

          return (data as unknown as NonFungibleDataItem[]).map((item) =>
            parseClaimNft(item, {
              resourceAddress: holding.resourceAddress,
              validatorAddress,
              validatorDetails,
              currentEpoch,
            }),
          );
        }),
      );

      return sortClaimNfts(perResource.flat());
    },
  });
}
