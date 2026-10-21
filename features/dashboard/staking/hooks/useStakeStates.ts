'use client';

import { useQueries } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';
import { claimCollectionsOf, claimNftsQuery, parseClaimNft } from '@/features/dashboard/staking/lib/claimNfts';
import type { GatewayEntityDetails } from '@/features/dashboard/types';
import type { Validator } from '@/services/radixApi';

/** What the connected wallet has going on with one validator. */
export interface StakeState {
  /** Holds LSUs of the validator. */
  staking: boolean;
  /** Has XRD still in the unlocking period. */
  unstaking: boolean;
  /** Has XRD that can be claimed right now. */
  claim: boolean;
}

const positive = (amount: unknown) => parseFloat(String(amount ?? '0')) > 0;

/** The details are read per vault, so the balance sits in the vaults rather than on the resource. */
type FungibleResource = NonNullable<GatewayEntityDetails['fungible_resources']>['items'][number];
const fungibleAmount = (ft: FungibleResource & { vaults?: { items?: { amount?: string }[] } }) =>
  ft.amount ?? ft.vaults?.items?.reduce((sum, v) => sum + parseFloat(v.amount || '0'), 0);

/**
 * Per validator, whether the wallet is staking with it, is waiting out an
 * unstake, or has a claim ready — the three filters of the staking view.
 *
 * Nothing here has a request of its own to add. Staking comes from the LSU
 * balances in the account details, the same cache entries `useConnectedStakes`
 * reads. Unstaking and claim need the claim NFTs' data (`claim_epoch` against
 * the current epoch); that read is the one the account card makes, under the
 * same key, so whichever asks first pays for both — and the invalidation that
 * follows a stake / unstake / claim refreshes both. It only runs when
 * `withClaims` says a filter needs it.
 */
export function useStakeStates(
  accountAddresses: string[],
  network: 'mainnet' | 'stokenet',
  validators: Validator[],
  withClaims: boolean,
) {
  const entityResults = useQueries({
    queries: accountAddresses.map((address) => ({
      queryKey: dashboardKeys.entities.detail(address, network),
      queryFn: () => apiFetchEntityDetails(address, network),
      enabled: !!address,
      staleTime: CACHE_TIMES.MEDIUM,
      gcTime: CACHE_TIMES.LONG,
    })),
  });

  const byLsu = new Map(validators.map((v) => [v.lsuResource, v.address]));
  const states: Record<string, StakeState> = {};
  const stateOf = (validator: string) => (states[validator] ??= { staking: false, unstaking: false, claim: false });
  const accounts: { address: string; epoch: number; collections: ReturnType<typeof claimCollectionsOf> }[] = [];
  let entitiesLoading = false;

  entityResults.forEach((result, i) => {
    if (result.isLoading) entitiesLoading = true;
    const entity = result.data as (GatewayEntityDetails & { ledger_state?: { epoch: number } }) | undefined;
    if (!entity) return;

    (entity.fungible_resources?.items ?? []).forEach((ft) => {
      const fromMeta = ft.explicit_metadata?.items?.find((m) => m.key === 'validator')?.value?.typed?.value;
      const validator = (fromMeta as string | undefined) ?? byLsu.get(ft.resource_address);
      if (!validator) return;
      if (positive(fungibleAmount(ft))) stateOf(validator).staking = true;
    });

    accounts.push({
      address: accountAddresses[i],
      epoch: entity.ledger_state?.epoch ?? 0,
      collections: claimCollectionsOf(entity.non_fungible_resources?.items ?? [], validators),
    });
  });

  const claimResults = useQueries({
    queries: accounts.map((a) => ({
      ...claimNftsQuery(a.address, network, a.collections.collections),
      enabled: withClaims && Object.keys(a.collections.collections).length > 0,
      staleTime: CACHE_TIMES.MEDIUM,
      gcTime: CACHE_TIMES.LONG,
    })),
  });

  let claimsLoading = false;
  claimResults.forEach((result, i) => {
    if (result.isLoading) claimsLoading = true;
    const { epoch, collections } = accounts[i];
    collections.resources.forEach(({ resource, validator }) => {
      (result.data?.[resource] ?? []).forEach((item) => {
        const { amount, epoch: claimEpoch } = parseClaimNft(item);
        if (amount <= 0) return;
        if (claimEpoch > epoch) stateOf(validator).unstaking = true;
        else stateOf(validator).claim = true;
      });
    });
  });

  return { states, isLoading: entitiesLoading || (withClaims && claimsLoading) };
}
