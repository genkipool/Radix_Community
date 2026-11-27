'use client';

import { useQuery } from '@tanstack/react-query';
import { sanitizeText } from '@/utils/sanitize';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { getKnownAccountLabel } from '@/features/dashboard/explorador/constants/wellKnownAddresses';
import type { EntityMeta, Network } from '@/features/dashboard/types';
import { entityKeys, extractEntityMeta, needsFetch } from '../utils/entityCache';

/* ─── Re-export pure utilities so existing imports stay unbroken ─── */
export { isConsensusManager, getEntityType, formatEntityAddress } from '../utils/entityUtils';
export { entityKeys, extractEntityMeta, needsFetch } from '../utils/entityCache';

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

  const knownAccount = getKnownAccountLabel(clean, network as Network);

  // The entry holds the entity's full details, as every card and the server
  // write it; the name, icon and symbol are read out of it. Storing only those
  // here would hand a card that shares the entry an object it cannot read.
  const { data } = useQuery<unknown, Error, EntityMeta | null>({
    queryKey: entityKeys.detail(clean, network),
    queryFn: () => apiFetchEntityDetails(clean, network as 'mainnet' | 'stokenet'),
    select: extractEntityMeta,
    enabled: needsFetch(clean),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
    retryOnMount: true,
  });

  if (data && knownAccount) {
    return {
      ...data,
      name: data.name || knownAccount.name,
      iconUrl: data.iconUrl || knownAccount.iconUrl || null,
    };
  }
  if (data) return data;
  if (knownAccount) return { name: knownAccount.name, iconUrl: knownAccount.iconUrl ?? null, symbol: null };
  return null;
}
