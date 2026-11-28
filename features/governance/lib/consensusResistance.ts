import type { HistoricalMethodRow } from './historicalMethods';
import type { MethodFamily, MethodKey, Resistance } from './methodCatalog';
import { RESISTANCE_SCORE } from './methodMetrics';
import { computeMethodResistance, type MethodResistanceMetrics, type MethodResistanceReport } from './methodResistance';
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
    /** Exact share (0..1) of the weighted consensus weight this technique captures (raw, weighted by method). */
    maxShare: number;
    /**
     * Share the attack is scored with: the larger of `maxShare` and the summed
     * weight of the methods whose result the attacker decides (more than half of
     * their weight). Feeds the difficulty and the global score (including its
     * average capturable weight); the cards show `maxShare`.
     */
    scoringShare: number;
    /** Per family: evaluated methods, those the attack captures any weight in, and those it decides (> 50 %). */
    byFamily: Array<{ family: MethodFamily; total: number; affected: number; controlled: number }>;
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
 * Above this share of the weight an attacker decides the result on their own.
 * A deliberate simplification: it ignores the vote's own approval threshold and
 * the election grade quantile, so every rule is scored against the same bar.
 */
export const CONTROL_SHARE = 0.5;

/**
 * Share an attack is scored with: a majority of the weight decides the result
 * just like 100 % does, so every rule is scored in the same unit whether its
 * scenario was written as "controls the outcome" (1) or as the raw weight share.
 */
export function controlShare(maxShare: number): number {
    const clamped = Number.isFinite(maxShare) ? Math.min(1, Math.max(0, maxShare)) : 0;
    return clamped > CONTROL_SHARE ? 1 : clamped;
}

/**
 * Computes a deterministic 0/10..10/10 continuous difficulty score for an attack scenario
 * combining its intrinsic operational cost with the rule's exact `maxShare` containment.
 */
export function computeAttackDifficulty(id: ConsensusAttackId, maxShare: number): AttackDifficulty {
    const cost = ATTACK_OPERATIONAL_COST[id];
    const clamped = controlShare(maxShare);
    const rawScore = clamped === 0
        ? 10
        : Math.min(9.99, Math.max(0, cost.base + (10 - cost.base) * (1 - clamped)));
    const score = clamped === 0
        ? 10
        : Math.min(9.9, Math.max(0, Math.round(rawScore * 10) / 10));
    return { ...cost, rawScore, score };
}

/** Unrounded 0..10 scores (shares 0..1), so averages over many votes are rounded only once. */
export interface RawResistanceScore {
    score: number;
    structuralScore: number;
    attackScore: number;
    minDifficulty: number;
    avgDifficulty: number;
    avgMaxShare: number;
    decentralisationScore: number | null;
    finalScore: number | null;
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
    /** Decentralisation score (0..10, 1 decimal) from spread (Simpson evenness over every address that voted), or null when spread is unavailable. */
    decentralisationScore: number | null;
    /** Combined final score (0..10, 1 decimal): geometric mean √(resistance × decentralisation), or null when spread is unavailable. */
    finalScore: number | null;
    /** The same figures before rounding. */
    raw: RawResistanceScore;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Display rounding shared by single-vote and historical scores (one decimal; 10 difficulty only when unattackable). */
export function roundResistanceScore(raw: RawResistanceScore): GlobalResistanceScore {
    return {
        score: round1(raw.score),
        structuralScore: round1(raw.structuralScore),
        attackScore: round1(raw.attackScore),
        minDifficulty: raw.minDifficulty >= 10 ? 10 : Math.min(9.9, round1(raw.minDifficulty)),
        avgDifficulty: round1(raw.avgDifficulty),
        avgMaxShare: raw.avgMaxShare,
        decentralisationScore: raw.decentralisationScore !== null ? round1(raw.decentralisationScore) : null,
        finalScore: raw.finalScore !== null ? round1(raw.finalScore) : null,
        raw,
    };
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

    if (scenarios.length === 0) {
        return roundResistanceScore({
            score: 0,
            structuralScore: 0,
            attackScore: 0,
            minDifficulty: 0,
            avgDifficulty: 0,
            avgMaxShare: 0,
            decentralisationScore: decentRaw,
            finalScore: decentRaw !== null ? 0 : null,
        });
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

    return roundResistanceScore({
        score: combinedRaw,
        structuralScore: structuralRaw,
        attackScore: attackRaw,
        minDifficulty: minRaw,
        avgDifficulty: rawAvg,
        avgMaxShare,
        decentralisationScore: decentRaw,
        finalScore: finalRaw,
    });
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
        family: m.family,
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
        let controlledWeight = 0;
        let affectedCount = 0;
        const families = new Map<MethodFamily, { family: MethodFamily; total: number; affected: number; controlled: number }>();
        for (const r of weightedReports) {
            const methodShare = r.scenarios.get(id) ?? 0;
            const fam = families.get(r.family) ?? { family: r.family, total: 0, affected: 0, controlled: 0 };
            fam.total += 1;
            if (methodShare > 0) {
                share += r.weight * methodShare;
                affectedCount += 1;
                fam.affected += 1;
            }
            // A method whose outcome the attacker decides counts in full for scoring.
            if (methodShare > CONTROL_SHARE) {
                controlledWeight += r.weight;
                fam.controlled += 1;
            }
            families.set(r.family, fam);
        }
        const familyOrder: MethodFamily[] = ['wealth', 'address', 'seniority', 'hybrid'];
        const maxShare = Math.min(1, Math.max(0, share));
        return {
            id,
            maxShare,
            scoringShare: Math.max(maxShare, Math.min(1, controlledWeight)),
            byFamily: familyOrder.flatMap(f => (families.has(f) ? [families.get(f)!] : [])),
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
    /** Unrounded final score: the table sorts by it so its order matches the panel ranks and the tiles. */
    finalRaw?: number | null;
    nakamoto: number | null;
    top1: number | null;
    effective: number | null;
    isConsensus?: boolean;
    /** Historical rows only: votes where the method counted someone, out of the votes analysed. */
    votesEvaluated?: number;
    votesTotal?: number;
}

/**
 * Resistance report and 0..10 scores of one method on one vote. Shared by the
 * single-vote table and the historical aggregation, so a historical score is
 * always the average of exactly the scores the single-vote tab shows.
 */
export function scoreMethodResult(
    method: MethodResult,
    quantile?: number,
): { report: MethodResistanceReport; scores: GlobalResistanceScore; metrics: MethodResistanceMetrics } {
    const metrics = methodResistanceMetricsFromResult(method, quantile);
    const report = computeMethodResistance(method.key, metrics);
    const scores = computeGlobalResistanceScore(report.scenarios, method.resistance, method.concentration.spread);
    return { report, scores, metrics };
}

/**
 * Balance (0..1) of one method on one vote: its final score / 10, i.e. the
 * geometric mean of the 0..10 resistance score and the decentralisation, the
 * same figures as the score table. 0 when the rule counts nobody.
 */
export function fairBalanceScore(method: MethodResult, quantile?: number): number {
    if (method.counted === 0) return 0;
    return Math.round(((scoreMethodResult(method, quantile).scores.raw.finalScore ?? 0) / 10) * 1e6) / 1e6;
}

/**
 * Effectiveness (0..1) of one method on one vote: cube root of resistance score
 * / 10 × decentralisation × valid (counted someone and met the quorum).
 */
export function fairEffectiveScore(method: MethodResult, quantile?: number): number {
    if (method.counted === 0 || method.quorumMet === false) return 0;
    const raw = scoreMethodResult(method, quantile).scores.raw;
    return Math.round(Math.cbrt((raw.score / 10) * (method.concentration.spread ?? 0)) * 1e6) / 1e6;
}

/**
 * Most/least balanced and effective rules on one vote, scored like the table.
 * Ties: the least balanced is the one whose resistance and decentralisation are
 * furthest apart; the least effective has less quorum progress, then less spread.
 */
export function fairScoreExtremes(methods: MethodResult[], quantile?: number): {
    balance: { most?: MethodResult; least?: MethodResult };
    effective: { most?: MethodResult; least?: MethodResult };
} {
    const scored = methods.map(m => ({
        m,
        balance: fairBalanceScore(m, quantile),
        effective: fairEffectiveScore(m, quantile),
        gap: Math.abs((m.counted > 0 ? scoreMethodResult(m, quantile).scores.raw.score / 10 : 0) - (m.concentration.spread ?? 0)),
        progress: m.counted === 0 ? 0 : m.quorumRatio === null ? 1 : Math.min(1, m.quorumRatio),
        spread: m.concentration.spread ?? 0,
    }));
    type S = typeof scored[number];
    const pick = (score: (x: S) => number, leastTie: (a: S, b: S) => number) => {
        let most: S | undefined;
        let least: S | undefined;
        for (const x of scored) {
            if (!most || score(x) > score(most)) most = x;
            if (!least || score(x) < score(least) || (score(x) === score(least) && leastTie(x, least) > 0)) least = x;
        }
        return { most: most?.m, least: least?.m };
    };
    const effective = pick(x => x.effective, (a, b) => (b.progress - a.progress) || (b.spread - a.spread));
    // When no method is effective at all (e.g. none reaches the quorum) there is no best or worst to name.
    const anyEffective = scored.some(x => x.effective > 0);
    return {
        balance: pick(x => x.balance, (a, b) => a.gap - b.gap),
        effective: anyEffective ? effective : {},
    };
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
        const { scores } = scoreMethodResult(method, options?.quantile);
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
            finalRaw: scores.raw.finalScore,
            nakamoto: hasCounted ? method.concentration.nakamoto : null,
            top1: hasCounted ? method.concentration.top1 : null,
            effective: hasCounted ? method.concentration.effective : null,
        };
    });

    if (options?.consensus) {
        const { methodWeights, concentration } = options.consensus;
        const consensusScenarios = computeConsensusResistance(methods, methodWeights, options.quantile);
        const structuralRatio = computeConsensusStructuralRatio(methods, methodWeights);
        const consensusScores = computeGlobalResistanceScore(
            consensusScenarios.map(sc => ({ id: sc.id, maxShare: sc.scoringShare })),
            structuralRatio,
            concentration.spread,
        );
        rows.push({
            key: 'consensus',
            family: 'consensus',
            resistance: resistanceLevelFromScore(consensusScores.score),
            resistanceScore: consensusScores.score,
            minDifficulty: consensusScores.minDifficulty,
            avgMaxShare: consensusScores.avgMaxShare,
            decentralisationScore: consensusScores.decentralisationScore,
            finalScore: consensusScores.finalScore,
            finalRaw: consensusScores.raw.finalScore,
            nakamoto: concentration.nakamoto,
            top1: concentration.top1,
            effective: concentration.effective,
            isConsensus: true,
        });
    }

    return rows;
}

/**
 * Historical score rows: each figure is the average of the per-vote scores
 * (`scoreMethodResult`) already accumulated by `aggregateHistoricalMethods`.
 * With a single vote analysed they equal the single-vote table exactly.
 */
export function computeHistoricalMethodScoreRows(
    rows: ReadonlyArray<HistoricalMethodRow>,
    totalVotes: number,
): MethodScoreRow[] {
    return rows.map(row => {
        const hasEvaluated = row.votesEvaluated > 0;
        return {
            key: row.key,
            family: row.family,
            current: row.current,
            resistance: row.resistance,
            resistanceScore: row.avgResistanceScore,
            minDifficulty: row.avgMinDifficulty,
            avgMaxShare: row.avgMaxShare,
            decentralisationScore: row.avgDecentralisationScore,
            finalScore: row.avgFinalScore,
            finalRaw: row.historicalScores.raw.finalScore,
            nakamoto: row.avgNakamoto,
            top1: hasEvaluated ? row.avgTop1 : null,
            effective: hasEvaluated ? row.avgEffective : null,
            votesEvaluated: row.votesEvaluated,
            votesTotal: totalVotes,
        };
    });
}

function scoreFieldValue(
    row: Pick<
        MethodScoreRow,
        'resistance' | 'resistanceScore' | 'minDifficulty' | 'decentralisationScore' | 'finalScore' | 'nakamoto' | 'top1'
    > & Partial<Pick<MethodScoreRow, 'finalRaw'>>,
    sortKey: MethodScoreSortKey,
): number | null {
    switch (sortKey) {
        case 'resistance':
            return row.resistanceScore;
        case 'decentralisation':
            return row.decentralisationScore;
        case 'final':
            // Unrounded, so two rows showing the same decimal keep the order of the tiles and panel ranks.
            return row.finalScore === null ? null : (row.finalRaw ?? row.finalScore);
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
    > & Partial<Pick<MethodScoreRow, 'finalRaw'>> & { label?: string },
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
        const byFinal = compareNullableDesc(
            a.finalScore === null ? null : (a.finalRaw ?? a.finalScore),
            b.finalScore === null ? null : (b.finalRaw ?? b.finalScore),
        );
        if (byFinal !== 0) return byFinal;
        if (a.resistanceScore !== b.resistanceScore) return b.resistanceScore - a.resistanceScore;
        const byDecent = compareNullableDesc(a.decentralisationScore, b.decentralisationScore);
        if (byDecent !== 0) return byDecent;
        return (a.label ?? '').localeCompare(b.label ?? '');
    });
}
