// @vitest-environment node
/**
 * An Olympia account at a past state version: balances read from whichever
 * side of the version is shorter give the same answer, and stakes are valued
 * at the validator's XRD per unit at that version.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const E18 = 10n ** 18n;
const pq = vi.hoisted(() => ({
  countEqWithin: vi.fn(),
  readEq: vi.fn(),
  readEqWithin: vi.fn(),
  readEqCovering: vi.fn(),
}));
vi.mock('@/services/olympia/parquet', async (orig) => ({ ...(await orig<typeof import('@/services/olympia/parquet')>()), ...pq }));
vi.mock('@/services/olympia/catalog', () => ({
  tokenCatalog: async () => new Map([['xrd_rr1qy5wfsfh', { rri: 'xrd_rr1qy5wfsfh', symbol: 'XRD', name: 'Radix', iconUrl: null }]]),
  validatorCatalog: async () => new Map([['rv1a', { address: 'rv1a', name: 'Node A', totalXrdStaked: 0, publicKey: null }]]),
}));

import { getAccountStateAt, olympiaDayRange, versionAtDayEnd } from '@/services/olympia/history';

const ref = { id: 9n, address: 'rdx1acc', babylonAddress: 'account_rdx1acc', publicKey: '', firstSeenStateVersion: 1 };
const XRD = 'xrd_rr1qy5wfsfh';
const TOK = 'tok_rr1x';
// History: v10 +100 XRD, v20 +5 TOK, v30 -40 XRD, v40 -5 TOK (gone at the end). Final: 60 XRD.
const changes = [
  { state_version: 10n, rri: XRD, delta: String(100n * E18), balance_after: String(100n * E18) },
  { state_version: 20n, rri: TOK, delta: String(5n * E18), balance_after: String(5n * E18) },
  { state_version: 30n, rri: XRD, delta: String(-40n * E18), balance_after: String(60n * E18) },
  { state_version: 40n, rri: TOK, delta: String(-5n * E18), balance_after: '0' },
];
const within = (_p: string, _k: string, _key: unknown, _o: string, lo: bigint, hi: bigint) =>
  Promise.resolve(changes.filter((c) => c.state_version >= lo && c.state_version <= hi));

beforeEach(() => {
  Object.values(pq).forEach((f) => f.mockReset());
  pq.readEqWithin.mockImplementation(within);
  pq.readEq.mockResolvedValue([{ rri: XRD, balance: String(60n * E18) }]);
  pq.readEqCovering.mockResolvedValue([]);
});

describe('getAccountStateAt', () => {
  it.each([
    ['before', 1, 9],
    ['after', 9, 1],
  ])('gives the same balances reading the %s side', async (_side, before, after) => {
    pq.countEqWithin.mockImplementation(async (_p: string, _k: string, _key: unknown, _o: string, lo: bigint) => (lo === 0n ? before : after));
    const at25 = await getAccountStateAt(ref, 25);
    expect(at25.xrd?.amount).toBe('100');
    expect(at25.tokens.map((t) => [t.rri, t.amount])).toEqual([[TOK, '5']]);
    const at35 = await getAccountStateAt(ref, 35);
    expect(at35.xrd?.amount).toBe('60');
    const at5 = await getAccountStateAt(ref, 5);
    expect(at5.xrd).toBeNull();
    expect(at5.tokens).toEqual([]);
    const at45 = await getAccountStateAt(ref, 45);
    expect(at45.tokens).toEqual([]);
  });

  it('values stake units at the validator rate of that version, unstaking units included in the pool', async () => {
    pq.countEqWithin.mockResolvedValue(0);
    pq.readEqCovering.mockImplementation(async (path: string) => (path.includes('account_stake')
      ? [{ validator_id: 1n, validator_address: 'rv1a', total_stake_units: String(10n * E18), total_prepared_xrd_stake: String(2n * E18), total_prepared_unstake_units: String(4n * E18), total_exiting_xrd_stake: String(3n * E18) }]
      // 300 XRD backing 150 + 50 units: 1.5 XRD per unit.
      : [{ total_xrd_staked: String(300n * E18), total_stake_units: String(150n * E18), total_prepared_unstake_units: String(50n * E18) }]));
    const a = await getAccountStateAt(ref, 25, '2022-01-01');
    expect(a.day).toBe('2022-01-01');
    expect(a.stakes).toEqual([{ validatorAddress: 'rv1a', validatorName: 'Node A', stakedXrd: 15, pendingStakeXrd: 2, pendingUnstakeXrd: 6, exitingXrd: 3 }]);
    expect(a.totals).toMatchObject({ stakedXrd: 15, pendingStakeXrd: 2, unstakingXrd: 9 });
  });
});

describe('days of Olympia', () => {
  it('maps a day to its last state version and nothing outside Olympia', () => {
    expect(olympiaDayRange()).toEqual({ first: '2021-07-26', last: '2023-09-28' });
    expect(versionAtDayEnd('2023-09-28')).toBe(337_759_839);
    expect(versionAtDayEnd('2021-07-25')).toBeNull();
    expect(versionAtDayEnd('2023-09-29')).toBeNull();
    expect(versionAtDayEnd('2022-06-15')! < versionAtDayEnd('2022-06-16')!).toBe(true);
  });
});
