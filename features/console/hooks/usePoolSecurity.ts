'use client';

import { useQuery } from '@tanstack/react-query';

import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';
import type { KnownTokens } from '../lib/known-tokens';
import type { ManagerMoves } from '../lib/pool-history';
import type { PoolState } from '../lib/pool-lookup';
import { poolFindings, type PoolFinding } from '../lib/pool-security';
import { gatherPoolSecurity } from '../lib/security-data';

/**
 * The pool's security findings, gathered by the same function the MCP's
 * get_pool_state runs, plus the DEXes' token list from the server. Waits for
 * the resolved callers, the history and the holders the card already reads.
 */
export function usePoolSecurity({
  state,
  network,
  callers,
  managerMoves,
  topShare,
}: {
  state: PoolState | null | undefined;
  network: Network;
  callers: Record<string, string> | undefined;
  managerMoves: ManagerMoves | null | undefined;
  topShare: number | null | undefined;
}): { findings: PoolFinding[] | null } {
  const { data: knownTokens } = useQuery({
    queryKey: ['console-known-tokens', network],
    queryFn: async (): Promise<KnownTokens> => {
      const res = await fetch(`/api/console/known-tokens?network=${network}`);
      return res.ok ? ((await res.json()) as { tokens: KnownTokens }).tokens : {};
    },
    staleTime: 60 * 60_000,
  });

  const { data: input } = useQuery({
    queryKey: ['console-pool-security', network, state?.address, callers],
    queryFn: () => gatherPoolSecurity((path, body) => gatewayPost(network, path, body), state!, { callers: callers!, knownTokens: {} }),
    enabled: !!state && callers !== undefined,
    staleTime: 60_000,
    retry: false,
  });

  if (!input || !knownTokens) return { findings: null };
  // The history and holders arrive on their own: the findings follow them without asking the Gateway again.
  return { findings: poolFindings({ ...input, knownTokens, managerMoves, topShare }) };
}
