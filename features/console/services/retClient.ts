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

/** Converts an Olympia account/resource address to its Babylon equivalent. */
export const convertOlympiaAddress = async (olympiaAddress: string, network: Network) =>
  postJson<{ babylonAddress: string }>('/api/ret/convert-olympia-address', { olympiaAddress, network })
    .then((res) => res.babylonAddress);
