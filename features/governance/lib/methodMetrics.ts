import type { Resistance } from './methodCatalog';

/**
 * Concentration, balance, and effectiveness scoring helpers for voting methods.
 *
 * Re-exported from `votingMethods.ts` so all existing imports stay stable.
 */

export interface Concentration {
    /** Fewest voters that together hold more than half of the weight. */
    nakamoto: number | null;
    /**
     * Degree of decentralisation, 0..1: effective voters over every address
     * that voted (Simpson evenness, from the Herfindahl index), so voters a
     * rule leaves out count as weighing nothing. 1 when every address that
     * voted weighs the same.
     */
    spread: number | null;
    /** Voters that would give the same concentration if all weighed the same (1 / Σ share²). */
    effective: number;
    /** Weight share of the largest voter and of the ten largest, 0..1. */
    top1: number;
    top10: number;
}

export type ConcentrationLevel = 'extreme' | 'high' | 'moderate' | 'low' | 'minimal';

/** Upper bounds of `spread` for each level; one address holding half always reads as extreme. */
export const SPREAD_LEVELS = { high: 0.15, moderate: 0.35, low: 0.65 } as const;

export function concentrationLevel({ nakamoto, spread }: Pick<Concentration, 'nakamoto' | 'spread'>): ConcentrationLevel | null {
    if (nakamoto === null || spread === null) return null;
    if (nakamoto <= 1) return 'extreme';
    if (spread < SPREAD_LEVELS.high) return 'high';
    if (spread < SPREAD_LEVELS.moderate) return 'moderate';
    if (spread < SPREAD_LEVELS.low) return 'low';
    return 'minimal';
}

/**
 * Concentration of `weights`. `population` is how many addresses voted
 * (counted or not); it defaults to the addresses with weight. Dividing by
 * everyone who voted keeps a rule from looking decentralised just because it
 * dropped most voters and kept a few similar ones.
 */
export function concentration(weights: number[], population?: number): Concentration {
    const w = weights.filter(x => x > 0).sort((a, b) => b - a);
    const total = w.reduce((s, x) => s + x, 0);
    if (total <= 0) return { nakamoto: null, spread: null, effective: 0, top1: 0, top10: 0 };
    let acc = 0;
    let nakamoto: number | null = null;
    for (let i = 0; i < w.length; i++) {
        acc += w[i];
        if (acc > total / 2) { nakamoto = i + 1; break; }
    }
    const sumSq = w.reduce((s, x) => s + (x / total) ** 2, 0);
    return {
        nakamoto,
        spread: nakamoto === null ? null : 1 / sumSq / Math.max(w.length, population ?? 0),
        effective: 1 / sumSq,
        top1: w[0] / total,
        top10: w.slice(0, 10).reduce((s, x) => s + x, 0) / total,
    };
}

/** Resistance to manipulation on a 0..1 scale. */
export const RESISTANCE_SCORE: Record<Resistance, number> = { very_low: 0, low: 1 / 3, medium: 2 / 3, high: 1 };

/**
 * How balanced a rule is, 0..1: the geometric mean of its resistance to
 * manipulation and its degree of decentralisation.
 */
export function balanceScoreOf(resistance: Resistance, spread: number | null): number {
    return Math.round(Math.sqrt(RESISTANCE_SCORE[resistance] * (spread ?? 0)) * 1e6) / 1e6;
}

export function balanceScore(r: { resistance: Resistance; concentration: Concentration }): number {
    return balanceScoreOf(r.resistance, r.concentration.spread);
}

/** Most and least decentralised items, rounded so float noise never breaks a real tie. */
export function spreadExtremes<T>(items: T[], getSpread: (item: T) => number | null): { most?: T; least?: T } {
    const round = (x: T) => Math.round((getSpread(x) ?? 0) * 1e6) / 1e6;
    let most: T | undefined;
    let least: T | undefined;
    for (const item of items) {
        const s = round(item);
        if (!most || s > round(most)) most = item;
        if (!least || s < round(least)) least = item;
    }
    return { most, least };
}

/** Generic version of `balanceExtremes`: finds the most and least balanced items using a custom `spread` accessor. */
export function balanceExtremesBy<T extends { resistance: Resistance }>(
    items: T[],
    getSpread: (item: T) => number | null,
): { most?: T; least?: T } {
    const gap = (r: T) => Math.abs(RESISTANCE_SCORE[r.resistance] - (getSpread(r) ?? 0));
    const scoreOf = (r: T) => balanceScoreOf(r.resistance, getSpread(r));
    let most: T | undefined;
    let least: T | undefined;
    for (const r of items) {
        const score = scoreOf(r);
        if (!most || score > scoreOf(most)) most = r;
        if (!least || score < scoreOf(least) || (score === scoreOf(least) && gap(r) > gap(least))) least = r;
    }
    return { most, least };
}

/** The most and the least balanced rules. */
export function balanceExtremes<T extends { resistance: Resistance; concentration: Concentration }>(results: T[]): { most?: T; least?: T } {
    return balanceExtremesBy(results, r => r.concentration.spread);
}

/** 3-factor effectiveness score (0..1): geometric mean of resistance, decentralisation, and quorum/validity rate. */
export function effectiveScoreOf(resistance: Resistance, spread: number | null, validRate: number): number {
    return Math.round(Math.cbrt(RESISTANCE_SCORE[resistance] * (spread ?? 0) * Math.max(0, Math.min(1, validRate))) * 1e6) / 1e6;
}

/** Generic most and least effective items using custom `spread`, `validRate`, and tie-break accessors. */
export function effectiveExtremesBy<T extends { resistance: Resistance }>(
    items: T[],
    getSpread: (item: T) => number | null,
    getValidRate: (item: T) => number,
    getTieProgress: (item: T) => number = getValidRate,
): { most?: T; least?: T } {
    const scoreOf = (r: T) => effectiveScoreOf(r.resistance, getSpread(r), getValidRate(r));
    let most: T | undefined;
    let least: T | undefined;
    for (const r of items) {
        const s = scoreOf(r);
        if (!most || s > scoreOf(most)) most = r;
        if (
            !least
            || s < scoreOf(least)
            || (s === scoreOf(least) && getTieProgress(r) < getTieProgress(least))
            || (s === scoreOf(least) && getTieProgress(r) === getTieProgress(least) && (getSpread(r) ?? 0) < (getSpread(least) ?? 0))
        ) {
            least = r;
        }
    }
    return { most, least };
}

/** Single-vote effectiveness score (0..1). */
export function effectiveScore(r: { resistance: Resistance; concentration: Concentration; counted: number; quorumMet: boolean | null }): number {
    return effectiveScoreOf(r.resistance, r.concentration.spread, r.counted > 0 && r.quorumMet !== false ? 1 : 0);
}

/** Most and least effective rules on a single vote (resistance × decentralisation × quorum). */
export function effectiveExtremes<T extends { resistance: Resistance; concentration: Concentration; counted: number; quorumMet: boolean | null; quorumRatio: number | null }>(results: T[]): { most?: T; least?: T } {
    return effectiveExtremesBy(
        results,
        r => r.concentration.spread,
        r => (r.counted > 0 && r.quorumMet !== false ? 1 : 0),
        r => (r.counted === 0 ? 0 : r.quorumRatio === null ? 1 : Math.min(1, r.quorumRatio)),
    );
}
