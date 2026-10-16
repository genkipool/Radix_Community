import { describe, expect, it } from 'vitest';
import {
  distribute,
  distributionToCsv,
  fetchAllHolders,
  filterHolders,
  holderKind,
  holderStats,
  holdersToCsv,
} from '@/features/console/lib/resource-holders';
import { sumDecimals } from '@/features/console/lib/decimal';

const H = [
  { address: 'account_rdx1aaa', amount: '600' },
  { address: 'pool_rdx1bbb', amount: '300' },
  { address: 'account_rdx1ccc', amount: '99.5' },
  { address: 'account_rdx1ddd', amount: '0.5' },
];

describe('fetchAllHolders', () => {
  it('follows the cursor until the last page', async () => {
    const pages = [
      { total_count: 3, next_cursor: 'c1', items: [{ holder_address: 'account_rdx1a', amount: '5' }] },
      { total_count: 3, items: [{ holder_address: 'account_rdx1b', amount: '3' }, { holder_address: 'account_rdx1c', non_fungible_ids_count: 2 }] },
    ];
    const seen: unknown[] = [];
    const post = async <T,>(_path: string, body: Record<string, unknown>) => {
      seen.push(body.cursor);
      return pages.shift() as T;
    };
    const { holders, total, truncated } = await fetchAllHolders(post, 'resource_rdx1x');
    expect(seen).toEqual([undefined, 'c1']);
    expect(holders.map((h) => h.amount)).toEqual(['5', '3', '2']);
    expect(total).toBe(3);
    expect(truncated).toBe(false);
  });
});

describe('holder analysis', () => {
  it('classifies holders by address', () => {
    expect(holderKind('pool_rdx1x')).toBe('pool');
    expect(holderKind('locker_rdx1x')).toBe('locker');
    expect(holderKind('component_rdx1x')).toBe('component');
  });

  it('filters by kind, minimum and exclusions', () => {
    expect(filterHolders(H, { kinds: ['account'], minAmount: 1, exclude: ['account_rdx1aaa'] })).toEqual([H[2]]);
  });

  it('measures concentration', () => {
    const stats = holderStats(H);
    expect(stats.total).toBe('1000');
    expect(stats.top1Share).toBeCloseTo(0.6);
    expect(stats.byKind.account).toBe(3);
  });

  it('exports CSV', () => {
    expect(holdersToCsv(H.slice(0, 1))).toBe('address,amount\naccount_rdx1aaa,600\n');
  });
});

describe('distribute', () => {
  it('splits equally without ever exceeding the pot', () => {
    const rows = distribute(H.slice(0, 3), '100', 'equal', 2);
    expect(rows.map((r) => r.amount)).toEqual(['33.33', '33.33', '33.33']);
  });

  it('splits in proportion to holdings', () => {
    const rows = distribute(H, '1000', 'proportional', 18);
    expect(rows.map((r) => r.amount)).toEqual(['600', '300', '99.5', '0.5']);
    expect(Number(sumDecimals(rows.map((r) => r.amount)))).toBeLessThanOrEqual(1000);
  });

  it('drops shares that truncate to zero at the divisibility', () => {
    expect(distribute(H, '10', 'proportional', 0).map((r) => r.address)).toEqual(['account_rdx1aaa', 'pool_rdx1bbb']);
  });

  it('writes the bulk-sender CSV', () => {
    expect(distributionToCsv([{ address: 'account_rdx1a', amount: '1' }], 'resource_rdx1r')).toBe(
      'account,resource,amount\naccount_rdx1a,resource_rdx1r,1\n',
    );
  });
});
