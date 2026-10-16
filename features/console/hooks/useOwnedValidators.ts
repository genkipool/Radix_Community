'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetchEntityDetails, apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getMetadataString } from '../lib/metadata-manifests';
import {
  metadataItemsOf,
  nonFungibleHoldingsOf,
  validatorOfOwnerBadge,
  type NonFungibleDataItem,
} from '../lib/validator-lookup';

/** A validator the account can act on, paired with the badge that proves it. */
export interface OwnedValidator {
  /** Validator component address, read out of the badge's own NFT data. */
  address: string;
  /** Local id of the owner badge to present in the proof. */
  badgeLocalId: string;
  /** `name` metadata of the validator, when it has been set. */
  name?: string;
}

/**
 * Validators whose owner badge the account holds. Resolves to an empty list,
 * never an error, when it holds none.
 */
export async function fetchOwnedValidators(
  account: string,
  network: 'mainnet' | 'stokenet',
  badgeResource: string,
): Promise<OwnedValidator[]> {
  if (!account) return [];

  const details = await apiFetchEntityDetails(account, network);
  const badges = nonFungibleHoldingsOf(details).find(
    (holding) => holding.resourceAddress === badgeResource,
  );
  if (!badges?.ids.length) return [];

  const badgeData = (await apiFetchNonFungibleData(
    badgeResource,
    badges.ids,
    network,
  )) as unknown as NonFungibleDataItem[];

  const owned = badgeData.flatMap((item) => {
    const address = validatorOfOwnerBadge(item);
    return address ? [{ address, badgeLocalId: item.non_fungible_id }] : [];
  });
  if (owned.length === 0) return [];

  // Names are cosmetic: a validator that has not set one still resolves.
  const named = await Promise.all(
    owned.map(async (validator) => {
      try {
        const entity = await apiFetchEntityDetails(validator.address, network);
        return {
          ...validator,
          name: getMetadataString(metadataItemsOf(entity), 'name') || undefined,
        };
      } catch {
        return validator;
      }
    }),
  );

  return named;
}

/**
 * Validators owned by the given account, for prefilling the owner-gated
 * manifest templates. Resolves to an empty list — never an error — when the
 * account holds no badge, so callers can render the plain form unchanged.
 */
export function useOwnedValidators(accountAddress: string | null) {
  const { activeNetwork, activeNetworkId } = useRadixWallet();
  const badgeResource =
    RADIX_TOKEN_ADDRESSES[activeNetworkId ?? RadixNetworkId.Mainnet].OWNER_BADGE;

  return useQuery({
    queryKey: ['console-owned-validators', activeNetwork, accountAddress],
    enabled: !!accountAddress,
    staleTime: 60_000,
    queryFn: () => (accountAddress ? fetchOwnedValidators(accountAddress, activeNetwork, badgeResource) : []),
  });
}
