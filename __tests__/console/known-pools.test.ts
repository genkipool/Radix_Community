import { describe, expect, it } from 'vitest';

import { fetchKnownPools } from '@/features/console/lib/known-pools';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/**
 * Two Ociswap pages (one precision pool without a native pool), one DefiPlaza
 * pair, and two Reddicks pairs: its own and a copy of the DefiPlaza one.
 */
function fakeFetch({ failDefiPlaza = false, failReddicks = false } = {}) {
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
    const dfpPair = { baseToken: 'resource_dfp', quoteToken: 'resource_xrd', basePool: 'pool_base', quotePool: 'pool_quote', tvlUSD: 200 };
    if (url === 'https://dex.reddicks.meme/api/pairs') {
      if (failReddicks) return { ok: false, status: 500, json: async () => ({}) };
      return ok({
        data: [
          { baseToken: 'resource_dck', quoteToken: 'resource_xrd', basePool: 'pool_dck', quotePool: 'pool_dck_xrd', tvlUSD: 40 },
          dfpPair,
        ],
      });
    }
    if (failDefiPlaza) return { ok: false, status: 500, json: async () => ({}) };
    return ok({ data: [dfpPair] });
  };
}

const SYMBOLS: Record<string, string> = { resource_dfp: 'DFP2', resource_dck: 'DCK' };

const post = async <T,>(_path: string, body: Record<string, unknown>): Promise<T> =>
  ({
    items: (body.addresses as string[]).map((address) => ({
      address,
      explicit_metadata: { items: [{ key: 'symbol', value: { typed: { value: SYMBOLS[address] ?? 'XRD' } } }] },
    })),
  }) as T;

describe('fetchKnownPools', () => {
  it('merges every DEX, keeps only native pools and sorts by value locked', async () => {
    const pools = await fetchKnownPools(fakeFetch(), post);
    expect(pools.map((p) => [p.address, p.name, p.source])).toEqual([
      ['pool_base', 'DFP2/XRD (DFP2)', 'defiplaza'],
      ['pool_quote', 'DFP2/XRD (XRD)', 'defiplaza'],
      ['pool_b', 'B/XRD', 'ociswap'],
      ['pool_dck', 'DCK/XRD (DCK)', 'reddicks'],
      ['pool_dck_xrd', 'DCK/XRD (XRD)', 'reddicks'],
      ['pool_a', 'A/XRD', 'ociswap'],
    ]);
  });

  it('still answers with the other DEXes when one fails', async () => {
    const withoutDefiPlaza = await fetchKnownPools(fakeFetch({ failDefiPlaza: true }), post);
    // Reddicks' copy of the DefiPlaza pair fills in, under its own name.
    expect(withoutDefiPlaza.map((p) => [p.address, p.source])).toEqual([
      ['pool_base', 'reddicks'],
      ['pool_quote', 'reddicks'],
      ['pool_b', 'ociswap'],
      ['pool_dck', 'reddicks'],
      ['pool_dck_xrd', 'reddicks'],
      ['pool_a', 'ociswap'],
    ]);
    const withoutReddicks = await fetchKnownPools(fakeFetch({ failReddicks: true }), post);
    expect(withoutReddicks.map((p) => p.address)).toEqual(['pool_base', 'pool_quote', 'pool_b', 'pool_a']);
  });
});
