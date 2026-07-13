/**
 * services/ret/index.ts
 *
 * Shared Radix Engine Toolkit (RET) helpers.
 * Used by: app/api/ret/* routes and the MCP console tools.
 */

import {
  ManifestSborStringRepresentation,
  OlympiaNetwork,
  RadixEngineToolkit,
  SerializationMode,
} from '@radixdlt/radix-engine-toolkit';
import type { Network } from '@/services/gateway/client';

const NETWORK_IDS: Record<Network, number> = { mainnet: 1, stokenet: 2 };

export const networkIdFromName = (network: Network): number => NETWORK_IDS[network];

export interface ManifestValidation {
  valid: boolean;
  error?: string;
}

/** Extracts the human-relevant reason from a RET invocation error message. */
function extractError(message: string): string {
  const match = message.match(/"error":\s*"((?:[^"\\]|\\.)*)"/);
  return match ? match[1].replace(/\\"/g, '"') : message.slice(0, 300);
}

/** Statically validates a transaction manifest for the given network. */
export async function staticallyValidateManifest(
  manifest: string,
  network: Network,
): Promise<ManifestValidation> {
  try {
    // Patch V2 Subintent instructions before validation since RET TS v1.0.6 parser rejects them
    const safeManifest = manifest.replace(/YIELD_TO_PARENT\s*;/g, '');

    const result = await RadixEngineToolkit.Instructions.staticallyValidate(
      { kind: 'String', value: safeManifest },
      networkIdFromName(network),
    );
    if (result.kind === 'Valid') return { valid: true };
    return { valid: false, error: (result as { error?: string }).error ?? 'Invalid manifest' };
  } catch (err) {
    // Parse errors are thrown by RET — surface the reason as a validation failure
    return {
      valid: false,
      error: extractError(err instanceof Error ? err.message : String(err)),
    };
  }
}

/**
 * Converts an Olympia (pre-Babylon) address to its Babylon equivalent:
 * `_rr1` resource addresses map to resources, the rest to virtual accounts.
 * Throws on malformed input.
 */
export async function convertOlympiaAddress(
  olympiaAddress: string,
  network: Network,
): Promise<string> {
  const networkId = networkIdFromName(network);
  return olympiaAddress.toLowerCase().includes('_rr1')
    ? RadixEngineToolkit.Derive.resourceAddressFromOlympiaResourceAddress(olympiaAddress, networkId)
    : RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(olympiaAddress, networkId);
}

export interface OlympiaConversion {
  kind: 'account' | 'resource';
  babylonAddress: string;
  /** Compressed secp256k1 public key encoded in the Olympia address (accounts only). */
  publicKeyHex?: string;
}

/**
 * Converts an Olympia address to Babylon and, for account addresses, also
 * extracts the compressed secp256k1 public key embedded in the address
 * (needed to build the legacy-wallet import QR payload). Throws on malformed input.
 */
export async function convertOlympiaAddressDetailed(
  olympiaAddress: string,
  network: Network,
): Promise<OlympiaConversion> {
  const networkId = networkIdFromName(network);
  if (olympiaAddress.toLowerCase().includes('_rr1')) {
    const babylonAddress = await RadixEngineToolkit.Derive.resourceAddressFromOlympiaResourceAddress(
      olympiaAddress,
      networkId,
    );
    return { kind: 'resource', babylonAddress };
  }
  const [babylonAddress, publicKey] = await Promise.all([
    RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(olympiaAddress, networkId),
    RadixEngineToolkit.Derive.publicKeyFromOlympiaAccountAddress(olympiaAddress),
  ]);
  return {
    kind: 'account',
    babylonAddress,
    publicKeyHex: Buffer.from(publicKey).toString('hex'),
  };
}

/** Encodes a compressed secp256k1 public key as an Olympia account address. */
export async function olympiaAddressFromPublicKeyHex(
  publicKeyHex: string,
  network: Network = 'mainnet',
): Promise<string> {
  return RadixEngineToolkit.Derive.olympiaAccountAddressFromPublicKey(
    Buffer.from(publicKeyHex, 'hex'),
    network === 'stokenet' ? OlympiaNetwork.Stokenet : OlympiaNetwork.Mainnet,
  );
}

/* ─── SBOR decoding ───────────────────────────────────────────────────────── */

const SCRYPTO_SBOR_PREFIX = 0x5c;
const MANIFEST_SBOR_PREFIX = 0x4d;

export interface SborDecodeResult {
  kind: 'scrypto' | 'manifest';
  decoded: string;
}

/**
 * Decodes a hex-encoded SBOR payload (state, events, schemas), auto-detecting
 * Scrypto vs Manifest SBOR from the prefix byte. Throws on unknown prefixes
 * or malformed payloads.
 */
export async function decodeSborHex(hex: string, network: Network): Promise<SborDecodeResult> {
  const networkId = networkIdFromName(network);
  const bytes = Buffer.from(hex, 'hex');

  if (bytes[0] === SCRYPTO_SBOR_PREFIX) {
    const decoded = await RadixEngineToolkit.ScryptoSbor.decodeToString(
      bytes,
      networkId,
      SerializationMode.Programmatic,
    );
    return { kind: 'scrypto', decoded };
  }
  if (bytes[0] === MANIFEST_SBOR_PREFIX) {
    const decoded = await RadixEngineToolkit.ManifestSbor.decodeToString(
      bytes,
      networkId,
      ManifestSborStringRepresentation.ManifestString,
    );
    return { kind: 'manifest', decoded };
  }
  throw new Error('Unknown SBOR prefix');
}
