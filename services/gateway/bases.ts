/**
 * services/gateway/bases.ts
 *
 * Public REST base URLs of the Radix Gateway per network. Kept in a tiny
 * dependency-free module so both server services and client hooks can import
 * it without pulling in the Gateway SDK.
 */

import type { Network } from './client';

export const GATEWAY_BASES: Record<Network, string> = {
  mainnet: 'https://mainnet.radixdlt.com',
  stokenet: 'https://gateway-stokenet.radix.community',
};

/** POST helper for Gateway REST endpoints not wrapped by the SDK. */
export async function gatewayPost<T>(
  network: Network,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${GATEWAY_BASES[network]}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Status and Retry-After travel with the error so withRetry can honour a rate limit.
    const retryAfter = res.headers.get('retry-after');
    throw Object.assign(new Error((data as { message?: string }).message || `Gateway ${res.status}`), {
      status: res.status,
      ...(retryAfter ? { headers: { 'retry-after': retryAfter } } : {}),
    });
  }
  return res.json() as Promise<T>;
}
