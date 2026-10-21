/**
 * A thermometer of the SELL pressure the XRD now unlocking could put on the
 * market.
 *
 * It measures potential, not intent: unlocked XRD may be re-staked, held or
 * sold, and nothing on the ledger says which. What it does say is how big the
 * wave is, how it compares with what the market trades and the stake behind it,
 * whether it is growing, and how soon it lands. Each of those is a component
 * with its own reading and a weight, so the number can be taken apart; the
 * rules are the constants below, stated rather than hidden in a score.
 */
import type { NetworkUnstakingData } from '@/features/dashboard/services/apiClient';

type UnlockDay = NetworkUnstakingData['schedule'][number];

export type PressureKey = 'size' | 'liquidity' | 'trend' | 'imminence';
export type PressureLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface PressureInput {
    /** XRD unlocking within the next 7 days; null while unknown. */
    unbonding: number | null;
    /** The same figure 7 days ago. */
    unbonding7dAgo: number | null;
    /** XRD staked in all. */
    totalStaked: number;
    schedule: UnlockDay[];
    /** For the comparison with the market: XRD price and what is traded in a day, both in USD. */
    priceUsd?: number;
    volumeUsd?: number;
}

export interface PressureComponent {
    key: PressureKey;
    /** 0 (no pressure) to 100 (the most). */
    score: number;
    weight: number;
    /** The measure behind the score: % of stake, days of trading volume, % change, % unlocking soon. */
    value: number;
}

export interface Pressure {
    /** 0–100, or null when too little is known to say. */
    score: number | null;
    level: PressureLevel | null;
    components: PressureComponent[];
}

/** Piecewise-linear: the score for `value` between the given [value, score] points, flat beyond the ends. */
function scale(value: number, points: [number, number][]): number {
    if (value <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        if (value <= x1) return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
    return points[points.length - 1][1];
}

/** How much each component counts. Components that cannot be measured leave the rest to share their weight. */
export const WEIGHTS: Record<PressureKey, number> = { size: 0.35, liquidity: 0.3, trend: 0.2, imminence: 0.15 };

/** Unlocking days that count as "soon": today and the next two. */
export const SOON_DAYS = 3;

/** Components needed before a score is given at all. */
const MIN_COMPONENTS = 2;

export function levelOf(score: number): PressureLevel {
    if (score < 25) return 'low';
    if (score < 50) return 'moderate';
    if (score < 75) return 'high';
    return 'severe';
}

export function sellPressure(input: PressureInput): Pressure {
    const { unbonding, unbonding7dAgo, totalStaked, schedule, priceUsd, volumeUsd } = input;
    if (unbonding === null) return { score: null, level: null, components: [] };

    const components: PressureComponent[] = [];

    // Size: the wave against the stake. 0 % → none, 10 % of all the stake → the most.
    if (totalStaked > 0) {
        const value = (unbonding / totalStaked) * 100;
        components.push({ key: 'size', value, weight: WEIGHTS.size, score: scale(value, [[0, 0], [10, 100]]) });
    }

    // Liquidity: the wave, in dollars, against a day of trading. 0 days → none, 3 days of volume → the most.
    if (priceUsd && volumeUsd && priceUsd > 0 && volumeUsd > 0) {
        const value = (unbonding * priceUsd) / volumeUsd;
        components.push({ key: 'liquidity', value, weight: WEIGHTS.liquidity, score: scale(value, [[0, 0], [3, 100]]) });
    }

    // Trend: against a week ago. Half as much → none, the same → a quarter, double or more → the most.
    if (unbonding7dAgo !== null && unbonding7dAgo > 0) {
        const value = (unbonding / unbonding7dAgo - 1) * 100;
        components.push({ key: 'trend', value, weight: WEIGHTS.trend, score: scale(value, [[-50, 0], [0, 25], [100, 100]]) });
    }

    // Imminence: how much of the wave lands in the next few days. An even spread puts ~40 % there, which is
    // nothing unusual → none; three quarters or more → the most.
    const total = schedule.reduce((sum, day) => sum + day.xrd, 0);
    if (total > 0) {
        const soon = schedule.slice(0, SOON_DAYS).reduce((sum, day) => sum + day.xrd, 0);
        const value = (soon / total) * 100;
        components.push({ key: 'imminence', value, weight: WEIGHTS.imminence, score: scale(value, [[35, 0], [75, 100]]) });
    }

    if (components.length < MIN_COMPONENTS) return { score: null, level: null, components };
    const weight = components.reduce((sum, c) => sum + c.weight, 0);
    const score = components.reduce((sum, c) => sum + c.score * c.weight, 0) / weight;
    return { score, level: levelOf(score), components };
}
