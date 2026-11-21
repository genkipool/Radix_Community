/**
 * radixAddress.ts
 *
 * Helpers for identifying and working with Radix entity addresses.
 * The entity prefixes come from `lib/entityKinds.ts`, the one list the
 * explorer keeps; transaction hashes are added here.
 */

import { ENTITY_ADDRESS_PREFIXES } from '../lib/entityKinds';
import { isOlympiaValue } from '../lib/olympia';
import type { Network } from '../types';

const RADIX_ADDRESS_PREFIXES = [...ENTITY_ADDRESS_PREFIXES, 'txid_', 'subtxid_', 'accesscontroller_'];

/**
 * Returns true if the given string looks like a Radix entity address
 * (i.e. it starts with a known prefix and has a meaningful length).
 */
export function isRadixAddress(q: string): boolean {
    return (q.length > 10 && RADIX_ADDRESS_PREFIXES.some(prefix => q.startsWith(prefix))) || isOlympiaValue(q);
}

/**
 * Infers the Radix ledger (`mainnet` or `stokenet`) from a Bech32m address or
 * transaction hash (`_tdx_2_1` → Stokenet, `_rdx1` or Olympia → Mainnet).
 * Returns `null` when the input does not carry a complete network marker.
 */
export function detectAddressNetwork(q: string): Network | null {
    const trimmed = q.trim();
    if (!trimmed) return null;
    if (isOlympiaValue(trimmed)) return 'mainnet';
    if (!RADIX_ADDRESS_PREFIXES.some(prefix => trimmed.startsWith(prefix))) return null;
    if (/_tdx_2_1[a-z0-9]{10,}/i.test(trimmed)) return 'stokenet';
    if (/_rdx1[a-z0-9]{10,}/i.test(trimmed)) return 'mainnet';
    return null;
}
