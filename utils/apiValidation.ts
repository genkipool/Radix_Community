/**
 * utils/apiValidation.ts
 *
 * Input validation helpers for Next.js API routes.
 * Prevents malformed inputs from reaching the Gateway and poisoning the cache.
 */

/** Valid Radix network values */
const VALID_NETWORKS = new Set(['mainnet', 'stokenet']);

/** Radix address prefixes and HRPs per network */
const ADDRESS_PREFIXES = [
    'account_', 'component_', 'resource_', 'validator_',
    'package_', 'identity_', 'consensusmanager',
    'txid_', 'transactionintent_',
];

const HRP_MAP = {
    mainnet: 'rdx',
    stokenet: 'tdx_2_',
} as const;

/** Transaction hash prefixes */
const HASH_PREFIXES = ['txid_', 'transactionintent_'];

/** Max safe length for any address/hash parameter */
const MAX_PARAM_LENGTH = 256;

/**
 * Validates that a network string is one of the known Radix networks.
 * Falls back to 'mainnet' for unknown values (never errors).
 */
export function validateNetwork(value: string | null): 'mainnet' | 'stokenet' {
    return VALID_NETWORKS.has(value ?? '') ? (value as 'mainnet' | 'stokenet') : 'mainnet';
}

/**
 * Validates a Radix entity address (account, component, resource, validator, etc.).
 * Returns null if the address is invalid — caller should return 400.
 */
export function validateAddress(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') return null;
    if (value.length > MAX_PARAM_LENGTH) return null;
    // Only allow alphanumeric + underscore (Bech32-ish charset for Radix addresses)
    if (!/^[a-z0-9_]+$/.test(value)) return null;
    if (!ADDRESS_PREFIXES.some(p => value.startsWith(p))) return null;
    return value;
}

/**
 * Verifies if an address belongs to the specified network by checking its HRP suffix.
 * Example: validator_rdx... matches 'mainnet'.
 *          validator_tdx_2_... matches 'stokenet'.
 */
export function isValidAddressForNetwork(address: string, network: 'mainnet' | 'stokenet' = 'mainnet'): boolean {
    const hrp = HRP_MAP[network];
    // Check if the address contains the network HRP in the correct position
    // Radix addresses format: <prefix>_<hrp><suffix>
    // Example: validator_rdx1... (mainnet) or validator_tdx_2_1... (stokenet)
    return address.includes(`_${hrp}`);
}

/**
 * Validates a transaction intent hash.
 * Returns null if invalid — caller should return 400.
 */
export function validateTxHash(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') return null;
    if (value.length > MAX_PARAM_LENGTH) return null;
    if (!/^[a-z0-9_]+$/.test(value)) return null;
    if (!HASH_PREFIXES.some(p => value.startsWith(p))) return null;
    return value;
}

/**
 * Validates a pagination cursor — opaque string from the Gateway.
 * Just checks length and charset to prevent injection.
 */
export function validateCursor(value: string | null | undefined): string | undefined {
    if (!value || typeof value !== 'string') return undefined;
    if (value.length > 512) return undefined;
    // Cursors are base64url or hex strings from the Gateway
    if (!/^[A-Za-z0-9+/=_-]+$/.test(value)) return undefined;
    return value;
}

/**
 * Clamps a page limit to a safe range.
 */
export function validateLimit(value: string | null, min = 1, max = 100, defaultVal = 15): number {
    const n = parseInt(value ?? '', 10);
    if (isNaN(n)) return defaultVal;
    return Math.min(Math.max(n, min), max);
}
