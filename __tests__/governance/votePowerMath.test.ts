import { describe, expect, it } from 'vitest';
import {
    BigNumber,
    convertToXrd,
    I192,
    lsuHoldingsXrd,
    lsulpRate,
    lsuToXrd,
    poolUnitPositionXrd,
    poolUnitValues,
    precisionPositionXrd,
    removableAmounts,
    shapeClaimsXrd,
    TickDecimal,
    tickToPriceSqrt,
    type ShapePoolState,
    type XrdRates,
} from '@/features/governance/lib/votePowerMath';
import { findEpoch, LSULP_RESOURCE_ADDRESS, XRD_ADDRESS, type VotePowerSourceConfig } from '@/features/governance/lib/votePowerPools';

// Synthetic resources: not ledger addresses.
const LSU_A = 'resource_test_lsu_a';
const LSU_B = 'resource_test_lsu_b';
const OTHER = 'resource_test_other';

const rates: XrdRates = { lsuRedemption: { [LSU_A]: '1', [LSU_B]: '1.005' }, lsulpRate: '1.5' };

describe('LSU and LSULP conversion', () => {
    it('multiplies LSU by its redemption value exactly', () => {
        expect(lsuToXrd('1.1', '10')).toBe('11');
        expect(lsuToXrd('1.000000000000000001', '3')).toBe('3.000000000000000003');
    });

    it('divides the LSULP valuation at 20 decimals, half up, and falls back to 0', () => {
        expect(lsulpRate('300', '200')).toBe('1.5');
        expect(lsulpRate('1', '3')).toBe('0.33333333333333333333');
        expect(lsulpRate('2', '3')).toBe('0.66666666666666666667');
        expect(lsulpRate('1', '0')).toBe('0');
        expect(lsulpRate('0', null)).toBe('0');
    });

    it('converts XRD as is, LSU and LSULP by rate, anything else to 0', () => {
        expect(convertToXrd(XRD_ADDRESS, '12.5', rates)).toBe('12.5');
        expect(convertToXrd(LSULP_RESOURCE_ADDRESS, '2', rates)).toBe('3');
        expect(convertToXrd(LSU_B, '10', rates)).toBe('10.05');
        expect(convertToXrd(OTHER, '99', rates)).toBe('0');
    });

    it('rounds each held LSU resource to 2 decimals, half up, and ignores other tokens', () => {
        const total = lsuHoldingsXrd({ [LSU_A]: '10.004', [LSU_B]: '1', [XRD_ADDRESS]: '7', [OTHER]: '5' }, rates);
        // 10.004 -> 10.00, 1.005 -> 1.01
        expect(total.toFixed()).toBe('11.01');
    });
});

describe('pool unit positions', () => {
    it('values a pool unit at 20 decimals and keeps the rounding through the position', () => {
        const values = poolUnitValues([{ resource: XRD_ADDRESS, amount: '100' }, { resource: OTHER, amount: '50' }], '3');
        expect(values).toEqual([
            { resource: XRD_ADDRESS, value: '33.33333333333333333333' },
            { resource: OTHER, value: '16.66666666666666666667' },
        ]);
        // 3 units of 1/3 of the XRD: not 100, the collector's digits.
        expect(poolUnitPositionXrd('3', values, rates).toFixed()).toBe('99.99999999999999999999');
    });

    it('converts LSU and LSULP inside a pool and gives 0 without supply or units', () => {
        const values = poolUnitValues([{ resource: LSU_B, amount: '4' }, { resource: LSULP_RESOURCE_ADDRESS, amount: '2' }], '2');
        // 1.5 units -> 3 LSU_B (x1.005) + 1.5 LSULP (x1.5)
        expect(poolUnitPositionXrd('1.5', values, rates).toFixed()).toBe('5.265');
        expect(poolUnitValues([{ resource: XRD_ADDRESS, amount: '1' }], '0')).toEqual([{ resource: XRD_ADDRESS, value: '0' }]);
        expect(poolUnitPositionXrd('0', values, rates).isZero()).toBe(true);
    });
});

describe('Ociswap precision positions', () => {
    const d = (v: string | number) => new TickDecimal(v);

    it('splits liquidity by where the price sits in the range', () => {
        const amounts = (price: number) => removableAmounts(d(100), d(price), d(1), d(4), 18, 18).map(x => x.toString());
        expect(amounts(2)).toEqual(['25', '100']);
        expect(amounts(0.5)).toEqual(['75', '0']);
        expect(amounts(5)).toEqual(['0', '300']);
    });

    it('floors each amount to the token divisibility', () => {
        const [x, y] = removableAmounts(d(1), d(3), d(1), d(4), 2, 18);
        expect(x.toString()).toBe('0.08');
        expect(y.toString()).toBe('2');
    });

    it('maps ticks to square-root prices and skips empty positions', () => {
        expect(tickToPriceSqrt(0).toString()).toBe('1');
        expect(tickToPriceSqrt(2).eq(d('1.000049998750062496094023416993798697').pow(2))).toBe(true);
        const pool = { token_x: XRD_ADDRESS, token_y: OTHER, divisibility_x: 18, divisibility_y: 18 };
        expect(precisionPositionXrd({ liquidity: '0', leftBound: -10, rightBound: 10 }, '1', pool, rates)).toBeNull();
        // Price below the range: everything is token x (XRD here).
        const v = precisionPositionXrd({ liquidity: '100', leftBound: 0, rightBound: 0 }, '0.5', pool, rates);
        expect(v?.toFixed()).toBe('0');
    });
});

describe('CaviarNine shape positions', () => {
    it('truncates like Scrypto Decimal at 18 places toward zero', () => {
        expect(new I192('1').divide('3').toString()).toBe('0.333333333333333333');
        expect(new I192('1').divide('3').multiply('3').toString()).toBe('0.999999999999999999');
        expect(new I192('-1').divide('3').toString()).toBe('-0.333333333333333333');
        expect(new I192('5').divide('0').isZero()).toBe(true);
    });

    const pool: ShapePoolState = {
        token_x: XRD_ADDRESS,
        token_y: LSU_A,
        currentTick: 10,
        activeX: '6',
        activeY: '9',
        activeTotalClaim: '3',
        bins: { '5': { amount: '30', totalClaim: '3' }, '15': { amount: '10', totalClaim: '4' } },
    };
    const lsu2: XrdRates = { lsuRedemption: { [LSU_A]: '2' }, lsulpRate: '0' };

    it('takes y below the active bin, x above, both in it, and skips bins it cannot find', () => {
        const xrd = shapeClaimsXrd([[5, '1'], [15, '1'], [10, '1'], [20, '1']], pool, lsu2);
        // x = 2.5 + 6/3 (1.999999999999999998) ; y = 30/3 (9.99999999999999999) + 9/3 (2.999999999999999997), LSU x2
        expect(xrd.toFixed()).toBe('30.499999999999999972');
    });

    it('is worth nothing without an active bin', () => {
        expect(shapeClaimsXrd([[5, '1']], { ...pool, currentTick: undefined }, lsu2).isZero()).toBe(true);
    });
});

describe('source epochs', () => {
    const epoch = (iso: string): VotePowerSourceConfig => ({
        effectiveFrom: new Date(iso), sources: new Set(['xrd']), precisionPoolsV1: [], precisionPoolsV2: [], poolUnitPools: [], shapePools: [],
    });
    const epochs = [epoch('2026-06-01T00:00:00Z'), epoch('2025-01-01T00:00:00Z')];

    it('picks the newest epoch already in force, else the oldest', () => {
        expect(findEpoch(epochs, new Date('2026-07-01T00:00:00Z'))).toBe(epochs[0]);
        expect(findEpoch(epochs, new Date('2026-05-31T23:59:59Z'))).toBe(epochs[1]);
        expect(findEpoch(epochs, new Date('2024-01-01T00:00:00Z'))).toBe(epochs[1]);
    });

    it('uses BigNumber with the collector defaults', () => {
        expect(new BigNumber(2).dividedBy(3).toFixed()).toBe('0.66666666666666666667');
    });
});
