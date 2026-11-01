'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { networkOfAddress, otherNetworkOf } from '../lib/address-network';
import { accountFromQuery, consoleQueryParam } from '../lib/console-query';
import { heldBadgeFor, parsePoolState, type PoolState } from '../lib/pool-lookup';
import type { PoolBadgeProof } from '../lib/pool-manifests';
import type { AccountHoldings } from '../types/console.types';
import { useAccountResources } from './useAccountResources';
import { useConsoleQueryState } from './useConsoleQueryState';

/** `?pool=pool_…` on the tool URL, so a link can open a pool directly. */
export const poolFromUrl = () => consoleQueryParam('pool') ?? '';

/** A pool the account is involved with: it holds its units. */
export interface DetectedPool {
  address: string;
  /** Pool unit the account holds, with the amount. */
  poolUnit: string;
  units: string;
  name: string;
}

export interface PoolFormContext {
  account: string | null;
  setAccount: (account: string) => void;
  holdings: AccountHoldings | undefined;
  /** Pools found through the pool units the account holds. */
  detected: DetectedPool[];
  /** The pool the form acts on (picked or typed). */
  pool: string;
  setPool: (address: string) => void;
  /** On-ledger state of the chosen pool; null when it is not a native pool. */
  state: PoolState | null | undefined;
  isLoadingState: boolean;
  /** Total supply of the pool unit, for redemption maths. */
  poolUnitSupply: number | null;
  /** Units of the chosen pool the account holds. */
  heldUnits: number;
  /** Proof of the manager badge, when the account holds it. */
  managerProof: PoolBadgeProof | null;
  /** Proof of the owner badge, when the account holds it. */
  ownerProof: PoolBadgeProof | null;
}

/**
 * The context every pool form shares: who signs, which pool, the pool as the
 * ledger has it, and whether the account holds the badges its roles ask for.
 *
 * One pool at a time: unlike validator calls, pool operations move the
 * account's own tokens, so batching several pools would only hide amounts.
 */
export function usePoolFormContext(): PoolFormContext {
  const { activeNetwork } = useRadixWallet();
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [typedPool, setTypedPool] = useConsoleQueryState(poolFromUrl, '');
  // The network the pool was chosen on. A pool of the other network chosen
  // before a switch is hidden until its network is back; one typed or pasted
  // on this network stays, so its field can say it is on the wrong one.
  const [chosenOn, setChosenOn] = useState<string | null>(null);
  const setPool = (address: string) => {
    setTypedPool(address);
    setChosenOn(activeNetwork);
  };
  const { data: holdings } = useAccountResources(account);

  const detected: DetectedPool[] = (holdings?.fungibles ?? [])
    .filter((f) => f.pool?.startsWith('pool_'))
    .map((f) => ({ address: f.pool!, poolUnit: f.resourceAddress, units: f.amount, name: f.name || f.symbol }));

  const stored = typedPool.trim();
  const fromOtherNetwork = !!otherNetworkOf(stored, activeNetwork) && (chosenOn ?? networkOfAddress(stored)) !== activeNetwork;
  const pool = fromOtherNetwork ? '' : stored;

  const { data: state, isLoading: isLoadingState } = useQuery({
    queryKey: ['console-pool-state', activeNetwork, pool],
    enabled: pool.startsWith('pool_') && !otherNetworkOf(pool, activeNetwork),
    staleTime: 15_000,
    retry: false,
    queryFn: async () => parsePoolState(await apiFetchEntityDetails(pool, activeNetwork, true)),
  });

  const { data: poolUnitSupply } = useQuery({
    queryKey: ['console-pool-unit-supply', activeNetwork, state?.poolUnit],
    enabled: !!state?.poolUnit,
    staleTime: 15_000,
    retry: false,
    queryFn: async () => {
      const details = (await apiFetchEntityDetails(state!.poolUnit, activeNetwork, true)) as unknown as {
        details?: { total_supply?: string };
      };
      return Number(details.details?.total_supply ?? 0);
    },
  });

  const fungibles = holdings?.fungibles ?? [];
  const nonFungibles = holdings?.nonFungibles ?? [];
  const proofFor = (rule: PoolState['manager'] | undefined): PoolBadgeProof | null => {
    if (!rule || !account) return null;
    const badge = heldBadgeFor(rule, fungibles, nonFungibles);
    return badge ? { account, resource: badge.resource, nonFungibleId: badge.localId } : null;
  };

  return {
    account,
    setAccount,
    holdings,
    detected,
    pool,
    setPool,
    state,
    isLoadingState: pool.startsWith('pool_') && isLoadingState,
    poolUnitSupply: poolUnitSupply ?? null,
    heldUnits: Number(fungibles.find((f) => f.resourceAddress === state?.poolUnit)?.amount ?? 0),
    managerProof: proofFor(state?.manager),
    ownerProof: proofFor(state?.owner),
  };
}
