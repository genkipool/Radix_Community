import { describe, it, expect } from 'vitest';
import esDict from '@/features/governance/locales/es.json';
import enDict from '@/features/governance/locales/en.json';
import {
    ATTACK_OPERATIONAL_COST,
    CURRENT_ATTACK_SHARES,
    METHODS,
    compareMethods,
    computeAttackDifficulty,
    computeConsensusResistance,
    computeGlobalResistanceScore,
    computeHistoricalMethodScoreRows,
    computeMethodResistance,
    computeMethodScoreRows,
    methodResistanceMetricsFromHistorical,
    methodResistanceMetricsFromResult,
    nextMethodScoreSort,
    sortMethodScoreRows,
    type ConsensusAttackId,
    type MethodKey,
    type MethodResistanceMetrics,
    type MethodVoter,
} from '@/features/governance/lib/votingMethods';
import { aggregateHistoricalMethods } from '@/features/governance/lib/historicalMethods';
import { itemChoices, type GovernanceItem } from '@/features/governance/lib/governanceVotes';

const esCompare = esDict.governance.compare as unknown as Record<string, string>;
const enCompare = enDict.governance.compare as unknown as Record<string, string>;

const baseMetrics = {
    counted: 120,
    eligibleXrd: 100_000_000,
    totalWeight: 100_000_000,
    decisiveQuantileCount: 5,
    decisiveCount: 4,
    decisiveOf: 80,
    validVotesCount: 18,
    totalVotes: 20,
    avgNakamoto: 4.5,
    isElection: true,
    isHistorical: false,
    quantile: 0.6,
};

const sharesOf = (key: MethodKey, metrics = baseMetrics) =>
    Object.fromEntries(computeMethodResistance(key, metrics).scenarios.map(s => [s.id, s.maxShare]));

describe('computeMethodResistance (all 50 methods)', () => {
    it('evaluates all 50 methods with 7 valid scenarios and existing ES + EN locale keys', () => {
        expect(METHODS.length).toBe(50);

        for (const spec of METHODS) {
            const report = computeMethodResistance(spec.key, baseMetrics, 'es');
            expect(report.resistance).toBe(spec.resistance);
            expect(report.scenarios).toHaveLength(7);

            for (const key of [
                report.intro1Key,
                report.tableNoteKey,
                report.nuancePositiveKey,
                report.nuanceWarningKey,
                report.summaryKey,
            ]) {
                expect(esCompare[key], `Missing ES key: ${key}`).toBeTruthy();
                expect(enCompare[key], `Missing EN key: ${key}`).toBeTruthy();
            }

            for (const s of report.scenarios) {
                expect(Number.isFinite(s.maxShare)).toBe(true);
                expect(s.maxShare).toBeGreaterThanOrEqual(0);
                expect(s.maxShare).toBeLessThanOrEqual(1);
                expect(esCompare[s.capturesKey], `Missing ES key: ${s.capturesKey}`).toBeTruthy();
                expect(enCompare[s.capturesKey], `Missing EN key: ${s.capturesKey}`).toBeTruthy();
                expect(esCompare[s.blockedKey], `Missing ES key: ${s.blockedKey}`).toBeTruthy();
                expect(enCompare[s.blockedKey], `Missing EN key: ${s.blockedKey}`).toBeTruthy();
                // Zero unresolved placeholders when interpolated
                const unfilledEs = esCompare[s.capturesKey].match(/\{([^}]+)\}/g) ?? [];
                for (const ph of unfilledEs) {
                    const name = ph.slice(1, -1);
                    expect(s.params[name], `Missing param ${name} for ${spec.key}.${s.capturesKey}`).toBeDefined();
                }
            }
        }
    });

    it('matches CURRENT_ATTACK_SHARES identically on linear (1 XRD = 1 vote)', () => {
        const shares = sharesOf('linear');
        for (const expected of CURRENT_ATTACK_SHARES) {
            expect(shares[expected.id]).toBe(expected.maxShare);
        }
    });

    it('held_90d blocks all 4 last-minute attacks cleanly at 0 %', () => {
        const shares = sharesOf('held_90d');
        expect(shares.cheap_sybil).toBe(0);
        expect(shares.funded_sybil).toBe(0);
        expect(shares.opportunistic_whale).toBe(0);
        expect(shares.split_whale).toBe(0);
        expect(shares.veteran_whale).toBe(1);
        expect(shares.veteran_sybil_farm).toBe(0);
        expect(shares.nation_state).toBe(1);
    });

    it('twab_90d cuts last-minute buys to 1/4 (~27.27 % when W = E) while allowing veteran whales', () => {
        const shares = sharesOf('twab_90d');
        expect(shares.cheap_sybil).toBe(0);
        expect(shares.funded_sybil).toBe(0);
        // 0.375 * E / (1 * E + 0.375 * E) = 0.375 / 1.375 = 3/11
        expect(shares.opportunistic_whale).toBeCloseTo(3 / 11, 6);
        expect(shares.split_whale).toBeCloseTo(3 / 11, 6);
        expect(shares.veteran_whale).toBe(1);
    });

    it('distinguishes capped_10k (captured by 10k funded sybil) from higher fixed caps', () => {
        expect(sharesOf('capped_10k').funded_sybil).toBe(1);
        for (const k of ['capped_100k', 'capped', 'capped_5m', 'capped_10m'] as const) {
            expect(sharesOf(k).funded_sybil).toBe(0);
        }
        // Single whale share scales realistically with vote size
        const smallVote = sharesOf('capped_10m', { ...baseMetrics, eligibleXrd: 5_000_000, totalWeight: 5_000_000 });
        expect(smallVote.opportunistic_whale).toBeCloseTo(10_000_000 / 15_000_000, 6);
        const largeVote = sharesOf('capped_10m', { ...baseMetrics, eligibleXrd: 200_000_000, totalWeight: 200_000_000 });
        expect(largeVote.opportunistic_whale).toBeCloseTo(10_000_000 / 210_000_000, 6);
    });

    it('models funded bypass on caps/exclusions and veteran sybil farm scaling across >=10k floors', () => {
        // Under capped methods where W < E, splitting 25% of participating XRD across small new wallets captures > 0 %.
        expect(sharesOf('capped', { ...baseMetrics, eligibleXrd: 100_000_000, totalWeight: 20_000_000 }).funded_sybil).toBeGreaterThan(0.5);

        // Veteran sybil farm scales down monotonically as the minimum XRD floor rises, while pure XRP-weighted veterans stays 0.
        const s10k = sharesOf('one_address_sybil_10k').veteran_sybil_farm;
        const s100k = sharesOf('one_address_sybil_100k').veteran_sybil_farm;
        const s1m = sharesOf('one_address_sybil_1m').veteran_sybil_farm;
        expect(s10k).toBeGreaterThan(s100k);
        expect(s100k).toBeGreaterThan(s1m);
        expect(s1m).toBeGreaterThan(0);
        expect(sharesOf('veterans').veteran_sybil_farm).toBe(0);

        for (const vulnerable of [
            'one_address_sybil',
            'one_address_sybil_age',
            'veterans_address',
            'sybil_quadratic',
        ] as const) {
            expect(sharesOf(vulnerable).veteran_sybil_farm).toBe(1);
        }
    });

    it('models exclusion rules (no_top1, no_whales) and dual-chamber rules accurately', () => {
        expect(sharesOf('no_top1').opportunistic_whale).toBe(0);
        expect(sharesOf('no_top1').veteran_whale).toBe(0);
        expect(sharesOf('no_top1').split_whale).toBe(1);

        expect(sharesOf('no_whales').opportunistic_whale).toBe(0);
        expect(sharesOf('no_whales').veteran_whale).toBe(0);
        expect(sharesOf('no_whales').split_whale).toBe(1);

        expect(sharesOf('double_majority').cheap_sybil).toBe(0.5);
        expect(sharesOf('double_majority').split_whale).toBe(1);

        expect(sharesOf('double_majority_sybil').cheap_sybil).toBe(0);
        expect(sharesOf('double_majority_sybil').split_whale).toBe(0.5);
    });

    it('handles zero counted voters without NaN or Infinity across all 50 methods', () => {
        const empty = { ...baseMetrics, counted: 0, eligibleXrd: 0, totalWeight: 0 };
        for (const spec of METHODS) {
            const report = computeMethodResistance(spec.key, empty, 'en');
            expect(report.hasLiveData).toBe(false);
            expect(report.tableNoteKey).toBe('method_res_table_note_empty');
            for (const s of report.scenarios) {
                expect(Number.isFinite(s.maxShare)).toBe(true);
            }
        }
    });
});

describe('totalWeight, decisiveQuantileXrd, avgTotalWeight, and consensus funded_sybil', () => {
    it('exposes exact totalWeight, election decisiveQuantileXrd, and historical avgTotalWeight', () => {
        const electionItem: GovernanceItem = {
            title: 'Council',
            shortDescription: null,
            description: null,
            options: [],
            links: [],
            voteCount: null,
            revoteCount: null,
            start: 1_750_000_000,
            deadline: null,
            quorum: 1_000,
            approvalThreshold: null,
            author: null,
            parameterLabel: null,
            elevatedProposalId: null,
            temperatureCheckId: null,
            maxSelections: 1,
            hidden: false,
            votersStore: null,
            election: {
                roleId: null,
                seatCount: 1,
                minimumMedianGrade: 2,
                candidates: [
                    { id: 1, displayName: 'Alice', reference: null, description: null, links: [], displayOrder: 0 },
                    { id: 2, displayName: 'Bob', reference: null, description: null, links: [], displayOrder: 1 },
                ],
            },
        };
        const voters: MethodVoter[] = [
            { account: 'a1', choices: [], grades: { '1': 4, '2': 2 }, power: 600, ageDays: 900, stakedXrd: 600, twab90Xrd: 600, min90Xrd: 600 },
            { account: 'a2', choices: [], grades: { '1': 3, '2': 4 }, power: 400, ageDays: 900, stakedXrd: 400, twab90Xrd: 400, min90Xrd: 400 },
        ];
        const choices = itemChoices('election', electionItem);
        const results = compareMethods(voters, choices, electionItem, { gradeQuantile: '3/5' });
        const lin = results.find(r => r.key === 'linear')!;
        expect(lin.totalWeight).toBe(1000);
        // 60 % of 1000 = 600 -> single heaviest voter (600 XRD) reaches 60 %
        expect(lin.electionSummary?.decisiveQuantileCount).toBe(1);
        expect(lin.electionSummary?.decisiveQuantileXrd).toBe(600);

        const quad = results.find(r => r.key === 'quadratic')!;
        expect(quad.totalWeight).toBeCloseTo(Math.sqrt(600) + Math.sqrt(400), 6);

        const consensusWeights = Object.fromEntries(results.map(r => [r.key, 1 / results.length]));
        const consRes = computeConsensusResistance(results, consensusWeights);
        expect(consRes).toHaveLength(7);

        const hist = aggregateHistoricalMethods([{
            entry: { systemKey: 'radix_dao', systemName: 'Radix DAO', kind: 'election', id: '1', item: electionItem },
            voters,
            gradeQuantile: '3/5',
        }], true);
        const histLin = hist.methods.find(m => m.key === 'linear')!;
        expect(histLin.avgTotalWeight).toBe(1000);
    });

    it('computes 0/10..10/10 attack difficulty monotonically with full operational transparency', () => {
        const ids = Object.keys(ATTACK_OPERATIONAL_COST) as ConsensusAttackId[];
        expect(ids).toHaveLength(7);

        expect(computeAttackDifficulty('cheap_sybil', 1).score).toBe(0);
        expect(computeAttackDifficulty('opportunistic_whale', 1).score).toBe(6);
        expect(computeAttackDifficulty('split_whale', 1).score).toBe(6);
        expect(computeAttackDifficulty('veteran_whale', 1).score).toBe(8);
        expect(computeAttackDifficulty('nation_state', 1).score).toBe(9);
        // Continuous sensitivity: smaller attack capture always produces strictly higher raw difficulty while staying <= 9.9 for maxShare > 0.
        expect(computeAttackDifficulty('veteran_whale', 0.05).rawScore).toBeGreaterThan(
            computeAttackDifficulty('veteran_whale', 0.3).rawScore,
        );
        expect(computeAttackDifficulty('nation_state', 0.01).score).toBeLessThanOrEqual(9.9);

        for (const id of ids) {
            expect(computeAttackDifficulty(id, 0).score).toBe(10);
            const at1 = computeAttackDifficulty(id, 1).score;
            const atHalf = computeAttackDifficulty(id, 0.5).score;
            const atSmall = computeAttackDifficulty(id, 0.1).score;
            const atZero = computeAttackDifficulty(id, 0).score;
            expect(at1).toBeGreaterThanOrEqual(0);
            expect(at1).toBeLessThanOrEqual(9.9);
            expect(atSmall).toBeLessThanOrEqual(9.9);
            expect(at1).toBeLessThanOrEqual(atHalf);
            expect(atHalf).toBeLessThanOrEqual(atSmall);
            expect(atSmall).toBeLessThan(atZero);
        }

        const newKeys = [
            'election_resistance_metric_share_label',
            'election_resistance_metric_difficulty_label',
            'election_resistance_metric_share_tip',
            'election_resistance_metric_difficulty_tip',
            'election_resistance_legend_share_title',
            'election_resistance_legend_share_desc',
            'election_resistance_legend_difficulty_title',
            'election_resistance_legend_difficulty_desc',
            'election_resistance_legend_global_title',
            'election_resistance_legend_global_desc',
            'election_resistance_global_score_title',
            'election_resistance_global_score_tip',
            'election_resistance_global_score_breakdown',
            'election_resistance_legend_decent_title',
            'election_resistance_legend_decent_desc',
            'election_resistance_legend_final_title',
            'election_resistance_legend_final_desc',
            'election_resistance_decent_score_title',
            'election_resistance_decent_score_tip',
            'election_resistance_decent_score_breakdown',
            'election_resistance_final_score_title',
            'election_resistance_final_score_tip',
            'election_resistance_final_score_breakdown',
            'election_resistance_ranking_title',
            'election_resistance_ranking_hint',
            'election_resistance_ranking_col_method',
            'election_resistance_ranking_col_resistance',
            'election_resistance_ranking_col_decent',
            'election_resistance_ranking_col_final',
            'election_resistance_ranking_sort_tip',
            'election_resistance_ranking_consensus_label',
            'election_resistance_ranking_col_family',
            'election_resistance_ranking_col_antisybil',
            'election_resistance_ranking_col_weakest',
            'election_resistance_ranking_col_nakamoto',
            'election_resistance_ranking_col_top1',
            'election_resistance_ranking_family_consensus',
            'election_resistance_ranking_open_tip',
            'election_resistance_ranking_jump_tip',
            'election_resistance_ranking_expand_tip',
            'election_consensus_picker_title',
            'election_consensus_picker_close',
            'election_consensus_picker_empty',
            'election_consensus_picker_consensus_sub',
            'election_consensus_picker_open_tip',
            'election_resistance_ranking_tip_rank',
            'election_resistance_ranking_tip_method',
            'election_resistance_ranking_tip_family',
            'election_resistance_ranking_tip_antisybil',
            'election_resistance_ranking_tip_weakest',
            'election_resistance_ranking_tip_nakamoto',
            'election_resistance_ranking_tip_top1',
            'election_resistance_ranking_tip_resistance',
            'election_resistance_ranking_tip_decent',
            'election_resistance_ranking_tip_final',
            'election_resistance_ranking_cell_rank_tip',
            'election_resistance_ranking_cell_family_tip',
            'election_resistance_ranking_cell_antisybil_tip',
            'election_resistance_ranking_cell_weakest_tip',
            'election_resistance_ranking_cell_nakamoto_tip',
            'election_resistance_ranking_cell_top1_tip',
            'election_resistance_ranking_cell_resistance_tip',
            'election_resistance_ranking_cell_decent_tip',
            'election_resistance_ranking_cell_na_tip',
            'election_resistance_ranking_expand_all',
            'election_resistance_ranking_collapse_all',
            'election_resistance_ranking_expand_all_tip',
            'election_resistance_ranking_collapse_all_tip',
            'election_card_tied_tip',
            'election_card_below_min_badge',
            'election_card_below_min_tip',
            'election_card_dropped_tip',
            'election_card_entered_tip',
            'election_current_conclusions_decisive_text',
            'election_resistance_nuance_impose_high',
        ];
        for (const k of newKeys) {
            expect(esCompare[k], `Missing ES key: ${k}`).toBeTruthy();
            expect(enCompare[k], `Missing EN key: ${k}`).toBeTruthy();
        }
        expect(esCompare.election_consensus_tab_resistance).toBe('Auditoría');
        expect(enCompare.election_consensus_tab_resistance).toBe('Audit');
    });

    it('matches computeConsensusResistance with weighted sum of per-method scenarios and audits capped_share / veterans_bonus / eligibleXrd', () => {
        const electionSpec = {
            roleId: null,
            seatCount: 1,
            minimumMedianGrade: 2,
            candidates: [
                { id: 1, displayName: 'Alice', reference: null, description: null, links: [], displayOrder: 0 },
                { id: 2, displayName: 'Bob', reference: null, description: null, links: [], displayOrder: 1 },
            ],
        };
        const item: GovernanceItem = {
            title: 'Council',
            shortDescription: null,
            description: null,
            options: [],
            links: [],
            quorum: 500,
            approvalThreshold: null,
            start: 1_750_000_000,
            deadline: null,
            author: null,
            voteCount: null,
            revoteCount: null,
            parameterLabel: null,
            elevatedProposalId: null,
            temperatureCheckId: null,
            maxSelections: 1,
            hidden: false,
            votersStore: null,
            election: electionSpec,
        };
        // Voters with empty `choices` but populated `grades` (real election shape).
        // Two voters hold 40% each (capped well above 1% under capped_share), plus smaller voters.
        const voters: MethodVoter[] = [
            { account: 'a1', choices: [], grades: { '1': 4, '2': 2 }, power: 400, ageDays: 900, stakedXrd: 400, twab90Xrd: 400, min90Xrd: 400 },
            { account: 'a2', choices: [], grades: { '1': 3, '2': 4 }, power: 400, ageDays: 900, stakedXrd: 400, twab90Xrd: 400, min90Xrd: 400 },
            { account: 'a3', choices: [], grades: { '1': 3, '2': 2 }, power: 100, ageDays: 900, stakedXrd: 100, twab90Xrd: 100, min90Xrd: 100 },
            { account: 'a4', choices: [], grades: { '1': 2, '2': 3 }, power: 100, ageDays: 900, stakedXrd: 100, twab90Xrd: 100, min90Xrd: 100 },
        ];
        const choices = itemChoices('election', item);
        const results = compareMethods(voters, choices, item, { gradeQuantile: '3/5' });

        // eligibleXrd must include election voters whose `choices` array is empty.
        const lin = results.find(r => r.key === 'linear')!;
        expect(lin.eligibleXrd).toBe(1000);

        // capped_share exact post-attack simulation accounts for scaling honest voters' caps
        // (1% of post-attack 2500 pool = 25 per voter across 4 honest voters + 1 whale = 5*25 = 125 => 25/125 = 20%,
        // strictly less than naive frozen-W formula 25 / (40 + 25) ≈ 38.5%).
        const cappedShareRes = results.find(r => r.key === 'capped_share')!;
        expect(cappedShareRes.capShareAudit?.singleWhaleShare).toBeCloseTo(0.2, 6);
        const cappedShareReport = computeMethodResistance('capped_share', {
            counted: cappedShareRes.counted,
            eligibleXrd: cappedShareRes.eligibleXrd,
            totalWeight: cappedShareRes.totalWeight,
            singleWhaleShareOverride: cappedShareRes.capShareAudit?.singleWhaleShare ?? null,
            isElection: true,
        });
        expect(cappedShareReport.scenarios.find(s => s.id === 'opportunistic_whale')?.maxShare).toBeCloseTo(0.2, 6);

        // veterans_bonus includes 2-year bonus multiplier (1.5 * whaleCapital / (W + 1.5 * whaleCapital)),
        // matching seniority_bonus rather than defaulting to 1.
        const vetBonus = results.find(r => r.key === 'veterans_bonus')!;
        const vetBonusReport = computeMethodResistance('veterans_bonus', {
            counted: vetBonus.counted,
            eligibleXrd: vetBonus.eligibleXrd,
            totalWeight: vetBonus.totalWeight,
            isElection: true,
        });
        // W = 1000 * (1 + 0.25 * 2) = 1500, whaleCapital*1.5 = 1500*1.5 = 2250 => 2250 / (1500 + 2250) = 0.6.
        expect(vetBonusReport.scenarios.find(s => s.id === 'veteran_whale')?.maxShare).toBeCloseTo(0.6, 6);

        // Consensus resistance equals exact weighted sum of per-method resistance across all evaluated scenarios.
        const evaluated = results.filter(r => r.electionSummary && r.counted > 0);
        const weights = Object.fromEntries(evaluated.map(r => [r.key, 1 / evaluated.length]));
        const consRes = computeConsensusResistance(results, weights);
        for (const sc of consRes) {
            expect(sc.totalMethods).toBe(evaluated.length);
            let expectedShare = 0;
            let expectedAffected = 0;
            for (const r of evaluated) {
                const rep = computeMethodResistance(r.key, {
                    counted: r.counted,
                    eligibleXrd: r.eligibleXrd,
                    totalWeight: r.totalWeight,
                    singleWhaleShareOverride: r.capShareAudit?.singleWhaleShare ?? null,
                    lastMinTwabSingleShareOverride: r.capShareAudit?.lastMinTwabSingleShare ?? null,
                    isElection: true,
                });
                const val = rep.scenarios.find(x => x.id === sc.id)?.maxShare ?? 0;
                if (val > 0) {
                    expectedShare += (weights[r.key] ?? 0) * val;
                    expectedAffected += 1;
                }
            }
            expect(sc.maxShare).toBeCloseTo(expectedShare, 6);
            expect(sc.affectedCount).toBe(expectedAffected);
        }
    });

    it('guarantees strict resistance tier ordering very_low < low < medium < high across all 50 methods', () => {
        expect(computeGlobalResistanceScore([]).score).toBe(0);

        const scenariosCheck = (key: MethodKey, metrics: MethodResistanceMetrics = baseMetrics) => {
            const report = computeMethodResistance(key, metrics, 'en');
            const g = computeGlobalResistanceScore(report.scenarios, report.resistance);
            const diffs = report.scenarios.map(s => computeAttackDifficulty(s.id, s.maxShare).rawScore);
            const expectedMin = Math.min(...diffs);
            const expectedMean = diffs.reduce((acc, v) => acc + v, 0) / diffs.length;
            const attackRaw = 0.7 * expectedMin + 0.3 * expectedMean;
            const expectedMinDisplay = expectedMin === 10 ? 10 : Math.min(9.9, Math.round(expectedMin * 10) / 10);
            expect(g.minDifficulty).toBe(expectedMinDisplay);
            expect(g.attackScore).toBe(Math.round(attackRaw * 10) / 10);
            return g.score;
        };

        const whaleHeavySnapshot: MethodResistanceMetrics = {
            counted: 45,
            eligibleXrd: 572_380_000,
            totalWeight: 94_860_000,
            isElection: true,
            quantile: 0.6,
        };
        // Continuous scoring preserves fine weight sensitivity between tight 1M cap vs partial marginal cap.
        const cappedVetReport = computeMethodResistance('capped_veterans', whaleHeavySnapshot, 'en');
        const marginalVetReport = computeMethodResistance('marginal_veterans', whaleHeavySnapshot, 'en');
        expect(computeGlobalResistanceScore(cappedVetReport.scenarios, 'high').avgDifficulty).toBeGreaterThan(
            computeGlobalResistanceScore(marginalVetReport.scenarios, 'high').avgDifficulty,
        );
        expect(computeGlobalResistanceScore([
            { id: 'cheap_sybil', maxShare: 0 },
            { id: 'funded_sybil', maxShare: 0 },
            { id: 'opportunistic_whale', maxShare: 0.05 },
            { id: 'split_whale', maxShare: 0.05 },
            { id: 'veteran_whale', maxShare: 0.05 },
            { id: 'veteran_sybil_farm', maxShare: 0 },
            { id: 'nation_state', maxShare: 1 },
        ], 'high').score).toBeGreaterThan(
            computeGlobalResistanceScore([
                { id: 'cheap_sybil', maxShare: 0 },
                { id: 'funded_sybil', maxShare: 0 },
                { id: 'opportunistic_whale', maxShare: 0.4 },
                { id: 'split_whale', maxShare: 0.4 },
                { id: 'veteran_whale', maxShare: 0.4 },
                { id: 'veteran_sybil_farm', maxShare: 0 },
                { id: 'nation_state', maxShare: 1 },
            ], 'high').score,
        );
        expect(scenariosCheck('capped_veterans', whaleHeavySnapshot)).toBeGreaterThan(
            scenariosCheck('veterans', whaleHeavySnapshot),
        );

        const snapshots = [
            baseMetrics,
            whaleHeavySnapshot,
            { counted: 12, eligibleXrd: 400_000, totalWeight: 400_000, isElection: true, quantile: 0.6 },
        ];

        for (const snap of snapshots) {
            const byTier: Record<'very_low' | 'low' | 'medium' | 'high', number[]> = {
                very_low: [],
                low: [],
                medium: [],
                high: [],
            };
            for (const spec of METHODS) {
                byTier[spec.resistance].push(scenariosCheck(spec.key, snap));
            }
            expect(Math.max(...byTier.very_low)).toBeLessThan(Math.min(...byTier.low));
            expect(Math.max(...byTier.low)).toBeLessThan(Math.min(...byTier.medium));
            expect(Math.max(...byTier.medium)).toBeLessThan(Math.min(...byTier.high));
        }
    });

    it('computes decentralisationScore from spread and finalScore as geometric mean √(resistance × decentralisation)', () => {
        const scenarios = [
            { id: 'cheap_sybil' as const, maxShare: 0 },
            { id: 'funded_sybil' as const, maxShare: 0 },
            { id: 'opportunistic_whale' as const, maxShare: 0.1 },
            { id: 'split_whale' as const, maxShare: 0.1 },
            { id: 'veteran_whale' as const, maxShare: 0.2 },
            { id: 'veteran_sybil_farm' as const, maxShare: 0 },
            { id: 'nation_state' as const, maxShare: 1 },
        ];

        // When spread is omitted or null, decentralisationScore and finalScore remain null.
        const withoutSpread = computeGlobalResistanceScore(scenarios, 'high');
        expect(withoutSpread.decentralisationScore).toBeNull();
        expect(withoutSpread.finalScore).toBeNull();
        const nullSpread = computeGlobalResistanceScore(scenarios, 'high', null);
        expect(nullSpread.decentralisationScore).toBeNull();
        expect(nullSpread.finalScore).toBeNull();

        // Out-of-range spread clamps into [0, 1] -> [0, 10] decentralisation score.
        expect(computeGlobalResistanceScore(scenarios, 'high', -0.25).decentralisationScore).toBe(0);
        expect(computeGlobalResistanceScore(scenarios, 'high', -0.25).finalScore).toBe(0);
        expect(computeGlobalResistanceScore(scenarios, 'high', 1.4).decentralisationScore).toBe(10);

        // Verify exact geometric mean formula directly.
        const manual = computeGlobalResistanceScore(scenarios, 'high', 0.64);
        expect(manual.decentralisationScore).toBe(6.4);
        const expectedManualFinal = Math.round(
            Math.sqrt((0.5 * 10 + 0.5 * manual.attackScore) * 6.4) * 10,
        ) / 10;
        expect(manual.finalScore).toBeCloseTo(expectedManualFinal, 0);

        // Verify real concentration spread across representative methods on a whale-heavy ballot distribution.
        const whaleBallots: MethodVoter[] = [
            {
                account: 'addr_whale',
                choices: ['for'],
                power: 10_000_000,
                ageDays: 800,
                stakedXrd: 10_000_000,
                twab90Xrd: 10_000_000,
                min90Xrd: 10_000_000,
            },
            ...Array.from({ length: 25 }, (_, idx) => ({
                account: `addr_${idx}`,
                choices: ['against'],
                power: 200_000,
                ageDays: 800,
                stakedXrd: 200_000,
                twab90Xrd: 200_000,
                min90Xrd: 200_000,
            })),
        ];
        const evaluated = compareMethods(
            whaleBallots,
            [
                { key: 'for', label: 'For', tone: 'positive', selected: false },
                { key: 'against', label: 'Against', tone: 'negative', selected: false },
            ],
            null,
        );
        const byKey = new Map(evaluated.map(m => [m.key, m]));
        const scoreFor = (key: MethodKey) => {
            const method = byKey.get(key)!;
            const report = computeMethodResistance(key, {
                counted: method.counted,
                eligibleXrd: method.eligibleXrd,
                totalWeight: method.totalWeight,
                isElection: false,
            }, 'en');
            return computeGlobalResistanceScore(report.scenarios, method.resistance, method.concentration.spread);
        };

        const oneAddress = scoreFor('one_address');
        const linear = scoreFor('linear');
        const cappedVeterans = scoreFor('capped_veterans');

        expect(oneAddress.decentralisationScore).toBe(10);
        expect(oneAddress.score).toBeLessThan(3);
        expect(oneAddress.finalScore!).toBeLessThan(5.5);

        expect(linear.decentralisationScore!).toBeLessThan(4);
        expect(linear.finalScore!).toBeLessThan(linear.score);

        expect(cappedVeterans.decentralisationScore!).toBeGreaterThan(linear.decentralisationScore!);
        expect(cappedVeterans.finalScore!).toBeGreaterThan(oneAddress.finalScore!);
        expect(cappedVeterans.finalScore!).toBeGreaterThan(linear.finalScore!);
    });

    it('builds method & historical score rows cleanly and sorts with null values sinking last', () => {
        const voters: MethodVoter[] = [
            {
                account: 'addr_whale',
                choices: ['for'],
                power: 5_000_000,
                ageDays: 800,
                stakedXrd: 5_000_000,
                twab90Xrd: 5_000_000,
                min90Xrd: 5_000_000,
            },
            ...Array.from({ length: 12 }, (_, idx) => ({
                account: `addr_${idx}`,
                choices: ['against'],
                power: 100_000,
                ageDays: 800,
                stakedXrd: 100_000,
                twab90Xrd: 100_000,
                min90Xrd: 100_000,
            })),
        ];
        const evaluated = compareMethods(
            voters,
            [
                { key: 'for', label: 'For', tone: 'positive', selected: false },
                { key: 'against', label: 'Against', tone: 'negative', selected: false },
            ],
            null,
        );
        const linearResult = evaluated.find(m => m.key === 'linear')!;
        expect(methodResistanceMetricsFromResult(linearResult, 0.6)).toEqual({
            counted: linearResult.counted,
            eligibleXrd: linearResult.eligibleXrd,
            totalWeight: linearResult.totalWeight,
            decisiveQuantileCount: null,
            decisiveCount: linearResult.decisive?.count ?? null,
            decisiveOf: linearResult.decisive?.of ?? null,
            isElection: false,
            isHistorical: false,
            quantile: 0.6,
            singleWhaleShareOverride: null,
            lastMinTwabSingleShareOverride: null,
        });

        const scoreRows = computeMethodScoreRows(evaluated, {
            quantile: 0.6,
            consensus: {
                methodWeights: { linear: 0.5, one_address: 0.5 },
                concentration: { spread: 0.62, nakamoto: 6, top1: 0.18, effective: 10 },
            },
        });
        expect(scoreRows).toHaveLength(METHODS.length + 1);
        const consensusRow = scoreRows.find(r => r.key === 'consensus');
        expect(consensusRow?.isConsensus).toBe(true);
        expect(consensusRow?.family).toBe('consensus');
        expect(consensusRow?.decentralisationScore).toBe(6.2);
        expect(consensusRow?.nakamoto).toBe(6);
        expect(consensusRow?.top1).toBe(0.18);

        const linearScoreRow = scoreRows.find(r => r.key === 'linear')!;
        expect(linearScoreRow.family).toBe('wealth');
        expect(linearScoreRow.current).toBe(true);
        expect(linearScoreRow.minDifficulty).toBeGreaterThanOrEqual(6);
        expect(linearScoreRow.nakamoto).toBe(linearResult.concentration.nakamoto);
        expect(linearScoreRow.top1).toBe(linearResult.concentration.top1);

        const syntheticHist = [
            {
                key: 'linear' as const,
                family: 'wealth' as const,
                current: true,
                resistance: 'high' as const,
                votesEvaluated: 4,
                totalBallotsCounted: 80,
                totalEligibleXrd: 4_000_000,
                avgTotalWeight: 1_000_000,
                validVotesCount: 3,
                avgNakamoto: 2,
                avgSpread: 0.25,
                avgTop1: 0.55,
                avgEffective: 2.8,
            },
            {
                key: 'one_address' as const,
                family: 'address' as const,
                current: false,
                resistance: 'very_low' as const,
                votesEvaluated: 4,
                totalBallotsCounted: 80,
                totalEligibleXrd: 4_000_000,
                avgTotalWeight: 20,
                validVotesCount: 4,
                avgNakamoto: 11,
                avgSpread: null,
                avgTop1: 0.05,
                avgEffective: 20,
            },
        ];
        expect(methodResistanceMetricsFromHistorical(syntheticHist[0], 5)).toEqual({
            counted: 20,
            eligibleXrd: 1_000_000,
            totalWeight: 1_000_000,
            validVotesCount: 3,
            totalVotes: 5,
            avgNakamoto: 2,
            isElection: false,
            isHistorical: true,
        });

        const histRows = computeHistoricalMethodScoreRows(
            syntheticHist as unknown as Parameters<typeof computeHistoricalMethodScoreRows>[0],
            5,
        );
        expect(histRows).toHaveLength(2);
        expect(histRows[0].decentralisationScore).toBe(2.5);
        expect(histRows[0].top1).toBe(0.55);
        expect(histRows[1].decentralisationScore).toBeNull();
        expect(histRows[1].finalScore).toBeNull();

        const sortable = [
            { key: 'a', label: 'Alpha', resistance: 'high' as const, resistanceScore: 9.0, minDifficulty: 6.0, decentralisationScore: 2.0, finalScore: 4.2, nakamoto: 2, top1: 0.6 },
            { key: 'b', label: 'Beta', resistance: 'low' as const, resistanceScore: 4.0, minDifficulty: 3.1, decentralisationScore: 9.5, finalScore: 6.2, nakamoto: 12, top1: 0.08 },
            { key: 'c', label: 'Gamma', resistance: 'medium' as const, resistanceScore: 7.5, minDifficulty: 7.4, decentralisationScore: 8.0, finalScore: 7.7, nakamoto: 8, top1: 0.15 },
            { key: 'd', label: 'Delta', resistance: 'very_low' as const, resistanceScore: 5.0, minDifficulty: 1.0, decentralisationScore: null, finalScore: null, nakamoto: null, top1: null },
        ];

        expect(sortMethodScoreRows(sortable, 'final', 'desc').map(r => r.key)).toEqual(['c', 'b', 'a', 'd']);
        expect(sortMethodScoreRows(sortable, 'final', 'asc').map(r => r.key)).toEqual(['a', 'b', 'c', 'd']);
        expect(sortMethodScoreRows(sortable, 'resistance', 'desc').map(r => r.key)).toEqual(['a', 'c', 'd', 'b']);
        expect(sortMethodScoreRows(sortable, 'decentralisation', 'desc').map(r => r.key)).toEqual(['b', 'c', 'a', 'd']);
        expect(sortMethodScoreRows(sortable, 'decentralisation', 'asc').map(r => r.key)).toEqual(['a', 'c', 'b', 'd']);
        expect(sortMethodScoreRows(sortable, 'minDifficulty', 'desc').map(r => r.key)).toEqual(['c', 'a', 'b', 'd']);
        expect(sortMethodScoreRows(sortable, 'antiSybil', 'desc').map(r => r.key)).toEqual(['a', 'c', 'b', 'd']);
        expect(sortMethodScoreRows(sortable, 'nakamoto', 'desc').map(r => r.key)).toEqual(['b', 'c', 'a', 'd']);
        expect(sortMethodScoreRows(sortable, 'top1', 'desc').map(r => r.key)).toEqual(['a', 'c', 'b', 'd']);

        // 3-click column sort cycle: desc -> asc -> null, switching column resets to desc.
        const s1 = nextMethodScoreSort(null, 'resistance');
        expect(s1).toEqual({ key: 'resistance', dir: 'desc' });
        const s2 = nextMethodScoreSort(s1, 'resistance');
        expect(s2).toEqual({ key: 'resistance', dir: 'asc' });
        const s3 = nextMethodScoreSort(s2, 'resistance');
        expect(s3).toBeNull();
        expect(nextMethodScoreSort(s1, 'final')).toEqual({ key: 'final', dir: 'desc' });
    });
});
