/**
 * services/gateway/knownAddresses.ts
 *
 * Well-known addresses of a network (XRD, native packages, faucet, pool
 * package, system badges, …) from `/status/network-configuration`.
 * Server-side counterpart of features/console/hooks/useKnownAddresses.ts.
 */

import { cacheLife, cacheTag } from 'next/cache';
import type { Network } from './client';
import { gatewayPost } from './bases';

export type KnownAddresses = Record<string, string>;

export async function fetchKnownAddresses(network: Network): Promise<KnownAddresses> {
  'use cache';
  cacheLife('days');
  cacheTag('known-addresses', `known-addresses-${network}`);

  const data = await gatewayPost<{ well_known_addresses?: KnownAddresses }>(
    network,
    '/status/network-configuration',
    {},
  );
  return data.well_known_addresses ?? {};
}
