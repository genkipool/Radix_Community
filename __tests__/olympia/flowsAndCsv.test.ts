import { describe, expect, it } from 'vitest';
import { summarizeFunds } from '@/features/dashboard/explorador/utils/fundsFlow';
import { mergeFunds, movementsToFlowItems } from '@/features/dashboard/explorador/utils/olympiaFlow';
import { olympiaAccountRewardsCsv, olympiaValidatorRewardsCsv } from '@/features/dashboard/explorador/olympia/rewardsCsv';
import { CT_HEADER } from '@/features/dashboard/explorador/utils/coinTrackingCsv';
import { formatDecimal } from '@/features/dashboard/explorador/olympia/format';

const ME = 'rdx1qspme';
const XRD = 'xrd_rr1qy5wfsfh';

describe('Olympia funds flow', () => {
  const moves = [
    { at: '2022-01-02T00:00:00Z', direction: 'in' as const, counterparty: 'rdx1qspa', amount: 100 },
    { at: '2022-03-01T00:00:00Z', direction: 'out' as const, counterparty: 'rdx1qspb', amount: 40 },
    { at: '2022-02-01T00:00:00Z', direction: 'in' as const, counterparty: 'rdx1qspa', amount: 5 },
  ];

  it('becomes funds-flow items the shared maths reads like Babylon ones', () => {
    const flow = summarizeFunds(ME, movementsToFlowItems(ME, XRD, moves), XRD);
    expect(flow.received).toBeCloseTo(105);
    expect(flow.sent).toBeCloseTo(40);
    expect(flow.counterparties.map((c) => c.address)).toEqual(['rdx1qspa', 'rdx1qspb']);
    expect(flow.counterparties[0].txs).toBe(2);
    expect(flow.from).toBe('2022-01-02T00:00:00Z');
    expect(flow.to).toBe('2022-03-01T00:00:00Z');
  });

  it('merges with a Babylon flow without counting anything twice', () => {
    const olympia = summarizeFunds(ME, movementsToFlowItems(ME, XRD, moves), XRD);
    const babylon = {
      counterparties: [{ address: 'account_rdx1x', received: 10, sent: 0, txs: 1, lastAt: '2024-01-01T00:00:00Z' }],
      received: 10, sent: 0, txs: 3, moved: 1, to: '2024-01-01T00:00:00Z', from: '2023-12-01T00:00:00Z',
    };
    const merged = mergeFunds(babylon, olympia);
    expect(merged.received).toBeCloseTo(115);
    expect(merged.txs).toBe(6);
    expect(merged.counterparties).toHaveLength(3);
    expect(merged.from).toBe('2022-01-02T00:00:00Z');
    expect(merged.to).toBe('2024-01-01T00:00:00Z');
  });
});

describe('Olympia rewards CSV', () => {
  const days = [
    { day: '2022-01-02', validatorAddress: 'rv1qb', validatorName: 'B', delegatorXrd: 2, feeXrd: 0 },
    { day: '2022-01-01', validatorAddress: 'rv1qa', validatorName: 'GENKIPOOL', delegatorXrd: 1.5, feeXrd: 0.25 },
  ];

  it('writes the CoinTracking layout of the Babylon account export, sorted by date', () => {
    const { csv, totalXrd } = olympiaAccountRewardsCsv(days);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CT_HEADER.map((h) => `"${h}"`).join(','));
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"Staking","1.50000000","XRD"');
    expect(lines[1]).toContain('Olympia staking reward — GENKIPOOL');
    expect(lines[2]).toContain('Olympia validator fee — GENKIPOOL');
    expect(lines[3]).toContain('"2022-01-02 00:00:00"');
    expect(totalXrd).toBeCloseTo(3.75);
  });

  it('writes the owner fee in the Babylon validator layout', () => {
    const { csv, totalXrd } = olympiaValidatorRewardsCsv('rv1q0rd59efueuu80mg8jedescyg', [
      { day: '2022-01-01', feeXrd: 36, delegatorsXrd: 1764, totalStakeXrd: 1 },
      { day: '2022-01-02', feeXrd: 0, delegatorsXrd: 1, totalStakeXrd: 1 },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Type","Buy","Cur.","Sell","Cur.","Fee","Cur.","Exchange","Group","Comment","Date"');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"36.00000000","XRD"');
    expect(totalXrd).toBe(36);
  });

  it('lists only the delegator rewards or only the validator fee when asked', () => {
    const delegator = olympiaAccountRewardsCsv(days, 'delegator');
    expect(delegator.csv).toContain('Olympia staking reward');
    expect(delegator.csv).not.toContain('Olympia validator fee');
    const validator = olympiaAccountRewardsCsv(days, 'validator');
    expect(validator.csv).toContain('Olympia validator fee');
    expect(validator.csv).not.toContain('Olympia staking reward');
    expect(delegator.totalXrd + validator.totalXrd).toBeCloseTo(olympiaAccountRewardsCsv(days).totalXrd);
  });

  it('is empty when there is nothing to report', () => {
    expect(olympiaAccountRewardsCsv([]).csv).toBe('');
  });
});

describe('formatDecimal', () => {
  it('groups exact decimals without going through a float', () => {
    expect(formatDecimal('2400000000.1', 'en')).toBe('2,400,000,000.1');
    expect(formatDecimal('12660388339.714584', 'es', 2)).toBe('12.660.388.339,71');
    expect(formatDecimal('-5.000', 'en')).toBe('-5');
    expect(formatDecimal('123456789012345678901234.5', 'en', 1)).toBe('123,456,789,012,345,678,901,234.5');
  });
});
