import { sanitizeText } from '@/utils/sanitize';
import { getMetaValue } from '../explorador/utils/metadataUtils';
import type { EntityMeta } from '@/features/dashboard/types';
import type { MetadataItem } from '@/features/dashboard/types/shared.types';

// ─────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────
const FETCHABLE_PREFIXES = ['resource_', 'component_', 'validator_', 'package_'] as const;

export function needsFetch(address: string): boolean {
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
/**
 * entityKeys
 *
 * Provides standardized query keys for React Query and caching.
 * SEPARATE NAMESPACES — intentional and critical:
 *
 *   entityKeys.detail  →  stores EntityMeta ({ name, iconUrl, symbol })
 *   entityKeys.full    →  stores the raw full Gateway response object
 */
export const entityKeys = {
  all: ['entity'] as const,
  // Partial summary (EntityMeta) — used by useEntityData / EntityBadge
  detail: (address: string, network: string) => ['entity', 'meta', address, network] as const,
  // Full Gateway response — used by BalanceChangeRow / ResourceDetailModal / panels
  full: (address: string, network: string) => ['entity', 'full', address, network] as const,
};
