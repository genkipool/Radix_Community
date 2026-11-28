import {
    METHODS,
    compareMethods,
    computeAttackDifficulty,
    fairEffectiveScore,
    roundResistanceScore,
    scoreMethodResult,
    spreadExtremes,
    type GlobalResistanceScore,
    type MethodResistanceMetrics,
    type ConsensusAttackId,
    type MethodFamily,
    type MethodKey,
    type MethodResult,
    type MethodVoter,
    type Resistance,
} from './votingMethods';
import { itemChoices, type VoteOutcome } from './governanceVotes';
import { parseQuantile } from './majorityJudgment';
import type { GovernanceEntry } from '../types';

export interface HistoricalVoteInput {
    entry: GovernanceEntry;
    voters: MethodVoter[];
    /** Optional stance label resolver for ballot choices. */
    stanceLabel?: (stance: string) => string;
    /** Applied Majority Judgment grade quantile for elections (e.g. "3/5"). */
    gradeQuantile?: string | null;
}

export interface ChangedVoteRef {
    entry: GovernanceEntry;
    currentOutcome: VoteOutcome | null;
    currentWinner: string | null;
    methodOutcome: VoteOutcome | null;
    methodWinner: string | null;
    methodCounted: number;
    /** Present for Majority Judgment elections: elected vs total seats under current and method rules. */
    currentSeats?: { elected: number; total: number } | null;
    methodSeats?: { elected: number; total: number } | null;
    seatsChanged?: number | null;
}

export interface HistoricalMethodRow {
    key: MethodKey;
    family: MethodFamily;
    current: boolean;
    needsAge: boolean;
    resistance: Resistance;
    /** Number of votes where at least one voter counted under this method. */
    votesEvaluated: number;
    /** Number of votes where this method produced a different outcome from 1 XRD = 1 vote. */
    changedCount: number;
    /** Number of votes where this method produced the same outcome as 1 XRD = 1 vote. */
    sameCount: number;
    /** Specific votes whose outcome differed from 1 XRD = 1 vote. */
    changedEntries: ChangedVoteRef[];
    /** Cumulative counted ballots across all votes. */
    totalBallotsCounted: number;
    /** Cumulative excluded ballots across all votes. */
    totalBallotsExcluded: number;
    /** Cumulative XRD of eligible voters summed across all votes. */
    totalEligibleXrd: number;
    /** Average sum of transformed voter weights across evaluated votes. */
    avgTotalWeight: number;
    /** Average Nakamoto coefficient across evaluated votes. */
    avgNakamoto: number | null;
    /**
     * Average decentralisation (Simpson evenness, 0..1) across every analysed
     * vote; a vote where the rule counts nobody adds 0. Null when it counted
     * nobody in any vote.
     */
    avgSpread: number | null;
    /** Average effective voters across evaluated votes. */
    avgEffective: number;
    /** Average largest-voter weight share (0..1). */
    avgTop1: number;
    /** Average top-10 weight share (0..1). */
    avgTop10: number;
    /** Average fewest winning-side voters sufficient to decide a vote. */
    avgDecisiveCount: number | null;
    /** Average counted voters (the denominator of the decisive share) across decided votes. */
    avgDecisiveOf: number | null;
    /** Average XRD held by the decisive voters per vote. */
    avgDecisiveXrd: number | null;
    /** Cumulative XRD held by decisive voters across all decided votes. */
    totalDecisiveXrd: number;
    /** Number of votes where this method reached quorum and decided an outcome. */
    decisiveVotesCount: number;
    /** Number of analysed votes where this method had qualifying voters and met quorum (when required). */
    validVotesCount: number;
    /** Average capped quorum progress (0..1) over every analysed vote (0 where nobody counts), matching single-vote tie-breaking. */
    avgQuorumProgress: number;
    /** Historical balance score (0..1): average per-vote final score / 10; votes with nobody counted add 0. */
    balanceScore: number;
    /** Historical effectiveness score (0..1): average per-vote effectiveness; votes without a valid result add 0. */
    effectiveScore: number;
    /** Average per-vote global resistance score (0..10) across evaluated votes. */
    avgResistanceScore: number;
    /**
     * Every per-vote score averaged and rounded once (same rounding as the
     * single-vote tab). Resistance figures are averaged over evaluated votes;
     * decentralisation and final over every analysed vote, a vote where the
     * rule counts nobody adding 0.
     */
    historicalScores: GlobalResistanceScore;
    /** Average per-vote weakest-attack difficulty (0..10) across evaluated votes. */
    avgMinDifficulty: number;
    /** Average per-vote mean controllable share (0..1) across evaluated votes. */
    avgMaxShare: number;
    /** Average per-vote decentralisation score (0..10) across every analysed vote; null when never evaluated. */
    avgDecentralisationScore: number | null;
    /** Average per-vote final score (0..10) across every analysed vote (0 when nobody counted); null when never evaluated. */
    avgFinalScore: number | null;
    /** Per attack: average share and difficulty over evaluated votes, plus the texts of the vote where it captured most. */
    attacks: HistoricalAttack[];
    /** Cumulative XRD measured against the quorum across all votes. */
    totalQuorumXrd: number;
}

export interface HistoricalAttack {
    id: ConsensusAttackId;
    /** Average controllable share (0..1) across evaluated votes. */
    avgShare: number;
    /** Average continuous difficulty (0..10) across evaluated votes, rounded like a single vote. */
    difficulty: number;
    /** Highest share seen in a single vote, with that vote's metrics so its texts can be rebuilt in the reader's language. */
    worst: { maxShare: number; metrics: MethodResistanceMetrics };
}

export interface HistoricalSummary {
    votesAnalyzed: number;
    totalBallots: number;
    uniqueVoters: number;
    totalXrd: number;
    avgXrdPerVote: number;
    methods: HistoricalMethodRow[];
    mostBalanced?: HistoricalMethodRow;
    leastBalanced?: HistoricalMethodRow;
    mostEffective?: HistoricalMethodRow;
    leastEffective?: HistoricalMethodRow;
    mostDecentralised?: HistoricalMethodRow;
    mostCentralised?: HistoricalMethodRow;
    mostChanges?: HistoricalMethodRow;
}

/**
 * Runs every voting method across a collection of governance votes and
 * aggregates cumulative ballots, cumulative XRD, outcome flips, and average
 * decentralisation metrics.
 */
export function aggregateHistoricalMethods(
    inputs: HistoricalVoteInput[],
    includeAgeMethods = true,
): HistoricalSummary {
    const validInputs = inputs.filter(inp => inp.voters.some(v => v.power > 0));
    const uniqueAccounts = new Set<string>();
    let totalBallots = 0;
    let totalXrd = 0;

    type Acc = {
        votesEvaluated: number;
        changedCount: number;
        sameCount: number;
        changedEntries: ChangedVoteRef[];
        totalBallotsCounted: number;
        totalBallotsExcluded: number;
        totalEligibleXrd: number;
        totalWeightSum: number;
        nakamotoSum: number;
        nakamotoCount: number;
        spreadSum: number;
        effectiveSum: number;
        top1Sum: number;
        top10Sum: number;
        decisiveCountSum: number;
        decisiveOfSum: number;
        decisiveXrdSum: number;
        decisiveVotes: number;
        validVotes: number;
        quorumProgressSum: number;
        balanceSum: number;
        effectiveScoreSum: number;
        totalQuorumXrd: number;
        /** Sums of the unrounded per-vote scores. */
        raw: { score: number; structural: number; attack: number; min: number; avgDiff: number; avgShare: number; decent: number; final: number };
        attacks: Map<ConsensusAttackId, { shareSum: number; difficultySum: number; worst: HistoricalAttack['worst'] }>;
    };

    const byKey = new Map<MethodKey, Acc>();
    for (const spec of METHODS) {
        byKey.set(spec.key, {
            votesEvaluated: 0,
            changedCount: 0,
            sameCount: 0,
            changedEntries: [],
            totalBallotsCounted: 0,
            totalBallotsExcluded: 0,
            totalEligibleXrd: 0,
            totalWeightSum: 0,
            nakamotoSum: 0,
            nakamotoCount: 0,
            spreadSum: 0,
            effectiveSum: 0,
            top1Sum: 0,
            top10Sum: 0,
            decisiveCountSum: 0,
            decisiveOfSum: 0,
            decisiveXrdSum: 0,
            decisiveVotes: 0,
            validVotes: 0,
            quorumProgressSum: 0,
            balanceSum: 0,
            effectiveScoreSum: 0,
            totalQuorumXrd: 0,
            raw: { score: 0, structural: 0, attack: 0, min: 0, avgDiff: 0, avgShare: 0, decent: 0, final: 0 },
            attacks: new Map(),
        });
    }

    for (const { entry, voters, stanceLabel, gradeQuantile } of validInputs) {
        const countedVoters = voters.filter(v => v.power > 0);
        totalBallots += countedVoters.length;
        for (const v of countedVoters) {
            uniqueAccounts.add(v.account);
            totalXrd += v.power;
        }
        const choices = itemChoices(entry.kind, entry.item, stanceLabel);
        const results: MethodResult[] = compareMethods(countedVoters, choices, entry.item, { gradeQuantile });
        const currentRes = results.find(r => r.current);
        // Same quantile the single-vote tab passes to its score table.
        const quantile = parseQuantile(gradeQuantile);

        for (const r of results) {
            const acc = byKey.get(r.key);
            if (!acc) continue;
            // Per-vote scores, identical to the single-vote tab. Every analysed vote is in the
            // denominator: a rule that counts nobody or misses the quorum scores 0 on that vote.
            acc.effectiveScoreSum += fairEffectiveScore(r, quantile);
            acc.totalQuorumXrd += r.quorumXrd;
            if (r.counted > 0) {
                const { report, scores, metrics } = scoreMethodResult(r, quantile);
                const raw = scores.raw;
                acc.balanceSum += (raw.finalScore ?? 0) / 10;
                acc.raw.score += raw.score;
                acc.raw.structural += raw.structuralScore;
                acc.raw.attack += raw.attackScore;
                acc.raw.min += raw.minDifficulty;
                acc.raw.avgDiff += raw.avgDifficulty;
                acc.raw.avgShare += raw.avgMaxShare;
                acc.raw.decent += raw.decentralisationScore ?? 0;
                acc.raw.final += raw.finalScore ?? 0;
                for (const sc of report.scenarios) {
                    const prev = acc.attacks.get(sc.id);
                    const difficulty = computeAttackDifficulty(sc.id, sc.maxShare).rawScore;
                    const worst = !prev || sc.maxShare > prev.worst.maxShare
                        ? { maxShare: sc.maxShare, metrics }
                        : prev.worst;
                    acc.attacks.set(sc.id, {
                        shareSum: (prev?.shareSum ?? 0) + sc.maxShare,
                        difficultySum: (prev?.difficultySum ?? 0) + difficulty,
                        worst,
                    });
                }
            }
            acc.totalBallotsCounted += r.counted;
            acc.totalBallotsExcluded += r.excluded;
            acc.totalEligibleXrd += r.eligibleXrd;

            const currentHasVerdict = Boolean(currentRes && (currentRes.outcome !== null || currentRes.winner !== null));
            if (r.counted > 0) {
                acc.votesEvaluated += 1;
                acc.totalWeightSum += r.totalWeight;
                if (r.sameAsCurrent === false) {
                    acc.changedCount += 1;
                    acc.changedEntries.push({
                        entry,
                        currentOutcome: currentRes?.outcome ?? null,
                        currentWinner: currentRes?.winner?.label ?? null,
                        methodOutcome: r.outcome,
                        methodWinner: r.winner?.label ?? null,
                        methodCounted: r.counted,
                        currentSeats: currentRes?.electionSummary
                            ? { elected: currentRes.electionSummary.elected.length, total: currentRes.electionSummary.seatCount }
                            : null,
                        methodSeats: r.electionSummary
                            ? { elected: r.electionSummary.elected.length, total: r.electionSummary.seatCount }
                            : null,
                        seatsChanged: r.electionSummary?.seatsChanged ?? null,
                    });
                } else if (r.sameAsCurrent === true) {
                    acc.sameCount += 1;
                }
                if (r.concentration.nakamoto !== null) {
                    acc.nakamotoSum += r.concentration.nakamoto;
                    acc.nakamotoCount += 1;
                }
                acc.spreadSum += r.concentration.spread ?? 0;
                acc.effectiveSum += r.concentration.effective;
                acc.top1Sum += r.concentration.top1;
                acc.top10Sum += r.concentration.top10;
                if (r.quorumMet !== false) {
                    acc.validVotes += 1;
                }
                acc.quorumProgressSum += r.quorumRatio === null ? 1 : Math.min(1, r.quorumRatio);
                if (r.decisive) {
                    acc.decisiveCountSum += r.decisive.count;
                    acc.decisiveOfSum += r.counted;
                    acc.decisiveXrdSum += r.decisive.xrd;
                    acc.decisiveVotes += 1;
                }
            } else if (!r.current && currentHasVerdict) {
                // Nobody met this method's rules on a vote that 1 XRD = 1 vote settled:
                // keep the same denominator across all methods and count it as a changed outcome.
                acc.changedCount += 1;
                acc.changedEntries.push({
                    entry,
                    currentOutcome: currentRes?.outcome ?? null,
                    currentWinner: currentRes?.winner?.label ?? null,
                    methodOutcome: null,
                    methodWinner: null,
                    methodCounted: 0,
                });
            }
        }
    }

    const totalVotes = validInputs.length;
    const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
    const methods: HistoricalMethodRow[] = METHODS.map(spec => {
        const acc = byKey.get(spec.key)!;
        const evaluated = acc.votesEvaluated;
        const perEvaluated = (sum: number) => (evaluated > 0 ? sum / evaluated : 0);
        const perVote = (sum: number) => (totalVotes > 0 ? sum / totalVotes : 0);
        const avgNakamoto = acc.nakamotoCount > 0 ? acc.nakamotoSum / acc.nakamotoCount : null;
        const avgDecisiveCount = acc.decisiveVotes > 0 ? acc.decisiveCountSum / acc.decisiveVotes : null;
        const avgDecisiveOf = acc.decisiveVotes > 0 ? acc.decisiveOfSum / acc.decisiveVotes : null;
        const avgDecisiveXrd = acc.decisiveVotes > 0 ? acc.decisiveXrdSum / acc.decisiveVotes : null;
        const historicalScores = roundResistanceScore({
            score: perEvaluated(acc.raw.score),
            structuralScore: perEvaluated(acc.raw.structural),
            attackScore: perEvaluated(acc.raw.attack),
            minDifficulty: perEvaluated(acc.raw.min),
            avgDifficulty: perEvaluated(acc.raw.avgDiff),
            avgMaxShare: perEvaluated(acc.raw.avgShare),
            decentralisationScore: evaluated > 0 ? perVote(acc.raw.decent) : null,
            finalScore: evaluated > 0 ? perVote(acc.raw.final) : null,
        });
        const attacks: HistoricalAttack[] = [...acc.attacks].map(([id, a]) => {
            const avgShare = perEvaluated(a.shareSum);
            const avgDiff = perEvaluated(a.difficultySum);
            return {
                id,
                avgShare,
                difficulty: avgShare === 0 ? 10 : Math.min(9.9, Math.round(avgDiff * 10) / 10),
                worst: a.worst,
            };
        });
        return {
            key: spec.key,
            family: spec.family,
            current: spec.key === 'linear',
            needsAge: spec.needsAge,
            resistance: spec.resistance,
            votesEvaluated: evaluated,
            changedCount: acc.changedCount,
            sameCount: acc.sameCount,
            changedEntries: acc.changedEntries,
            totalBallotsCounted: acc.totalBallotsCounted,
            totalBallotsExcluded: acc.totalBallotsExcluded,
            totalEligibleXrd: acc.totalEligibleXrd,
            avgTotalWeight: perEvaluated(acc.totalWeightSum),
            avgNakamoto,
            avgSpread: evaluated > 0 ? perVote(acc.spreadSum) : null,
            avgEffective: perEvaluated(acc.effectiveSum),
            avgTop1: perEvaluated(acc.top1Sum),
            avgTop10: perEvaluated(acc.top10Sum),
            avgDecisiveCount,
            avgDecisiveOf,
            avgDecisiveXrd,
            totalDecisiveXrd: acc.decisiveXrdSum,
            decisiveVotesCount: acc.decisiveVotes,
            validVotesCount: acc.validVotes,
            avgQuorumProgress: perVote(acc.quorumProgressSum),
            balanceScore: round6(perVote(acc.balanceSum)),
            effectiveScore: round6(perVote(acc.effectiveScoreSum)),
            avgResistanceScore: historicalScores.score,
            historicalScores,
            avgMinDifficulty: historicalScores.minDifficulty,
            avgMaxShare: historicalScores.avgMaxShare,
            avgDecentralisationScore: historicalScores.decentralisationScore,
            avgFinalScore: historicalScores.finalScore,
            attacks,
            totalQuorumXrd: acc.totalQuorumXrd,
        };
    });

    const ready = methods.filter(m => (!m.needsAge || includeAgeMethods) && m.votesEvaluated > 0);
    const gap = (m: HistoricalMethodRow) => Math.abs(m.historicalScores.raw.score / 10 - (m.avgSpread ?? 0));
    const { most: mostBalanced, least: leastBalanced } = extremesBy(ready, m => m.balanceScore, (a, b) => gap(a) - gap(b));
    const { most: mostDecentralised, least: mostCentralised } = spreadExtremes(ready, m => m.avgSpread);
    const { most: mostEffective, least: leastEffective } = !ready.some(m => m.effectiveScore > 0) ? {} : extremesBy(
        ready,
        m => m.effectiveScore,
        // Least effective tie-break: lower quorum progress, then lower decentralisation.
        (a, b) => (b.avgQuorumProgress - a.avgQuorumProgress) || ((b.avgSpread ?? 0) - (a.avgSpread ?? 0)),
    );
    const mostChanges = ready
        .filter(m => !m.current)
        .reduce<HistoricalMethodRow | undefined>(
            (best, m) => (!best || m.changedCount > best.changedCount ? m : best),
            undefined,
        );

    return {
        votesAnalyzed: validInputs.length,
        totalBallots,
        uniqueVoters: uniqueAccounts.size,
        totalXrd,
        avgXrdPerVote: validInputs.length > 0 ? totalXrd / validInputs.length : 0,
        methods,
        mostBalanced,
        leastBalanced,
        mostEffective,
        leastEffective,
        mostDecentralised,
        mostCentralised,
        mostChanges,
    };
}

/**
 * Highest and lowest items by `score` (first one wins a tie for `most`).
 * `leastTie(a, b) > 0` makes `a` the worse of two equally scored items.
 */
function extremesBy<T>(
    items: T[],
    score: (item: T) => number,
    leastTie: (a: T, b: T) => number,
): { most?: T; least?: T } {
    let most: T | undefined;
    let least: T | undefined;
    for (const item of items) {
        const s = score(item);
        if (!most || s > score(most)) most = item;
        if (!least || s < score(least) || (s === score(least) && leastTie(item, least) > 0)) least = item;
    }
    return { most, least };
}
