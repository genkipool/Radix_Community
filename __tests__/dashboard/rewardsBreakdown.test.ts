import { describe, expect, it } from 'vitest';
import {
    computeFiatChangePct,
    formatSignedCurrency,
    formatSignedPercent,
    mergeDailyRewards,
    summarizeYearRewards,
} from '@/features/dashboard/explorador/utils/rewardsBreakdown';
import { lookupXrdFiatPrice, type XrdDailyPricesMap } from '@/features/dashboard/hooks/useXrdDailyPrices';

const SAMPLE_PRICES: XrdDailyPricesMap = {
    '2025-01-10': [0.02, 0.018],
    '2025-01-11': [0.025, 0.022],
    '2025-02-01': [0.03, 0.027],
};

describe('lookupXrdFiatPrice', () => {
    it('returns the exact day price for USD and EUR', () => {
        expect(lookupXrdFiatPrice(SAMPLE_PRICES, '2025-01-10', 'USD')).toBe(0.02);
        expect(lookupXrdFiatPrice(SAMPLE_PRICES, '2025-01-10', 'EUR')).toBe(0.018);
    });

    it('falls back to the nearest prior day within 7 days', () => {
        expect(lookupXrdFiatPrice(SAMPLE_PRICES, '2025-01-13', 'USD')).toBe(0.025);
        expect(lookupXrdFiatPrice(SAMPLE_PRICES, '2025-01-13', 'EUR')).toBe(0.022);
    });

    it('returns null (or fallback) when no price exists within 7 days', () => {
        expect(lookupXrdFiatPrice(SAMPLE_PRICES, '2025-01-25', 'USD')).toBeNull();
        expect(lookupXrdFiatPrice(SAMPLE_PRICES, '2025-01-25', 'USD', 0.015)).toBe(0.015);
    });
});

describe('mergeDailyRewards', () => {
    it('merges delegator and fee entries by UTC day sorted ascending', () => {
        const merged = mergeDailyRewards(
            [
                { date: '2025-02-01', xrd: 50 },
                { date: '2025-01-10', xrd: 100 },
                { date: '2025-01-10', xrd: 25 },
                { date: '2025-01-11', xrd: 0 },
            ],
            [
                { date: '2025-01-10', xrd: 10 },
                { date: '2025-01-11', xrd: 5 },
            ],
        );

        expect(merged).toEqual([
            { date: '2025-01-10', delegatorXrd: 125, feeXrd: 10 },
            { date: '2025-01-11', delegatorXrd: 0, feeXrd: 5 },
            { date: '2025-02-01', delegatorXrd: 50, feeXrd: 0 },
        ]);
    });
});

describe('summarizeYearRewards', () => {
    const daily = [
        { date: '2025-01-10', delegatorXrd: 100, feeXrd: 10 },
        { date: '2025-01-11', delegatorXrd: 200, feeXrd: 0 },
        { date: '2025-02-01', delegatorXrd: 50, feeXrd: 5 },
    ];

    it('aggregates monthly and yearly fiat values for accounts', () => {
        const res = summarizeYearRewards(daily, SAMPLE_PRICES, 'EUR', 0.01, 'account');

        // 2025-01-10: 110 * 0.018 = 1.98
        // 2025-01-11: 200 * 0.022 = 4.40
        // 2025-02-01:  55 * 0.027 = 1.485
        expect(res.fiatAtReceipt).toBeCloseTo(1.98 + 4.4 + 1.485, 6);
        // Total XRD = 365 * 0.01 = 3.65
        expect(res.fiatCurrent).toBeCloseTo(3.65, 6);

        expect(res.months).toHaveLength(2);
        expect(res.months[0]).toMatchObject({
            month: '2025-01',
            days: 2,
            delegatorXrd: 300,
            feeXrd: 10,
            primaryXrd: 310,
        });
        expect(res.months[0].fiatAtReceipt).toBeCloseTo(6.38, 6);
        expect(res.months[0].fiatCurrent).toBeCloseTo(3.1, 6);
        expect(res.months[1]).toMatchObject({
            month: '2025-02',
            days: 1,
            delegatorXrd: 50,
            feeXrd: 5,
            primaryXrd: 55,
        });
        expect(res.days).toHaveLength(3);
    });

    it('values only validator fee in validator mode', () => {
        const res = summarizeYearRewards(daily, SAMPLE_PRICES, 'USD', 0.01, 'validator');
        // 2025-01-10: 10 * 0.02 = 0.20
        // 2025-01-11: 0
        // 2025-02-01: 5 * 0.03 = 0.15
        expect(res.fiatAtReceipt).toBeCloseTo(0.35, 6);
        expect(res.fiatCurrent).toBeCloseTo(0.15, 6);
    });

    it('returns null fiat totals when prices are unavailable', () => {
        const res = summarizeYearRewards(daily, undefined, 'USD', null, 'account');
        expect(res.fiatAtReceipt).toBeNull();
        expect(res.fiatCurrent).toBeNull();
        expect(res.months[0].fiatAtReceipt).toBeNull();
        expect(res.months[0].fiatCurrent).toBeNull();
    });
});

describe('fiat change helpers', () => {
    it('computes percentage gain and loss vs value at receipt', () => {
        expect(computeFiatChangePct(100, 125)).toBeCloseTo(25, 6);
        expect(computeFiatChangePct(100, 40)).toBeCloseTo(-60, 6);
        expect(computeFiatChangePct(0, 50)).toBeNull();
        expect(computeFiatChangePct(null, 50)).toBeNull();
    });

    it('formats signed percentages and fiat deltas', () => {
        expect(formatSignedPercent(25.4, 'en')).toBe('+25.4%');
        expect(formatSignedPercent(-60.2, 'en')).toBe('-60.2%');
        expect(formatSignedPercent(150.4, 'en')).toBe('+150%');
        expect(formatSignedPercent(null, 'en')).toBe('—');
        expect(formatSignedCurrency(12.5, 'USD', 'en')).toBe('+12.50 $');
        expect(formatSignedCurrency(-12.5, 'EUR', 'es')).toBe('-12,50 €');
    });
});
