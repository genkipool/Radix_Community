'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { claimFeesManifest, removePositionsManifest } from '../lib/precision-manifests';
import { findPrecisionPositions, type PrecisionPosition } from '../lib/precision-positions';
import { previewTransaction } from '../services/transactionPreview';
import { useAccountResources } from './useAccountResources';

/** What one pool's positions would pay out now, per resource, from a simulation of the real transaction. */
export interface PositionEstimate {
  fees: Record<string, number>;
  withdraw: Record<string, number>;
}

/** Fees keep accruing: the estimates are simulated again this often while the page is open. */
const ESTIMATE_REFRESH_MS = 30_000;

/** What the account receives in a simulated transaction, per resource (the LP NFTs it hands over left out). */
async function received(manifest: string, account: string, network: 'mainnet' | 'stokenet', lpResource: string) {
  const result = await previewTransaction(manifest, network);
  if (result.status !== 'Succeeded') throw new Error(result.errorMessage || result.status);
  const out: Record<string, number> = {};
  for (const change of result.balanceChanges) {
    if (change.entityAddress !== account || change.resourceAddress === lpResource) continue;
    out[change.resourceAddress] = (out[change.resourceAddress] ?? 0) + Number(change.amount);
  }
  return out;
}

/**
 * The account's Ociswap Precision positions and what claiming or withdrawing
 * would pay out now (whether Ociswap lists each pool is `useDexListing`). The amounts come from
 * simulating the very transactions the tool sends, so they match the wallet.
 */
export function usePrecisionPositions(account: string | null, { withEstimates = true }: { withEstimates?: boolean } = {}) {
  const { activeNetwork } = useRadixWallet();
  const holdings = useAccountResources(account);
  const held = holdings.data?.nonFungibles ?? [];
  const heldKey = held.map((n) => `${n.resourceAddress}:${n.ids.length}`).join(',');

  const positions = useQuery({
    queryKey: ['console-precision-positions', activeNetwork, account, heldKey],
    enabled: !!account && holdings.isSuccess,
    staleTime: 0,
    // The pool's price moves: re-read it with the estimates, so the in-range status stays current.
    refetchInterval: ESTIMATE_REFRESH_MS,
    retry: false,
    queryFn: () => findPrecisionPositions((path, body) => gatewayPost(activeNetwork, path, body), held),
  });
  const list: PrecisionPosition[] = positions.data ?? [];

  const estimates = useQueries({
    queries: list.map((p) => ({
      queryKey: ['console-precision-estimate', activeNetwork, account, p.pool, p.ids.join(',')],
      enabled: !!account && withEstimates,
      staleTime: 0,
      refetchInterval: ESTIMATE_REFRESH_MS,
      retry: false,
      queryFn: async (): Promise<PositionEstimate> => {
        const group = [{ pool: p.pool, lpResource: p.lpResource, ids: p.ids }];
        const [fees, withdraw] = await Promise.all([
          received(claimFeesManifest(account!, group), account!, activeNetwork, p.lpResource),
          received(removePositionsManifest(account!, group), account!, activeNetwork, p.lpResource),
        ]);
        return { fees, withdraw };
      },
    })),
  });

  return {
    positions: list,
    loading: !!account && (holdings.isPending || positions.isPending),
    error: holdings.error ?? positions.error,
    estimateOf: (pool: string) => estimates[list.findIndex((p) => p.pool === pool)],
  };
}
