/**
 * Browser-side helpers for the Radix Engine Toolkit API routes.
 */

import type { Network } from '@/services/gateway/client';

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Decodes a hex-encoded RPD package definition into manifest SBOR syntax. */
export const sborDecodeSchema = async (hexEncodedSchema: string, network: Network) =>
  postJson<{ decodedString: string }>('/api/ret/sbor-decode', { hexEncodedSchema, network })
    .then((res) => res.decodedString);

export interface OlympiaConversionResult {
  kind: 'account' | 'resource';
  babylonAddress: string;
  /** Compressed secp256k1 public key from the Olympia address (accounts only). */
  publicKeyHex?: string;
}

/** Converts an Olympia account/resource address to its Babylon equivalent. */
export const convertOlympiaAddress = async (olympiaAddress: string, network: Network) =>
  postJson<OlympiaConversionResult>('/api/ret/convert-olympia-address', { olympiaAddress, network });

export type OlympiaReverseResult =
  | { ok: true; olympiaAddress: string; publicKeyHex: string }
  | { ok: false; reason: 'no-transactions' | 'not-found' | 'error' };

/**
 * Resolves the Olympia address of a legacy Babylon account by recovering its
 * public key from on-ledger signatures. Fails when the account never signed
 * a Babylon transaction.
 */
export async function olympiaAddressFromBabylon(
  babylonAddress: string,
  network: Network,
): Promise<OlympiaReverseResult> {
  const res = await fetch('/api/ret/olympia-from-babylon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ babylonAddress, network }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { reason?: string };
    return {
      ok: false,
      reason: data.reason === 'no-transactions' || data.reason === 'not-found' ? data.reason : 'error',
    };
  }
  const data = (await res.json()) as { olympiaAddress: string; publicKeyHex: string };
  return { ok: true, ...data };
}
