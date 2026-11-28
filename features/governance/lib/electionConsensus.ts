import type { MajorityJudgmentElectionData } from '../types';
import { parseQuantile } from './majorityJudgment';
import { fairEffectiveScore } from './consensusResistance';
import type { MethodFamily, MethodKey } from './methodCatalog';
import type { MethodResult } from './votingMethods';

export interface ElectionConsensusCandidate {
    id: number;
    label: string;
    /** Consensus rank (1..N) across all evaluated methods. */
    consensusRank: number;
    /** Baseline rank under 1 XRD = 1 vote, when available. */
    currentRank: number | null;
    /** Fair weighted share of methods electing this candidate (0..1; cutoff ties count 0.5). */
    consensusShare: number;
    /** Raw number of evaluated methods where this candidate is elected. */
    electedCount: number;
    /** Raw number of evaluated methods where this candidate is tied at the seat cutoff. */
    tiedCount: number;
    /** Total evaluated methods included in the consensus. */
    evaluatedMethods: number;
    /** Weighted average rank across all evaluated methods. */
    avgRank: number;
    /** Weighted most frequent qualifying grade (0..4). */
    modalGrade: number;
    /** True when inside the top `seatCount` of the consensus ranking. */
    inSeats: boolean;
    /** True when `inSeats` differs from the baseline 1 XRD = 1 vote elected slate. */
    changedFromCurrent: boolean;
}

export interface ElectionConsensusConcentration {
    /** Weighted average addresses needed to reach the applied grade quantile (e.g. 60 %). */
    decisiveQuantile: number | null;
    /** Weighted average Nakamoto coefficient (>50 % of weight). */
    nakamoto: number | null;
    /** Weighted average Top 1 share (0..1). */
    top1: number;
    /** Weighted average Top 10 share (0..1). */
    top10: number;
    /** Weighted average degree of decentralisation (Simpson evenness, 0..1). */
    spread: number | null;
    /** Weighted average effective voters (1 / Σ share²). */
    effective: number;
    /** Weighted average counted voters across the evaluated methods. */
    counted: number;
}

export interface ElectionConsensusFamilySummary {
    family: MethodFamily;
    methodCount: number;
    avgSpread: number;
    sameAsCurrentCount: number;
}

export interface ElectionConsensusConclusions {
    gradeQuantile: string;
    quantileValue: number;
    currentDecisiveBlock: {
        count: number;
        total: number;
        share: number;
        xrd: number;
    } | null;
    weightedDecisiveBlock: {
        avgCount: number;
        avgTotal: number;
        share: number;
        ratioVsCurrent: number | null;
    } | null;
    councilStability: {
        sameAsCurrentCount: number;
        alternativeMethodsCount: number;
        sameAsCurrentShare: number;
        solidSeats: Array<{ id: number; label: string; consensusRank: number; consensusShare: number; electedCount: number; evaluatedMethods: number }>;
        enteredSeats: Array<{ id: number; label: string; consensusRank: number; currentRank: number | null; consensusShare: number }>;
        droppedSeats: Array<{ id: number; label: string; consensusRank: number; currentRank: number | null; consensusShare: number }>;
    };
    quorum: {
        /** Quorum the vote requires, in XRD (not the XRD reached). */
        quorumRequiredXrd: number | null;
        metCount: number;
        totalMethods: number;
    };
    byFamily: ElectionConsensusFamilySummary[];
}

export interface ElectionConsensusSummary {
    seatCount: number;
    evaluatedMethods: number;
    /** Families present among the evaluated methods; each carries 1 / familyCount of the weight. */
    familyCount: number;
    candidates: ElectionConsensusCandidate[];
    /** Concentration & decisive-block metrics averaged with the exact consensus weights. */
    weightedConcentration: ElectionConsensusConcentration;
    /** Exact normalized consensus weight (0..1, summing to 1) of each evaluated method. */
    methodWeights: Partial<Record<MethodKey, number>>;
}

export {
    ATTACK_OPERATIONAL_COST,
    CURRENT_ATTACK_SHARES,
    computeAttackDifficulty,
    computeConsensusResistance,
    computeConsensusStructuralRatio,
    computeGlobalResistanceScore,
    computeHistoricalMethodScoreRows,
    computeMethodScoreRows,
    methodResistanceMetricsFromHistorical,
    methodResistanceMetricsFromResult,
    nextMethodScoreSort,
    resistanceLevelFromScore,
    roundResistanceScore,
    scoreMethodResult,
    fairBalanceScore,
    fairEffectiveScore,
    fairScoreExtremes,
    controlShare,
    CONTROL_SHARE,
    sortMethodScoreRows,
    type AttackDifficulty,
    type AttackOperationalCost,
    type ConsensusAttackId,
    type ConsensusAttackScenario,
    type GlobalResistanceScore,
    type RawResistanceScore,
    type MethodScoreRow,
    type MethodScoreSortKey,
    type MethodScoreSortState,
    type SortDirection,
} from './consensusResistance';

const FAMILY_ORDER: readonly MethodFamily[] = ['wealth', 'address', 'seniority', 'hybrid'];

/** Computes the structured conclusions summary shown in the Consensus modal and exported to JSON. */
export function computeElectionConclusions(
    consensus: ElectionConsensusSummary,
    methods: MethodResult[],
    voterPowers: number[],
    quorumXrd: number | null,
    gradeQuantile?: string | null,
): ElectionConsensusConclusions {
    const quantileRaw = gradeQuantile || '3/5';
    const quantileValue = parseQuantile(quantileRaw);
    const sortedPowers = [...voterPowers].filter(p => p > 0).sort((a, b) => b - a);
    const totalPower = sortedPowers.reduce((s, x) => s + x, 0);
    let accPower = 0;
    let decisiveCount = 0;
    for (const p of sortedPowers) {
        accPower += p;
        decisiveCount += 1;
        if (accPower >= totalPower * quantileValue) break;
    }
    const currentDecisiveBlock = sortedPowers.length > 0
        ? {
            count: decisiveCount,
            total: sortedPowers.length,
            share: Math.round((decisiveCount / sortedPowers.length) * 1e6) / 1e6,
            xrd: Math.round(accPower * 100) / 100,
        }
        : null;

    const wc = consensus.weightedConcentration;
    const weightedDecisiveBlock = wc.decisiveQuantile != null
        ? {
            avgCount: wc.decisiveQuantile,
            avgTotal: wc.counted,
            share: wc.counted > 0 ? Math.round((wc.decisiveQuantile / wc.counted) * 1e6) / 1e6 : 0,
            ratioVsCurrent: decisiveCount > 0 ? Math.round((wc.decisiveQuantile / decisiveCount) * 100) / 100 : null,
        }
        : null;

    const others = methods.filter(m => !m.current);
    const sameAsCurrentCount = others.filter(m => m.sameAsCurrent).length;

    const solidSeats = consensus.candidates
        .filter(cand => cand.inSeats && cand.consensusShare >= 0.8)
        .map(cand => ({
            id: cand.id,
            label: cand.label,
            consensusRank: cand.consensusRank,
            consensusShare: cand.consensusShare,
            electedCount: cand.electedCount,
            evaluatedMethods: cand.evaluatedMethods,
        }));
    const enteredSeats = consensus.candidates
        .filter(cand => cand.changedFromCurrent && cand.inSeats)
        .map(cand => ({
            id: cand.id,
            label: cand.label,
            consensusRank: cand.consensusRank,
            currentRank: cand.currentRank,
            consensusShare: cand.consensusShare,
        }));
    const droppedSeats = consensus.candidates
        .filter(cand => cand.changedFromCurrent && !cand.inSeats)
        .map(cand => ({
            id: cand.id,
            label: cand.label,
            consensusRank: cand.consensusRank,
            currentRank: cand.currentRank,
            consensusShare: cand.consensusShare,
        }));

    const byFamily: ElectionConsensusFamilySummary[] = [];
    for (const fam of FAMILY_ORDER) {
        const famMethods = methods.filter(m => m.family === fam);
        if (famMethods.length === 0) continue;
        const spreads = famMethods.map(m => m.concentration.spread).filter((s): s is number => s !== null);
        const avgSpread = spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0;
        byFamily.push({
            family: fam,
            methodCount: famMethods.length,
            avgSpread: Math.round(avgSpread * 1e6) / 1e6,
            // The current method is the reference, not a match: same rule as the stability count.
            sameAsCurrentCount: famMethods.filter(m => !m.current && m.sameAsCurrent).length,
        });
    }

    return {
        gradeQuantile: quantileRaw,
        quantileValue,
        currentDecisiveBlock,
        weightedDecisiveBlock,
        councilStability: {
            sameAsCurrentCount,
            alternativeMethodsCount: others.length,
            sameAsCurrentShare: others.length > 0 ? Math.round((sameAsCurrentCount / others.length) * 1e6) / 1e6 : 0,
            solidSeats,
            enteredSeats,
            droppedSeats,
        },
        quorum: {
            quorumRequiredXrd: quorumXrd,
            metCount: methods.filter(m => m.quorumMet !== false).length,
            totalMethods: methods.length,
        },
        byFamily,
    };
}

/**
 * Family-balanced, effectiveness-weighted consensus across all evaluated
 * voting methods (including 1 XRD = 1 vote).
 *
 * Each method family present among the evaluated methods (up to 4: wealth,
 * address, seniority, hybrid) carries an equal share (1 / families) so families
 * with more variants cannot dominate by count.
 * Within each family, every method participates with weight `0.25 + 0.75 * fairEffectiveScore(m)`
 * (the same effectiveness index as the KPI tiles: 0..10 resistance score, decentralisation and quorum),
 * rewarding Sybil-resistant, decentralised, quorum-meeting rules up to 4x while
 * still counting all 50 methods.
 */
export function computeElectionConsensus(
    results: MethodResult[],
    baselineElectionData?: MajorityJudgmentElectionData | null,
): ElectionConsensusSummary | null {
    const evaluated = results.filter(r => r.electionSummary && r.counted > 0);
    if (evaluated.length === 0) return null;

    const seatCount = evaluated[0].electionSummary!.seatCount;
    const current = evaluated.find(r => r.current);
    // Same quantile the score table uses for this election.
    const quantile = parseQuantile(baselineElectionData?.gradeQuantileApplied);

    // Baseline = 1 XRD = 1 vote recounted from the same ballots every other method uses, so
    // "#3 -> #8" here always matches the per-method panels. The official collector ranking
    // (shown above, with a note when its totals differ) is only a fallback.
    const officialResults = baselineElectionData?.candidateResults ?? [];
    const useOfficialBaseline = !current?.electionSummary && officialResults.length > 0;
    const baselineSorted = useOfficialBaseline
        ? [...officialResults].sort((a, b) => a.rank - b.rank || a.candidateId - b.candidateId)
        : [];
    const currentElectedIds = useOfficialBaseline
        ? new Set(baselineSorted.slice(0, seatCount).map(c => c.candidateId))
        : new Set(current?.electionSummary?.elected.map(c => c.id) ?? []);
    const currentRankById = useOfficialBaseline
        ? new Map(officialResults.map(c => [c.candidateId, c.rank]))
        : new Map(current?.electionSummary?.standings.map(c => [c.id, c.rank]) ?? []);
    const hasBaseline = useOfficialBaseline || current != null;

    // Group by family and compute normalized weights summing to 1.
    const byFamily = new Map<MethodFamily, MethodResult[]>();
    for (const r of evaluated) {
        const list = byFamily.get(r.family);
        if (list) list.push(r);
        else byFamily.set(r.family, [r]);
    }
    const familyShare = 1 / byFamily.size;
    const weightOf = new Map<MethodKey, number>();
    for (const group of byFamily.values()) {
        const raw = group.map(m => 0.25 + 0.75 * fairEffectiveScore(m, quantile));
        const sum = raw.reduce((a, b) => a + b, 0);
        group.forEach((m, i) => {
            weightOf.set(m.key, sum > 0 ? familyShare * (raw[i] / sum) : familyShare / group.length);
        });
    }

    // Seed candidate metadata from the first evaluated method.
    const acc = new Map<number, {
        id: number;
        label: string;
        consensusShare: number;
        electedCount: number;
        tiedCount: number;
        avgRank: number;
        gradeWeights: [number, number, number, number, number];
    }>();
    for (const cand of evaluated[0].electionSummary!.standings) {
        acc.set(cand.id, {
            id: cand.id,
            label: cand.label,
            consensusShare: 0,
            electedCount: 0,
            tiedCount: 0,
            avgRank: 0,
            gradeWeights: [0, 0, 0, 0, 0],
        });
    }

    let wDecisive = 0;
    let wDecisiveWeight = 0;
    let wNakamoto = 0;
    let wNakamotoWeight = 0;
    let wSpread = 0;
    let wSpreadWeight = 0;
    let wTop1 = 0;
    let wTop10 = 0;
    let wEffective = 0;
    let wCounted = 0;

    for (const m of evaluated) {
        const summary = m.electionSummary!;
        const w = weightOf.get(m.key) ?? 0;
        if (summary.decisiveQuantileCount != null) {
            wDecisive += w * summary.decisiveQuantileCount;
            wDecisiveWeight += w;
        }
        if (m.concentration.nakamoto != null) {
            wNakamoto += w * m.concentration.nakamoto;
            wNakamotoWeight += w;
        }
        if (m.concentration.spread != null) {
            wSpread += w * m.concentration.spread;
            wSpreadWeight += w;
        }
        wTop1 += w * m.concentration.top1;
        wTop10 += w * m.concentration.top10;
        wEffective += w * m.concentration.effective;
        wCounted += w * m.counted;
        const electedIds = new Set(summary.elected.map(c => c.id));
        const tiedIds = new Set(summary.tiedAtCutoff.map(c => c.id));
        for (const cand of summary.standings) {
            const entry = acc.get(cand.id);
            if (!entry) continue;
            if (electedIds.has(cand.id)) {
                entry.consensusShare += w;
                entry.electedCount += 1;
            } else if (tiedIds.has(cand.id)) {
                entry.consensusShare += w * 0.5;
                entry.tiedCount += 1;
            }
            entry.avgRank += w * cand.rank;
            if (cand.qualifyingGrade >= 0 && cand.qualifyingGrade <= 4) {
                entry.gradeWeights[cand.qualifyingGrade] += w;
            }
        }
    }

    const sorted = [...acc.values()]
        .map(entry => {
            let modalGrade = 0;
            let bestWeight = -1;
            for (let g = 4; g >= 0; g--) {
                if (entry.gradeWeights[g] > bestWeight) {
                    bestWeight = entry.gradeWeights[g];
                    modalGrade = g;
                }
            }
            return { ...entry, modalGrade };
        })
        .sort((a, b) => {
            const shareDiff = Math.round(b.consensusShare * 1e6) - Math.round(a.consensusShare * 1e6);
            if (shareDiff !== 0) return shareDiff;
            const rankDiff = Math.round(a.avgRank * 1e6) - Math.round(b.avgRank * 1e6);
            if (rankDiff !== 0) return rankDiff;
            if (b.modalGrade !== a.modalGrade) return b.modalGrade - a.modalGrade;
            return a.id - b.id;
        });

    const candidates: ElectionConsensusCandidate[] = sorted.map((entry, idx) => {
        const inSeats = idx < seatCount;
        return {
            id: entry.id,
            label: entry.label,
            consensusRank: idx + 1,
            currentRank: currentRankById.get(entry.id) ?? null,
            consensusShare: Math.round(entry.consensusShare * 1e6) / 1e6,
            electedCount: entry.electedCount,
            tiedCount: entry.tiedCount,
            evaluatedMethods: evaluated.length,
            avgRank: Math.round(entry.avgRank * 100) / 100,
            modalGrade: entry.modalGrade,
            inSeats,
            changedFromCurrent: hasBaseline && inSeats !== currentElectedIds.has(entry.id),
        };
    });

    const methodWeights: Partial<Record<MethodKey, number>> = {};
    for (const [k, w] of weightOf) methodWeights[k] = w;

    return {
        seatCount,
        evaluatedMethods: evaluated.length,
        familyCount: byFamily.size,
        candidates,
        weightedConcentration: {
            decisiveQuantile: wDecisiveWeight > 0 ? Math.round((wDecisive / wDecisiveWeight) * 10) / 10 : null,
            nakamoto: wNakamotoWeight > 0 ? Math.round((wNakamoto / wNakamotoWeight) * 10) / 10 : null,
            top1: Math.round(wTop1 * 1e6) / 1e6,
            top10: Math.round(wTop10 * 1e6) / 1e6,
            spread: wSpreadWeight > 0 ? Math.round((wSpread / wSpreadWeight) * 1e6) / 1e6 : null,
            effective: Math.round(wEffective * 10) / 10,
            counted: Math.round(wCounted * 10) / 10,
        },
        methodWeights,
    };
}
