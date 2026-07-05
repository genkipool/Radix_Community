import { describe, it, expect } from 'vitest';
import { mapHoldings } from '@/features/console/lib/account-holdings';

const RESOURCE = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const NFT_RESOURCE = 'resource_rdx1nt2q2rks2xgus6etcpeq4c8ysuj0l5pwhs9r3cxw6qtly5kxqddp2e';

const metadata = {
  items: [
    { key: 'name', value: { typed: { type: 'String', value: 'Radix' } } },
    { key: 'symbol', value: { typed: { type: 'String', value: 'XRD' } } },
  ],
};

describe('mapHoldings', () => {
  it('sums vault amounts with Vault aggregation', () => {
    const holdings = mapHoldings({
      fungible_resources: {
        items: [
          {
            resource_address: RESOURCE,
            explicit_metadata: metadata,
            vaults: {
              items: [
                { vault_address: 'internal_vault_rdx1aaa', amount: '23.5' },
                { vault_address: 'internal_vault_rdx1bbb', amount: '1.5' },
              ],
            },
          },
        ],
      },
      non_fungible_resources: {
        items: [
          {
            resource_address: NFT_RESOURCE,
            vaults: {
              items: [{ vault_address: 'internal_vault_rdx1ccc', total_count: 2, items: ['#1#', '#2#'] }],
            },
          },
        ],
      },
    });

    expect(holdings.fungibles).toHaveLength(1);
    expect(holdings.fungibles[0].amount).toBe('25');
    expect(holdings.fungibles[0].symbol).toBe('XRD');
    expect(holdings.nonFungibles[0].ids).toEqual(['#1#', '#2#']);
  });

  // Gateway responses with the default (Global) aggregation carry the amount
  // on the resource item itself and no vaults — the amount must not become 0.
  it('falls back to the item amount with Global aggregation', () => {
    const holdings = mapHoldings({
      fungible_resources: {
        items: [
          { resource_address: RESOURCE, explicit_metadata: metadata, amount: '23.99128174581' },
        ],
      },
      non_fungible_resources: { items: [{ resource_address: NFT_RESOURCE, amount: 6 }] },
    });

    expect(holdings.fungibles[0].amount).toBe('23.99128174581');
    expect(holdings.nonFungibles[0].ids).toEqual([]);
  });

  it('handles empty and missing resource lists', () => {
    expect(mapHoldings({})).toEqual({ fungibles: [], nonFungibles: [] });
    expect(mapHoldings({ fungible_resources: { items: [] } }).fungibles).toEqual([]);
  });
});
