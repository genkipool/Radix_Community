'use client';

import { useQuery } from '@tanstack/react-query';
import { sanitizeText } from '@/utils/sanitize';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys, extractEntityMeta, needsFetch } from '../utils/entityCache';

/* ─── Re-export pure utilities so existing imports stay unbroken ─── */
export { isConsensusManager, getEntityType, formatEntityAddress } from '../utils/entityUtils';
export { entityKeys, extractEntityMeta, needsFetch } from '../utils/entityCache';

// ─────────────────────────────────────────
//  Types
// ─────────────────────────────────────────
import type { EntityMeta } from '@/features/dashboard/types';

// ─────────────────────────────────────────
//  useEntityData
// ─────────────────────────────────────────
/**
 * Resolves on-chain metadata (name, icon, symbol) for a Radix entity address.
 *
 * Design decisions:
 * - Automatic request deduplication: if 20 components request the same address
 *   simultaneously, only ONE network request is made.
 * - staleTime: Infinity — on-chain metadata doesn't change; no background refetches.
 * - gcTime: 10 min — keeps resolved metadata for the whole session.
 * - enabled: false for addresses that don't have resolvable metadata (account_, identity_).
 */
export function useEntityData(address: string, network: string): EntityMeta | null {
  const clean = sanitizeText(address);

  const { data } = useQuery<EntityMeta | null>({
    queryKey: entityKeys.detail(clean, network),
    queryFn: async () => {
      const res = await apiFetchEntityDetails(clean, network as 'mainnet' | 'stokenet');
      return extractEntityMeta(res);
    },
    enabled: needsFetch(clean),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
    retryOnMount: true,
  });

  return data ?? null;
}
