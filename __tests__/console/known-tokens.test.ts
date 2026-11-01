import { describe, expect, it } from 'vitest';

import { fetchKnownTokens } from '@/features/console/lib/known-tokens';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = { ok: false, status: 500, json: async () => ({}) };

/** Two Ociswap pages, a fake HUG traded less than the real one, and one DefiPlaza pair. */
function fakeFetch({ failOciswap = false, failDefiPlaza = false } = {}) {
  return async (url: string) => {
    if (url.startsWith('https://api.ociswap.com/tokens')) {
      if (failOciswap) return fail;
      return url.includes('cursor=2')
        ? ok({ data: [{ address: 'resource_fake_hug', symbol: 'HUG', volume: { xrd: { '7d': '5' } } }], next_cursor: null })
        : ok({
            data: [
              { address: 'resource_hug', symbol: 'HUG', volume: { xrd: { '7d': '80000' } } },
              { address: 'resource_oci', symbol: 'oci', volume: { xrd: { '7d': '100' } } },
            ],
            next_cursor: 2,
          });
    }
    if (failDefiPlaza) return fail;
    return ok({ data: [{ baseToken: 'resource_dfp', quoteToken: 'resource_hug_dfp', tvlUSD: 900 }] });
  };
}

const SYMBOLS: Record<string, string> = { resource_dfp: 'DFP2', resource_hug_dfp: 'HUG' };
const post = async <T,>(_path: string, body: Record<string, unknown>): Promise<T> =>
  ({
    items: (body.addresses as string[]).map((address) => ({
      address,
      explicit_metadata: { items: [{ key: 'symbol', value: { typed: { value: SYMBOLS[address] } } }] },
    })),
  }) as T;

describe('fetchKnownTokens', () => {
  it('takes the most traded token for each symbol, Ociswap first, DefiPlaza filling the gaps', async () => {
    expect(await fetchKnownTokens(fakeFetch(), post)).toEqual({
      HUG: 'resource_hug',
      OCI: 'resource_oci',
      DFP2: 'resource_dfp',
    });
  });

  it('keeps working with one source down', async () => {
    expect(await fetchKnownTokens(fakeFetch({ failOciswap: true }), post)).toEqual({ HUG: 'resource_hug_dfp', DFP2: 'resource_dfp' });
    expect(await fetchKnownTokens(fakeFetch({ failDefiPlaza: true }), post)).toEqual({ HUG: 'resource_hug', OCI: 'resource_oci' });
  });
});
