import { describe, it, expect } from 'vitest';
import { sellPressure, levelOf, SOON_DAYS } from '@/features/dashboard/staking/lib/sellPressure';

const days = (values: number[]) => values.map((xrd, i) => ({ date: `2026-10-${21 + i}`, xrd }));
const even = days([10, 10, 10, 10, 10, 10, 10, 10]);

const base = { unbonding: 80, unbonding7dAgo: 80, totalStaked: 1000, schedule: even, priceUsd: 1, volumeUsd: 80 };

describe('sellPressure', () => {
    it('gives no score while the unlocking figure is unknown', () => {
        expect(sellPressure({ ...base, unbonding: null })).toEqual({ score: null, level: null, components: [] });
    });

    it('is low for a small, steady wave that the market can absorb', () => {
        const result = sellPressure({ unbonding: 5, unbonding7dAgo: 5, totalStaked: 1000, schedule: days([1, 1, 1, 1, 1, 0, 0, 0]), priceUsd: 1, volumeUsd: 500 });
        expect(result.level).toBe('low');
        expect(result.score!).toBeLessThan(25);
    });

    it('is severe for a huge, growing, imminent wave against thin trading', () => {
        const result = sellPressure({ unbonding: 150, unbonding7dAgo: 50, totalStaked: 1000, schedule: days([60, 60, 20, 10, 0, 0, 0, 0]), priceUsd: 1, volumeUsd: 30 });
        expect(result.level).toBe('severe');
    });

    it('reads each component from its own measure', () => {
        const result = sellPressure(base);
        const by = Object.fromEntries(result.components.map(c => [c.key, c]));
        expect(by.size.value).toBeCloseTo(8); // 80 of 1000 staked
        expect(by.liquidity.value).toBeCloseTo(1); // $80 against $80 a day
        expect(by.trend.value).toBeCloseTo(0); // same as a week ago
        expect(by.imminence.value).toBeCloseTo(37.5); // 3 of 8 equal days
        expect(by.trend.score).toBeCloseTo(25);
        expect(by.imminence.score).toBeCloseTo(6.25);
        expect(by.size.score).toBeCloseTo(80);
    });

    it('shares the weight of what it cannot measure among the rest', () => {
        const withMarket = sellPressure(base);
        const without = sellPressure({ ...base, priceUsd: undefined, volumeUsd: undefined });
        expect(without.components.map(c => c.key)).not.toContain('liquidity');
        expect(without.score).not.toBeNull();
        // Same inputs minus one component: the score is a weighted average of the others, not 0 for the missing one.
        const others = without.components;
        const expected = others.reduce((s, c) => s + c.score * c.weight, 0) / others.reduce((s, c) => s + c.weight, 0);
        expect(without.score).toBeCloseTo(expected);
        expect(withMarket.components).toHaveLength(4);
    });

    it('gives no score with fewer than two components', () => {
        const result = sellPressure({ unbonding: 10, unbonding7dAgo: null, totalStaked: 0, schedule: [], });
        expect(result.score).toBeNull();
    });

    it('does not call a wave growing from nothing', () => {
        const result = sellPressure({ ...base, unbonding7dAgo: 0 });
        expect(result.components.map(c => c.key)).not.toContain('trend');
    });
});

describe('levelOf', () => {
    it('cuts at 25, 50 and 75', () => {
        expect([0, 24.9, 25, 49.9, 50, 74.9, 75, 100].map(levelOf)).toEqual(['low', 'low', 'moderate', 'moderate', 'high', 'high', 'severe', 'severe']);
    });
});

it('counts today and the next two days as soon', () => {
    expect(SOON_DAYS).toBe(3);
});
