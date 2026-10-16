import { describe, expect, it } from 'vitest';

import { fetchKnownPools } from '@/features/console/lib/known-pools';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** Two Ociswap pages (one precision pool without a native pool) and one DefiPlaza pair. */
function fakeFetch(failDefiPlaza = false) {
  return async (url: string) => {
    if (url.startsWith('https://api.ociswap.com/pools')) {
      return url.includes('cursor=2')
        ? ok({ data: [{ name: 'B/XRD', liquidity_pool_address: 'pool_b', total_value_locked: { usd: { now: '50' } } }], next_cursor: null })
        : ok({
            data: [
              { name: 'A/XRD', liquidity_pool_address: 'pool_a', total_value_locked: { usd: { now: '10' } } },
              { name: 'Precision', liquidity_pool_address: null },
            ],
            next_cursor: 2,
          });
    }
    if (failDefiPlaza) return { ok: false, status: 500, json: async () => ({}) };
    return ok({ data: [{ baseToken: 'resource_dfp', quoteToken: 'resource_xrd', basePool: 'pool_base', quotePool: 'pool_quote', tvlUSD: 200 }] });
  };
}

const post = async <T,>(_path: string, body: Record<string, unknown>): Promise<T> =>
  ({
    items: (body.addresses as string[]).map((address) => ({
      address,
      explicit_metadata: { items: [{ key: 'symbol', value: { typed: { value: address === 'resource_dfp' ? 'DFP2' : 'XRD' } } }] },
    })),
  }) as T;

describe('fetchKnownPools', () => {
  it('merges both DEXes, keeps only native pools and sorts by value locked', async () => {
    const pools = await fetchKnownPools(fakeFetch(), post);
    expect(pools.map((p) => [p.address, p.name, p.source])).toEqual([
      ['pool_base', 'DFP2/XRD (DFP2)', 'defiplaza'],
      ['pool_quote', 'DFP2/XRD (XRD)', 'defiplaza'],
      ['pool_b', 'B/XRD', 'ociswap'],
      ['pool_a', 'A/XRD', 'ociswap'],
    ]);
  });

  it('still answers with one DEX when the other fails', async () => {
    const pools = await fetchKnownPools(fakeFetch(true), post);
    expect(pools.map((p) => p.address)).toEqual(['pool_b', 'pool_a']);
  });
});
