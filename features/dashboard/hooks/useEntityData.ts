'use client';

import { useQuery } from '@tanstack/react-query';
import { sanitizeText } from '@/utils/sanitize';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { getMetaValue } from '../explorador/utils/metadataUtils';

/* ─── Re-export pure utilities so existing imports stay unbroken ─── */
export { isConsensusManager, getEntityType, formatEntityAddress } from '../utils/entityUtils';

// ─────────────────────────────────────────
//  Types
// ─────────────────────────────────────────
import type { EntityMeta } from '@/features/dashboard/types';
import type { MetadataItem } from '@/features/dashboard/types/shared.types';

// ─────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────
const FETCHABLE_PREFIXES = ['resource_', 'component_', 'validator_', 'package_'] as const;

function needsFetch(address: string): boolean {
  return FETCHABLE_PREFIXES.some(p => address.startsWith(p));
}

export function extractEntityMeta(res: unknown): EntityMeta | null {
  if (!res) return null;

  // Simplified validator shape: { name, iconUrl, symbol, address, ... }
  const r = res as Record<string, unknown>;
  if (typeof r.name === 'string' && ('iconUrl' in r || 'address' in r) && !r.metadata) {
    return {
      name: r.name ? sanitizeText(r.name) : null,
      iconUrl: r.iconUrl ? sanitizeText(String(r.iconUrl)) : null,
      symbol: r.symbol ? sanitizeText(String(r.symbol)) : null,
    };
  }

  const items: MetadataItem[] =
    ((r?.metadata as Record<string, unknown>)?.items as MetadataItem[]) ??
    (((r?.details as Record<string, unknown>)?.metadata as Record<string, unknown>)?.items as MetadataItem[]) ??
    [];

  const pick = (key: string): string | null => {
    const raw = getMetaValue(items, key);
    return raw ? sanitizeText(String(raw)) : null;
  };

  return {
    name: pick('name'),
    iconUrl: pick('icon_url'),
    symbol: pick('symbol'),
  };
}

// ─────────────────────────────────────────
//  Query key factory
// ─────────────────────────────────────────
//
// TWO SEPARATE NAMESPACES — intentional and critical:
//
//   entityKeys.detail  →  stores EntityMeta ({ name, iconUrl, symbol })
//                         Used by: useEntityData, EntityBadge, TransactionSummaryPanels
//
//   entityKeys.full    →  stores the raw full Gateway response object
//                         Used by: BalanceChangeRow, ResourceDetailModal,
//                                  ValidatorInlinePanel, NftTransferCard, usePrefetchTx
//
// Previously both used the same key. When useEntityData loaded first it filled
// the cache with the partial EntityMeta shape. Components that later called
// useQuery with the same key got the partial object (staleTime: Infinity means
// no refetch) — so the raw tab showed only { name, symbol, icon_url } instead
// of the complete Gateway response.
//
export const entityKeys = {
  all: ['entity'] as const,
  // Partial summary (EntityMeta) — used by useEntityData / EntityBadge
  detail: (address: string, network: string) => ['entity', 'meta', address, network] as const,
  // Full Gateway response — used by BalanceChangeRow / ResourceDetailModal / panels
  full: (address: string, network: string) => ['entity', 'full', address, network] as const,
};

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
