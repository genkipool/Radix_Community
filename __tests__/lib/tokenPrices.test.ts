import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergePrices, parseAstrolescent, parseOciswap, XRD_RESOURCE, type TokenPrices } from '@/services/tokenPrices';
import { resolveTokenFiatPrice } from '@/features/dashboard/hooks/useTokenPrices';
import { totalFiatValue } from '@/features/dashboard/explorador/components/TokenFiatValue';
import { formatFiatPrecise } from '@/utils/currencyUtils';

vi.mock('@/services/marketData', () => ({
  getMarketDataCached: vi.fn(async () => ({ priceUsd: 0.5, priceEur: 0.4 })),
}));

// Shaped like Radix resource addresses; not real tokens.
const A = `resource_rdx1${'q'.repeat(54)}`;
const B = `resource_rdx1${'p'.repeat(54)}`;

describe('parseAstrolescent', () => {
  it('keeps only resource addresses with a finite positive XRD price', () => {
    const out = parseAstrolescent({
      [A]: { tokenPriceXRD: 2.5, name: '<script>' },
      [B]: { tokenPriceXRD: 0 },
      'resource_rdx1bad': { tokenPriceXRD: 3 },
      'not-a-resource': { tokenPriceXRD: 3 },
      [`resource_rdx1${'z'.repeat(54)}`]: { tokenPriceXRD: 'NaN' },
    });
    expect(out).toEqual({ [A]: 2.5 });
  });

  it('ignores bodies that are not an object of tokens', () => {
    expect(parseAstrolescent(null)).toEqual({});
    expect(parseAstrolescent([1, 2])).toEqual({});
    expect(parseAstrolescent('x')).toEqual({});
  });
});

describe('parseOciswap', () => {
  it('reads the XRD price and leaves thin pools out', () => {
    const out = parseOciswap({
      data: [
        { address: A, price: { xrd: { now: '12.5' } }, liquidity: { usd: { now: '50000' } } },
        { address: B, price: { xrd: { now: '99999999' } }, liquidity: { usd: { now: '3' } } },
        { address: 'x', price: { xrd: { now: '1' } } },
      ],
    });
    expect(out).toEqual({ [A]: 12.5 });
  });

  it('drops absurd prices', () => {
    expect(parseOciswap({ data: [{ address: A, price: { xrd: { now: '1e15' } } }] })).toEqual({});
    expect(parseOciswap({})).toEqual({});
  });
});

describe('mergePrices', () => {
  it('prefers Astrolescent, uses Ociswap only for what it lacks, and prices XRD at 1', () => {
    const tokens = mergePrices({ [A]: 2 }, { [A]: 3, [B]: 4 });
    expect(tokens[A]).toEqual({ xrd: 2, src: 'astrolescent' });
    expect(tokens[B]).toEqual({ xrd: 4, src: 'ociswap' });
    expect(tokens[XRD_RESOURCE].xrd).toBe(1);
  });
});

describe('getTokenPrices', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('asks the sources once for requests that arrive together, then serves the copy for a minute', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(
      url.includes('astrolescent') ? JSON.stringify({ [A]: { tokenPriceXRD: 2 } }) : JSON.stringify({ data: [] }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const { getTokenPrices } = await import('@/services/tokenPrices');
    const [one, two] = await Promise.all([getTokenPrices(), getTokenPrices()]);
    await getTokenPrices();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(one).toBe(two);
    expect(one?.tokens[A]).toEqual({ xrd: 2, src: 'astrolescent' });
    expect(one?.xrd).toEqual({ usd: 0.5, eur: 0.4 });
  });

  it('answers null, without retrying at once, when every source fails and there is no copy', async () => {
    const fetchMock = vi.fn(async () => new Response('down', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const { getTokenPrices } = await import('@/services/tokenPrices');
    expect(await getTokenPrices()).toBeNull();
    expect(await getTokenPrices()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('formatFiatPrecise', () => {
  it('keeps four significant digits below one and two decimals above', () => {
    expect(formatFiatPrecise(0.000251234, 'EUR', 'es')).toBe('0,0002512 €');
    expect(formatFiatPrecise(1234.5, 'USD', 'en')).toBe('1,234.50 $');
  });
});

describe('resolveTokenFiatPrice (on-chain LSU pricing)', () => {
  const LSU_LISTED = `resource_rdx1${'a'.repeat(54)}`;
  const LSU_UNLISTED = `resource_rdx1${'c'.repeat(54)}`;
  const prices: TokenPrices = {
    updatedAt: Date.now(),
    stale: false,
    xrd: { usd: 0.05, eur: 0.04 },
    tokens: {
      [XRD_RESOURCE]: { xrd: 1, src: 'astrolescent' },
      [A]: { xrd: 2, src: 'astrolescent' },
      // Stale DEX quote for an LSU that must be ignored in favor of on-chain lsu2xrdFactor
      [LSU_LISTED]: { xrd: 1.209, src: 'astrolescent' },
    },
  };

  it('prices unlisted LSUs from their on-chain lsu2xrdFactor and XRD fiat price', () => {
    expect(resolveTokenFiatPrice({ address: LSU_UNLISTED, isLsu: true, lsu2xrdFactor: 1.05 }, prices, 'EUR')).toEqual({
      unit: 1.05 * 0.04,
      currency: 'EUR',
      source: 'onchain',
    });
  });

  it('ignores stale DEX prices for LSUs and always uses on-chain lsu2xrdFactor', () => {
    expect(resolveTokenFiatPrice({ address: LSU_LISTED, isLsu: true, lsu2xrdFactor: 1.229 }, prices, 'USD')).toEqual({
      unit: 1.229 * 0.05,
      currency: 'USD',
      source: 'onchain',
    });
  });

  it('returns null for LSUs when lsu2xrdFactor is missing instead of falling back to DEX feeds', () => {
    expect(resolveTokenFiatPrice({ address: LSU_LISTED, isLsu: true }, prices, 'USD')).toBeNull();
    expect(resolveTokenFiatPrice({ address: LSU_LISTED, isLsu: true, lsu2xrdFactor: 0 }, prices, 'USD')).toBeNull();
  });

  it('still prices regular tokens from Astrolescent/Ociswap and sums them with LSUs in totalFiatValue', () => {
    const items = [
      { address: A, amount: '10', isLsu: false },
      { address: LSU_LISTED, amount: '100', isLsu: true, lsu2xrdFactor: 1.229 },
      { address: LSU_UNLISTED, amount: '200', isLsu: true, lsu2xrdFactor: 1.0 },
    ];
    const total = totalFiatValue(items, (it) => resolveTokenFiatPrice(it, prices, 'EUR'));
    expect(total).toBeCloseTo(10 * 2 * 0.04 + 100 * 1.229 * 0.04 + 200 * 1.0 * 0.04, 10);
  });
});
