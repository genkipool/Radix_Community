import { apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import type { GatewayEntityDetails } from '@/features/dashboard/types';
import type { Validator } from '@/types/radix';

/** Claim NFT ids per claim-NFT resource address. */
export type ClaimCollections = Record<string, string[]>;

/** The claim NFTs' data per resource address, as the Gateway returns it. */
export type ClaimNftData = Record<string, Record<string, unknown>[]>;

type NonFungibleResource = NonNullable<GatewayEntityDetails['non_fungible_resources']>['items'][number];

/**
 * The claim NFTs an account holds: the resources that say which validator they
 * belong to (by metadata, or because a validator names them as its claim
 * token) with the ids in their vaults. Shared by the account card and the
 * staking filters so both build the same query key.
 */
export function claimCollectionsOf(nonFungibles: NonFungibleResource[], validators: Validator[] = []) {
  const collections: ClaimCollections = {};
  const validatorByClaim = new Map(validators.map(v => [v.claimTokenResourceAddress, v.address]));
  const resources: { resource: string; validator: string }[] = [];

  nonFungibles.forEach(nft => {
    const fromMeta = nft.explicit_metadata?.items?.find(m => m.key === 'validator')?.value?.typed?.value;
    const validator = (fromMeta as string | undefined) || validatorByClaim.get(nft.resource_address);
    if (!validator) return;
    const vaults = (nft.vaults?.items ?? []) as { items?: string[]; non_fungible_ids?: { items?: string[] } }[];
    const ids = vaults.flatMap(v => v.items ?? v.non_fungible_ids?.items ?? []);
    if (ids.length === 0) return;
    collections[nft.resource_address] = ids;
    resources.push({ resource: nft.resource_address, validator });
  });

  return { collections, resources };
}

/**
 * The account's claim-NFT read, as query options.
 *
 * One definition for everything that needs it — the account card's staking
 * rows and the staking view's Unstaking / Claim filters — so they share ONE
 * cache entry and one request instead of each asking the Gateway again. The
 * key starts with `account-claim-nfts`, which is what a stake / unstake / claim
 * transaction invalidates, and carries the ids so newly minted NFTs refetch.
 */
export function claimNftsQuery(address: string, network: 'mainnet' | 'stokenet', collections: ClaimCollections) {
  const resources = Object.keys(collections).sort();
  const ids = resources.map(resource => `${resource}:${collections[resource].toSorted().join('|')}`).join('||');
  return {
    queryKey: ['account-claim-nfts', address, network, ids] as const,
    queryFn: async (): Promise<ClaimNftData> => {
      const results: ClaimNftData = {};
      await Promise.all(resources.map(async resource => {
        results[resource] = await apiFetchNonFungibleData(resource, collections[resource], network);
      }));
      return results;
    },
    enabled: resources.length > 0,
  };
}

/** What one claim NFT holds: the XRD, and the epoch from which it can be claimed. */
export function parseClaimNft(item: Record<string, unknown>): { amount: number; epoch: number } {
  const data = item.data as { programmatic_json?: { fields?: { field_name: string; value: string }[] } } | undefined;
  const fields = data?.programmatic_json?.fields;
  const field = (name: string) => fields?.find(f => f.field_name === name)?.value;
  return {
    amount: parseFloat(field('claim_amount') || '0'),
    epoch: parseInt(field('claim_epoch') || '0', 10),
  };
}
