/**
 * radixAddress.ts
 *
 * Helpers for identifying and working with Radix entity addresses.
 * The entity prefixes come from `lib/entityKinds.ts`, the one list the
 * explorer keeps; transaction hashes are added here.
 */

import { ENTITY_ADDRESS_PREFIXES } from '../lib/entityKinds';

const RADIX_ADDRESS_PREFIXES = [...ENTITY_ADDRESS_PREFIXES, 'txid_'];

/**
 * Returns true if the given string looks like a Radix entity address
 * (i.e. it starts with a known prefix and has a meaningful length).
 */
export function isRadixAddress(q: string): boolean {
    return q.length > 10 && RADIX_ADDRESS_PREFIXES.some(prefix => q.startsWith(prefix));
}
