import { sanitizeText } from '@/utils/sanitize';
import { getMetaValue } from '../explorador/utils/metadataUtils';
import type { EntityMeta } from '@/features/dashboard/types';
import type { MetadataItem } from '@/features/dashboard/types/shared.types';

// ─────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────
const FETCHABLE_PREFIXES = ['resource_', 'component_', 'validator_', 'package_', 'pool_'] as const;

/** 
 * Normalizes a Radix address for use in cache keys.
 * Ensures consistent lookups between server and client.
 */
function normalizeAddress(addr: string | undefined | null): string {
  if (!addr) return '';
  return sanitizeText(addr).trim();
}

export function needsFetch(address: string): boolean {
  const clean = normalizeAddress(address);
  return FETCHABLE_PREFIXES.some(p => clean.startsWith(p));
}

export function extractEntityMeta(res: unknown): EntityMeta | null {
  if (!res) return null;

  const r = res as Record<string, unknown>;

  // 1. Check for flat structure (used in some internal cache objects)
  if (typeof r.name === 'string' && ('iconUrl' in r || 'address' in r) && !r.metadata) {
    return {
      name: r.name ? sanitizeText(r.name) : null,
      iconUrl: r.iconUrl ? sanitizeText(String(r.iconUrl)) : null,
      symbol: r.symbol ? sanitizeText(String(r.symbol)) : null,
    };
  }

  // 2. Extract from Gateway standard metadata structure
  const items: MetadataItem[] =
    ((r?.metadata as Record<string, unknown>)?.items as MetadataItem[]) ??
    (((r?.details as Record<string, unknown>)?.metadata as Record<string, unknown>)?.items as MetadataItem[]) ??
    [];

  const pick = (key: string): string | null => {
    const raw = getMetaValue(items, key);
    return raw ? sanitizeText(String(raw)) : null;
  };

  const detailsObj = r?.details as Record<string, unknown> | undefined;
  const rawBlueprint = detailsObj?.blueprint_name;
  const blueprintName = rawBlueprint ? sanitizeText(String(rawBlueprint)) : null;

  const meta: EntityMeta = {
    name: pick('name'),
    iconUrl: pick('icon_url'),
    symbol: pick('symbol'),
    blueprintName,
  };

  // If we found absolutely nothing, return null so the hook knows it's truly empty
  if (!meta.name && !meta.symbol && !meta.iconUrl && !meta.blueprintName) return null;

  return meta;
}

// ─────────────────────────────────────────
//  Query key factory
// ─────────────────────────────────────────
export const entityKeys = {
  all: ['entity'] as const,
  detail: (address: string, network: string) => 
    ['entity', 'meta', normalizeAddress(address), network] as const,
  full: (address: string, network: string) => 
    ['entity', 'full', normalizeAddress(address), network] as const,
};
