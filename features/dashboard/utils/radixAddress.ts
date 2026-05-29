/**
 * radixAddress.ts
 *
 * Helpers for identifying and working with Radix entity addresses.
 * Centralises the prefix list so it's not duplicated across the codebase.
 */

const RADIX_ADDRESS_PREFIXES = [
    'account_',
    'component_',
    'resource_',
    'package_',
    'txid_',
    'validator_',
    'identity_',
    'consensusmanager_',
    'transactiontracker_',
] as const;

/**
 * Returns true if the given string looks like a Radix entity address
 * (i.e. it starts with a known prefix and has a meaningful length).
 */
export function isRadixAddress(q: string): boolean {
    return q.length > 10 && RADIX_ADDRESS_PREFIXES.some(prefix => q.startsWith(prefix));
}
