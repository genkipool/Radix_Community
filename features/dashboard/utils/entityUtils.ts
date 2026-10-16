/**
 * features/dashboard/utils/entityUtils.ts
 *
 * Pure utility functions for Radix entity addresses.
 * No React hooks — safe to import in any context.
 */

import { sanitizeText } from '@/utils/sanitize';
import type { TranslationsT } from '@/features/dashboard/types';
import { ENTITY_KINDS, entityKindOf } from '@/features/dashboard/lib/entityKinds';

// ─────────────────────────────────────────
//  isConsensusManager
// ─────────────────────────────────────────
/** Returns true for the protocol's built-in Consensus Manager address. */
export function isConsensusManager(addr: string): boolean {
  if (!addr) return false;
  return addr.startsWith('consensusmanager');
}

// ─────────────────────────────────────────
//  getEntityType
// ─────────────────────────────────────────
/** Returns the address-type label + Tailwind color tokens. */
export function getEntityType(
  address: string,
  tt?: Partial<TranslationsT['dashboard']['transactions']>,
): { label: string; color: string; bg: string } {
  const kind = entityKindOf(sanitizeText(address));
  if (kind) {
    const info = ENTITY_KINDS[kind];
    return { label: tt?.[info.labelKey] || info.fallbackLabel, color: info.color, bg: info.bg };
  }
  return { label: tt?.entity_type_unknown || 'Entity', color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-surface)] border-[var(--color-card-border)]' };
}

// ─────────────────────────────────────────
//  formatEntityAddress
// ─────────────────────────────────────────
/**
 * Formats an address for display, optionally injecting a resolved entity name.
 */
export function formatEntityAddress(
  entity: string,
  tt?: Partial<TranslationsT['dashboard']['transactions']>,
  name?: string | null,
): string {
  if (!entity) return '';
  const clean = sanitizeText(entity);
  const shorten = (s: string) =>
    s.length > 30 ? `${s.slice(0, 10)}...${s.slice(-6)}` : s;

  if (isConsensusManager(clean))
    return tt?.consensus_manager_label || 'Consensus Manager (Protocol Action)';

  if (clean.startsWith('account_'))
    return shorten(clean);

  if (clean.startsWith('component_')) {
    const short = shorten(clean);
    return name ? `${name} (${short})` : `${tt?.components || 'Component'} (${short})`;
  }

  if (clean.startsWith('resource_'))
    return `Resource (${shorten(clean)})`;

  if (clean.startsWith('validator_')) {
    const short = shorten(clean);
    return name ? `${name} (${short})` : short;
  }

  return shorten(clean);
}

// ─────────────────────────────────────────
//  formatAddressShort
// ─────────────────────────────────────────
/**
 * Truncates a long address to a readable short form: "abcde12345...xyz890"
 * Used in transaction cards and entity badges.
 */
function _formatAddressShort(
  address: string,
  start = 10,
  end = 6,
): string {
  if (!address) return '';
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

// ─────────────────────────────────────────
//  formatEntity (transaction card helper)
// ─────────────────────────────────────────
/**
 * Formats a Radix address for compact display inside a transaction card.
 * Used in TransactionCard and TransactionDetailModal.
 */
export function formatEntity(address: string): string {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}
