/** Public APIs of the DEXes the console reads (mainnet only: none has a Stokenet API). */

/** Ociswap's pool API: the list, and `/{component}` for one pool. */
export const OCISWAP_POOLS_API = 'https://api.ociswap.com/pools';

/** DEXes that publish their pairs as DefiPlaza does. */
export const PAIR_APIS = {
  defiplaza: 'https://radix.defiplaza.net/api/pairs',
  reddicks: 'https://dex.reddicks.meme/api/pairs',
} as const;
