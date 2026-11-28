import type { HistoricalMethodRow } from './historicalMethods';
import type { MethodFamily, MethodKey, Resistance } from './methodCatalog';
import { RESISTANCE_SCORE } from './methodMetrics';
import { computeMethodResistance, type MethodResistanceMetrics } from './methodResistance';
import type { MethodResult } from './votingMethods';

export type ConsensusAttackId =
    | 'cheap_sybil'
    | 'funded_sybil'
    | 'opportunistic_whale'
    | 'split_whale'
    | 'veteran_whale'
    | 'veteran_sybil_farm'
    | 'nation_state';

export interface ConsensusAttackScenario {
    id: ConsensusAttackId;
    /** Exact share (0..1) of the weighted consensus controllable by this technique. */
    maxShare: number;
    /** Number of evaluated methods fully or partially affected. */
    affectedCount: number;
    /** Total evaluated methods in the consensus. */
    totalMethods: number;
}

export interface AttackOperationalCost {
    /** Capital requirement tier (0 = dust, 1 = low farm, 2 = moderate split, 6 = >60 % majority XRD). */
    capital: number;
    /** Preparation / lockup horizon tier (0 = last-minute, 2 = >1–2y age / 90d TWAB + staking). */
    time: number;
    /** Multi-account coordination burden (0 = single wallet or free split, 1 = hundreds of pre-aged/funded wallets). */
    coordination: number;
    /** Intrinsic operational difficulty (0..9) before accounting for rule containment. */
    base: number;
}

export interface AttackDifficulty extends AttackOperationalCost {
    /** Continuous unrounded difficulty score (0..9.99 when maxShare > 0; 10 at 0 %). */
    rawScore: number;
    /** Display attack difficulty score rounded to 1 decimal (0..9.9 when maxShare > 0; 10 at 0 %). */
    score: number;
}

export const ATTACK_OPERATIONAL_COST: Record<ConsensusAttackId, AttackOperationalCost> = {
    cheap_sybil: { capital: 0, time: 0, coordination: 0, base: 0 },
    funded_sybil: { capital: 2, time: 0, coordination: 1, base: 3 },
    veteran_sybil_farm: { capital: 1, time: 2, coordination: 1, base: 4 },
    opportunistic_whale: { capital: 6, time: 0, coordination: 0, base: 6 },
    split_whale: { capital: 6, time: 0, coordination: 0, base: 6 },
    veteran_whale: { capital: 6, time: 2, coordination: 0, base: 8 },
    nation_state: { capital: 6, time: 2, coordination: 1, base: 9 },
};

/**
 * Computes a deterministic 0/10..10/10 continuous difficulty score for an attack scenario
 * combining its intrinsic operational cost with the rule's exact `maxShare` containment.
 */
export function computeAttackDifficulty(id: ConsensusAttackId, maxShare: number): AttackDifficulty {
    const cost = ATTACK_OPERATIONAL_COST[id];
    const clamped = Number.isFinite(maxShare) ? Math.min(1, Math.max(0, maxShare)) : 0;
    const rawScore = clamped === 0
        ? 10
        : Math.min(9.99, Math.max(0, cost.base + (10 - cost.base) * (1 - clamped)));
    const score = clamped === 0
        ? 10
        : Math.min(9.9, Math.max(0, Math.round(rawScore * 10) / 10));
    return { ...cost, rawScore, score };
}

export interface GlobalResistanceScore {
    /** Global resistance score (0..10, 1 decimal): 50 % anti-Sybil structural resistance + 50 % attack defense. */
    score: number;
    /** Structural Sybil-resistance score (0..10, 1 decimal). */
    structuralScore: number;
    /** Attack-vector defense score (0..10, 1 decimal): 70 % × min + 30 % × mean continuous difficulty. */
    attackScore: number;
    /** Minimum difficulty score across the evaluated attack vectors (1 decimal; 10 only when 0 %). */
    minDifficulty: number;
    /** Arithmetic mean difficulty score (0..10, 1 decimal) across the evaluated attack vectors. */
    avgDifficulty: number;
    /** Arithmetic mean maximum controllable weight (0..1) across the evaluated attack vectors. */
    avgMaxShare: number;
    /** Decentralisation score (0..10, 1 decimal) from spread (1 - HHI_norm), or null when spread is unavailable. */
    decentralisationScore: number | null;
    /** Combined final score (0..10, 1 decimal): geometric mean √(resistance × decentralisation), or null when spread is unavailable. */
    finalScore: number | null;
}

/**
 * Computes an overall 0/10..10/10 resistance score using unrounded continuous
 * attack difficulties so fine changes in controllable weight are never lost:
 * - 50 % structural Sybil resistance (`RESISTANCE_SCORE`, 0..10)
 * - 50 % weakest-link attack defense (70 % × min difficulty + 30 % × mean difficulty)
 * Optionally appends decentralisation (`spread × 10`) and final (`√(resistance × decentralisation)`) scores.
 */
export function computeGlobalResistanceScore(
    scenarios: ReadonlyArray<{ id: ConsensusAttackId; maxShare: number }>,
    structuralResistance?: Resistance | number,
    spread?: number | null,
): GlobalResistanceScore {
    const hasSpread = spread != null && Number.isFinite(spread);
    const decentRaw = hasSpread ? Math.min(1, Math.max(0, spread)) * 10 : null;
    const decentralisationScore = decentRaw !== null ? Math.round(decentRaw * 10) / 10 : null;

    if (scenarios.length === 0) {
        return {
            score: 0,
            structuralScore: 0,
            attackScore: 0,
            minDifficulty: 0,
            avgDifficulty: 0,
            avgMaxShare: 0,
            decentralisationScore,
            finalScore: decentRaw !== null ? 0 : null,
        };
    }
    const diffs = scenarios.map(s => computeAttackDifficulty(s.id, s.maxShare).rawScore);
    const shares = scenarios.map(s => (Number.isFinite(s.maxShare) ? Math.min(1, Math.max(0, s.maxShare)) : 0));
    const minRaw = Math.min(...diffs);
    const rawAvg = diffs.reduce((acc, v) => acc + v, 0) / diffs.length;
    const avgMaxShare = shares.reduce((acc, v) => acc + v, 0) / shares.length;
    const attackRaw = 0.7 * minRaw + 0.3 * rawAvg;

    const structuralRatio = typeof structuralResistance === 'number'
        ? Math.min(1, Math.max(0, structuralResistance))
        : structuralResistance
            ? RESISTANCE_SCORE[structuralResistance]
            : null;
    const structuralRaw = structuralRatio !== null ? structuralRatio * 10 : attackRaw;
    const combinedRaw = structuralRatio !== null ? 0.5 * structuralRaw + 0.5 * attackRaw : attackRaw;
    const finalRaw = decentRaw !== null ? Math.sqrt(Math.max(0, combinedRaw) * decentRaw) : null;

    return {
        score: Math.round(combinedRaw * 10) / 10,
        structuralScore: Math.round(structuralRaw * 10) / 10,
        attackScore: Math.round(attackRaw * 10) / 10,
        minDifficulty: minRaw === 10 ? 10 : Math.min(9.9, Math.round(minRaw * 10) / 10),
        avgDifficulty: Math.round(rawAvg * 10) / 10,
        avgMaxShare,
        decentralisationScore,
        finalScore: finalRaw !== null ? Math.round(finalRaw * 10) / 10 : null,
    };
}

const ATTACK_IDS: readonly ConsensusAttackId[] = [
    'cheap_sybil',
    'funded_sybil',
    'opportunistic_whale',
    'split_whale',
    'veteran_whale',
    'veteran_sybil_farm',
    'nation_state',
];

/**
 * Exact control share for the baseline `1 XRD = 1 vote` method under each of
 * the 7 attack scenarios (immune to wallet splitting; 100 % controllable with
 * > 60 % of snapshot XRD).
 */
export const CURRENT_ATTACK_SHARES: ReadonlyArray<{ id: ConsensusAttackId; maxShare: number }> = [
    { id: 'cheap_sybil', maxShare: 0 },
    { id: 'funded_sybil', maxShare: 0 },
    { id: 'opportunistic_whale', maxShare: 1 },
    { id: 'split_whale', maxShare: 1 },
    { id: 'veteran_whale', maxShare: 1 },
    { id: 'veteran_sybil_farm', maxShare: 0 },
    { id: 'nation_state', maxShare: 1 },
];

/** Maps a live `MethodResult` to the metrics object expected by `computeMethodResistance`. */
export function methodResistanceMetricsFromResult(
    method: MethodResult,
    quantile?: number,
): MethodResistanceMetrics {
    return {
        counted: method.counted,
        eligibleXrd: method.eligibleXrd,
        totalWeight: method.totalWeight,
        decisiveQuantileCount: method.electionSummary?.decisiveQuantileCount ?? null,
        decisiveCount: method.decisive?.count ?? null,
        decisiveOf: method.decisive?.of ?? null,
        isElection: Boolean(method.electionSummary),
        isHistorical: false,
        ...(quantile !== undefined && Number.isFinite(quantile) ? { quantile } : {}),
        singleWhaleShareOverride: method.capShareAudit?.singleWhaleShare ?? null,
        lastMinTwabSingleShareOverride: method.capShareAudit?.lastMinTwabSingleShare ?? null,
    };
}

/** Maps a `HistoricalMethodRow` aggregate to the metrics object expected by `computeMethodResistance`. */
export function methodResistanceMetricsFromHistorical(
    row: Pick<
        HistoricalMethodRow,
        'votesEvaluated' | 'totalBallotsCounted' | 'totalEligibleXrd' | 'avgTotalWeight' | 'validVotesCount' | 'avgNakamoto'
    >,
    totalVotes: number,
): MethodResistanceMetrics {
    return {
        counted: row.votesEvaluated > 0 ? Math.round(row.totalBallotsCounted / row.votesEvaluated) : 0,
        eligibleXrd: row.votesEvaluated > 0 ? row.totalEligibleXrd / row.votesEvaluated : 0,
        totalWeight: row.avgTotalWeight,
        validVotesCount: row.validVotesCount,
        totalVotes,
        avgNakamoto: row.avgNakamoto,
        isElection: false,
        isHistorical: true,
    };
}

/** Sums the weighted structural anti-Sybil ratio (`0..1`) across participating election methods. */
export function computeConsensusStructuralRatio(
    methods: MethodResult[],
    methodWeights: Partial<Record<MethodKey, number>>,
): number {
    return methods
        .filter(m => m.electionSummary && m.counted > 0 && (methodWeights[m.key] ?? 0) > 0)
        .reduce((sum, m) => sum + (methodWeights[m.key] ?? 0) * RESISTANCE_SCORE[m.resistance], 0);
}

/** Maps a continuous `0..10` resistance score onto the 4-tier badge scale. */
export function resistanceLevelFromScore(score: number): Resistance {
    if (score >= 7.5) return 'high';
    if (score >= 5.5) return 'medium';
    if (score >= 3.5) return 'low';
    return 'very_low';
}

/**
 * Computes the exact share of the weighted consensus controllable under each
 * attack technique by aggregating the live per-method `computeMethodResistance`
 * evaluations across every participating method and its normalized weight.
 */
export function computeConsensusResistance(
    methods: MethodResult[],
    methodWeights: Partial<Record<MethodKey, number>>,
    quantile?: number,
): ConsensusAttackScenario[] {
    const evaluated = methods.filter(m => m.electionSummary && m.counted > 0 && (methodWeights[m.key] ?? 0) > 0);
    const totalMethods = evaluated.length;
    const weightedReports = evaluated.map(m => ({
        weight: methodWeights[m.key] ?? 0,
        scenarios: new Map(
            computeMethodResistance(
                m.key,
                methodResistanceMetricsFromResult(m, quantile),
            ).scenarios.map(s => [s.id, s.maxShare]),
        ),
    }));

    return ATTACK_IDS.map(id => {
        let share = 0;
        let affectedCount = 0;
        for (const r of weightedReports) {
            const methodShare = r.scenarios.get(id) ?? 0;
            if (methodShare > 0) {
                share += r.weight * methodShare;
                affectedCount += 1;
            }
        }
        return {
            id,
            maxShare: Math.min(1, Math.max(0, share)),
            affectedCount,
            totalMethods,
        };
    });
}

export type MethodScoreSortKey =
    | 'resistance'
    | 'decentralisation'
    | 'final'
    | 'minDifficulty'
    | 'antiSybil'
    | 'nakamoto'
    | 'top1';
export type SortDirection = 'desc' | 'asc';
export type MethodScoreSortState = { key: MethodScoreSortKey; dir: SortDirection } | null;

/** Cycles a MethodScoresTable column header through 3 clicks: desc -> asc -> null (default order). */
export function nextMethodScoreSort(
    prev: MethodScoreSortState,
    key: MethodScoreSortKey,
): MethodScoreSortState {
    if (!prev || prev.key !== key) return { key, dir: 'desc' };
    if (prev.dir === 'desc') return { key, dir: 'asc' };
    return null;
}

export interface MethodScoreRow {
    key: MethodKey | 'consensus';
    family: MethodFamily | 'consensus';
    current?: boolean;
    resistance: Resistance;
    resistanceScore: number;
    minDifficulty: number;
    avgMaxShare: number;
    decentralisationScore: number | null;
    finalScore: number | null;
    nakamoto: number | null;
    top1: number | null;
    effective: number | null;
    isConsensus?: boolean;
}

/** Computes resistance, decentralisation, final, and concentration scores for every live method (plus optional consensus). */
export function computeMethodScoreRows(
    methods: MethodResult[],
    options?: {
        quantile?: number;
        consensus?: {
            methodWeights: Partial<Record<MethodKey, number>>;
            concentration: {
                spread: number | null;
                nakamoto: number | null;
                top1: number;
                effective: number;
            };
        } | null;
    },
): MethodScoreRow[] {
    const rows: MethodScoreRow[] = methods.map(method => {
        const report = computeMethodResistance(
            method.key,
            methodResistanceMetricsFromResult(method, options?.quantile),
        );
        const scores = computeGlobalResistanceScore(
            report.scenarios,
            method.resistance,
            method.concentration.spread,
        );
        const hasCounted = method.counted > 0;
        return {
            key: method.key,
            family: method.family,
            current: method.current,
            resistance: method.resistance,
            resistanceScore: scores.score,
            minDifficulty: scores.minDifficulty,
            avgMaxShare: scores.avgMaxShare,
            decentralisationScore: scores.decentralisationScore,
            finalScore: scores.finalScore,
            nakamoto: hasCounted ? method.concentration.nakamoto : null,
            top1: hasCounted ? method.concentration.top1 : null,
            effective: hasCounted ? method.concentration.effective : null,
        };
    });

    if (options?.consensus) {
        const { methodWeights, concentration } = options.consensus;
        const consensusScenarios = computeConsensusResistance(methods, methodWeights, options.quantile);
        const structuralRatio = computeConsensusStructuralRatio(methods, methodWeights);
        const consensusScores = computeGlobalResistanceScore(consensusScenarios, structuralRatio, concentration.spread);
        rows.push({
            key: 'consensus',
            family: 'consensus',
            resistance: resistanceLevelFromScore(consensusScores.score),
            resistanceScore: consensusScores.score,
            minDifficulty: consensusScores.minDifficulty,
            avgMaxShare: consensusScores.avgMaxShare,
            decentralisationScore: consensusScores.decentralisationScore,
            finalScore: consensusScores.finalScore,
            nakamoto: concentration.nakamoto,
            top1: concentration.top1,
            effective: concentration.effective,
            isConsensus: true,
        });
    }

    return rows;
}

/** Computes resistance, decentralisation, final, and concentration scores for every historical method aggregate. */
export function computeHistoricalMethodScoreRows(
    rows: ReadonlyArray<HistoricalMethodRow>,
    totalVotes: number,
): MethodScoreRow[] {
    return rows.map(row => {
        const report = computeMethodResistance(
            row.key,
            methodResistanceMetricsFromHistorical(row, totalVotes),
        );
        const scores = computeGlobalResistanceScore(
            report.scenarios,
            row.resistance,
            row.avgSpread,
        );
        const hasEvaluated = row.votesEvaluated > 0;
        return {
            key: row.key,
            family: row.family,
            current: row.current,
            resistance: row.resistance,
            resistanceScore: scores.score,
            minDifficulty: scores.minDifficulty,
            avgMaxShare: scores.avgMaxShare,
            decentralisationScore: scores.decentralisationScore,
            finalScore: scores.finalScore,
            nakamoto: row.avgNakamoto,
            top1: hasEvaluated ? row.avgTop1 : null,
            effective: hasEvaluated ? row.avgEffective : null,
        };
    });
}

function scoreFieldValue(
    row: Pick<
        MethodScoreRow,
        'resistance' | 'resistanceScore' | 'minDifficulty' | 'decentralisationScore' | 'finalScore' | 'nakamoto' | 'top1'
    >,
    sortKey: MethodScoreSortKey,
): number | null {
    switch (sortKey) {
        case 'resistance':
            return row.resistanceScore;
        case 'decentralisation':
            return row.decentralisationScore;
        case 'final':
            return row.finalScore;
        case 'minDifficulty':
            return row.minDifficulty;
        case 'antiSybil':
            return RESISTANCE_SCORE[row.resistance];
        case 'nakamoto':
            return row.nakamoto;
        case 'top1':
            return row.top1;
    }
}

function compareNullableDesc(a: number | null, b: number | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
}

/** Sorts method score rows cleanly by the requested column, sinking null values to the bottom. */
export function sortMethodScoreRows<
    T extends Pick<
        MethodScoreRow,
        'resistance' | 'resistanceScore' | 'minDifficulty' | 'decentralisationScore' | 'finalScore' | 'nakamoto' | 'top1'
    > & { label?: string },
>(
    rows: readonly T[],
    sortKey: MethodScoreSortKey,
    direction: SortDirection = 'desc',
): T[] {
    return [...rows].sort((a, b) => {
        const aVal = scoreFieldValue(a, sortKey);
        const bVal = scoreFieldValue(b, sortKey);
        if (aVal === null && bVal !== null) return 1;
        if (bVal === null && aVal !== null) return -1;
        if (aVal !== null && bVal !== null && aVal !== bVal) {
            return direction === 'desc' ? bVal - aVal : aVal - bVal;
        }
        const byFinal = compareNullableDesc(a.finalScore, b.finalScore);
        if (byFinal !== 0) return byFinal;
        if (a.resistanceScore !== b.resistanceScore) return b.resistanceScore - a.resistanceScore;
        const byDecent = compareNullableDesc(a.decentralisationScore, b.decentralisationScore);
        if (byDecent !== 0) return byDecent;
        return (a.label ?? '').localeCompare(b.label ?? '');
    });
}
