import {
    METHODS,
    balanceExtremesBy,
    balanceScoreOf,
    compareMethods,
    effectiveExtremesBy,
    effectiveScoreOf,
    spreadExtremes,
    type MethodFamily,
    type MethodKey,
    type MethodResult,
    type MethodVoter,
    type Resistance,
} from './votingMethods';
import { itemChoices, type VoteOutcome } from './governanceVotes';
import type { GovernanceEntry } from '../types';

export interface HistoricalVoteInput {
    entry: GovernanceEntry;
    voters: MethodVoter[];
    /** Optional stance label resolver for ballot choices. */
    stanceLabel?: (stance: string) => string;
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
    /** Average Nakamoto coefficient across evaluated votes. */
    avgNakamoto: number | null;
    /** Average decentralisation (Simpson evenness, 0..1) across evaluated votes. */
    avgSpread: number | null;
    /** Average effective voters across evaluated votes. */
    avgEffective: number;
    /** Average largest-voter weight share (0..1). */
    avgTop1: number;
    /** Average top-10 weight share (0..1). */
    avgTop10: number;
    /** Average fewest winning-side voters sufficient to decide a vote. */
    avgDecisiveCount: number | null;
    /** Average total winning-side voters across decided votes. */
    avgDecisiveOf: number | null;
    /** Average XRD held by the decisive voters per vote. */
    avgDecisiveXrd: number | null;
    /** Cumulative XRD held by decisive voters across all decided votes. */
    totalDecisiveXrd: number;
    /** Number of votes where this method reached quorum and decided an outcome. */
    decisiveVotesCount: number;
    /** Number of analysed votes where this method had qualifying voters and met quorum (when required). */
    validVotesCount: number;
    /** Historical balance score: geometric mean of resistance and average decentralisation. */
    balanceScore: number;
    /** Historical effectiveness score: 3-factor geometric mean of resistance, decentralisation, and quorum rate. */
    effectiveScore: number;
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
        nakamotoSum: number;
        nakamotoCount: number;
        spreadSum: number;
        spreadCount: number;
        effectiveSum: number;
        top1Sum: number;
        top10Sum: number;
        decisiveCountSum: number;
        decisiveOfSum: number;
        decisiveXrdSum: number;
        decisiveVotes: number;
        validVotes: number;
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
            nakamotoSum: 0,
            nakamotoCount: 0,
            spreadSum: 0,
            spreadCount: 0,
            effectiveSum: 0,
            top1Sum: 0,
            top10Sum: 0,
            decisiveCountSum: 0,
            decisiveOfSum: 0,
            decisiveXrdSum: 0,
            decisiveVotes: 0,
            validVotes: 0,
        });
    }

    for (const { entry, voters, stanceLabel } of validInputs) {
        const countedVoters = voters.filter(v => v.power > 0);
        totalBallots += countedVoters.length;
        for (const v of countedVoters) {
            uniqueAccounts.add(v.account);
            totalXrd += v.power;
        }
        const choices = itemChoices(entry.kind, entry.item, stanceLabel);
        const results: MethodResult[] = compareMethods(countedVoters, choices, entry.item);
        const currentRes = results.find(r => r.current);

        for (const r of results) {
            const acc = byKey.get(r.key);
            if (!acc) continue;
            acc.totalBallotsCounted += r.counted;
            acc.totalBallotsExcluded += r.excluded;
            acc.totalEligibleXrd += r.eligibleXrd;

            const currentHasVerdict = Boolean(currentRes && (currentRes.outcome !== null || currentRes.winner !== null));
            if (r.counted > 0) {
                acc.votesEvaluated += 1;
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
                if (r.concentration.spread !== null) {
                    acc.spreadSum += r.concentration.spread;
                    acc.spreadCount += 1;
                }
                acc.effectiveSum += r.concentration.effective;
                acc.top1Sum += r.concentration.top1;
                acc.top10Sum += r.concentration.top10;
                if (r.quorumMet !== false) {
                    acc.validVotes += 1;
                }
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

    const methods: HistoricalMethodRow[] = METHODS.map(spec => {
        const acc = byKey.get(spec.key)!;
        const avgNakamoto = acc.nakamotoCount > 0 ? acc.nakamotoSum / acc.nakamotoCount : null;
        const avgSpread = acc.spreadCount > 0 ? acc.spreadSum / acc.spreadCount : null;
        const avgEffective = acc.votesEvaluated > 0 ? acc.effectiveSum / acc.votesEvaluated : 0;
        const avgTop1 = acc.votesEvaluated > 0 ? acc.top1Sum / acc.votesEvaluated : 0;
        const avgTop10 = acc.votesEvaluated > 0 ? acc.top10Sum / acc.votesEvaluated : 0;
        const avgDecisiveCount = acc.decisiveVotes > 0 ? acc.decisiveCountSum / acc.decisiveVotes : null;
        const avgDecisiveOf = acc.decisiveVotes > 0 ? acc.decisiveOfSum / acc.decisiveVotes : null;
        const avgDecisiveXrd = acc.decisiveVotes > 0 ? acc.decisiveXrdSum / acc.decisiveVotes : null;
        const score = balanceScoreOf(spec.resistance, avgSpread);
        const validRate = validInputs.length > 0 ? acc.validVotes / validInputs.length : 0;
        const effectiveScore = effectiveScoreOf(spec.resistance, avgSpread, validRate);
        return {
            key: spec.key,
            family: spec.family,
            current: spec.key === 'linear',
            needsAge: spec.needsAge,
            resistance: spec.resistance,
            votesEvaluated: acc.votesEvaluated,
            changedCount: acc.changedCount,
            sameCount: acc.sameCount,
            changedEntries: acc.changedEntries,
            totalBallotsCounted: acc.totalBallotsCounted,
            totalBallotsExcluded: acc.totalBallotsExcluded,
            totalEligibleXrd: acc.totalEligibleXrd,
            avgNakamoto,
            avgSpread,
            avgEffective,
            avgTop1,
            avgTop10,
            avgDecisiveCount,
            avgDecisiveOf,
            avgDecisiveXrd,
            totalDecisiveXrd: acc.decisiveXrdSum,
            decisiveVotesCount: acc.decisiveVotes,
            validVotesCount: acc.validVotes,
            balanceScore: score,
            effectiveScore,
        };
    });

    const ready = methods.filter(m => (!m.needsAge || includeAgeMethods) && m.votesEvaluated > 0);
    const { most: mostBalanced, least: leastBalanced } = balanceExtremesBy(ready, m => m.avgSpread);
    const { most: mostDecentralised, least: mostCentralised } = spreadExtremes(ready, m => m.avgSpread);
    const { most: mostEffective, least: leastEffective } = effectiveExtremesBy(
        ready,
        m => m.avgSpread,
        m => (validInputs.length > 0 ? m.validVotesCount / validInputs.length : 0),
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
