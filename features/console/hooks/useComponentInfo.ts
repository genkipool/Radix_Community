'use client';

import { useQuery } from '@tanstack/react-query';

import type { Network } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';
import { fetchComponentState } from '../lib/security-data';

export type { ComponentInfo } from '../lib/security-data';

/**
 * Everything the component card shows, gathered by the same function the
 * MCP's get_component_state runs: the component with its royalty config, its
 * package, owner, dApp, the tokens it holds and where it comes from.
 */
export function useComponentInfo(address: string, network: Network) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['console-component-state', network, address],
    staleTime: 60_000,
    retry: false,
    queryFn: () => fetchComponentState((path, body) => gatewayPost(network, path, body), address),
  });
  return {
    info: data?.info ?? null,
    isLoading,
    error,
    findings: data?.findings ?? (data === null ? [] : null),
    origin: data?.origin ?? null,
    ownerCallers: data?.ownerCallers ?? {},
    packageDetails: data?.packageDetails ?? null,
  };
}
