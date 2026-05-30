/**
 * features/dashboard/utils/entityUtils.ts
 *
 * Pure utility functions for Radix entity addresses.
 * No React hooks — safe to import in any context.
 */

import { sanitizeText } from '@/utils/sanitize';
import type { TranslationsT } from '@/features/dashboard/types';

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
  const clean = sanitizeText(address);
  if (clean.startsWith('account_')) return { label: tt?.entity_type_account || 'Account', color: 'text-blue-400', bg: 'bg-blue-500/6 border-blue-500/20' };
  if (clean.startsWith('component_')) return { label: tt?.entity_type_component || 'Component', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/6 border-purple-500/30' };
  if (clean.startsWith('resource_')) return { label: tt?.entity_type_resource || 'Resource', color: 'text-amber-800 dark:text-amber-400 font-black tracking-wide', bg: 'bg-amber-500/10 border-amber-500/60' };
  if (clean.startsWith('validator_')) return { label: tt?.entity_type_validator || 'Validator', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/40' };
  if (clean.startsWith('package_')) return { label: tt?.entity_type_package || 'Package', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/6 border-cyan-500/30' };
  if (clean.startsWith('pool_')) return { label: tt?.entity_type_package || 'Package', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/6 border-cyan-500/30' };
  if (clean.startsWith('identity_')) return { label: tt?.entity_type_identity || 'Identity', color: 'text-pink-400', bg: 'bg-pink-500/6 border-pink-500/20' };
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
