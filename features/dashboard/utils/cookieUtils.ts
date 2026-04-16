/**
 * features/dashboard/utils/cookieUtils.ts
 *
 * Utilities for handling dynamic, network-aware cookie names.
 * This prevents data leakage (and Gateway 400 errors) when switching networks.
 */

/**
 * Returns a network-specific cookie key.
 * Example: getNetworkCookieKey('dashboard_expanded_txs', 'mainnet') 
 *          -> 'dashboard_expanded_txs_mainnet'
 */
export function getNetworkCookieKey(baseKey: string, network: string): string {
  // If the key already has a network suffix, don't double it
  if (baseKey.endsWith(`_${network}`)) return baseKey;
  return `${baseKey}_${network}`;
}
