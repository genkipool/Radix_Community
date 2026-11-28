import { describe, it, expect } from 'vitest';
import { aggregateHistoricalMethods, type HistoricalVoteInput } from '@/features/governance/lib/historicalMethods';
import { itemChoices, type GovernanceItem } from '@/features/governance/lib/governanceVotes';
import {
    compareMethods, computeHistoricalMethodScoreRows, computeMethodScoreRows, fairScoreExtremes, spreadExtremes,
    type MethodVoter,
} from '@/features/governance/lib/votingMethods';
import { parseQuantile } from '@/features/governance/lib/majorityJudgment';
import type { GovernanceEntry } from '@/features/governance/types';

const makeItem = (title: string): GovernanceItem => ({
    title,
    shortDescription: null,
    description: null,
    options: [],
    links: [],
    voteCount: null,
    revoteCount: null,
    start: 1_700_000_000,
    deadline: 1_700_500_000,
    quorum: 1_000,
    approvalThreshold: 0.5,
    author: null,
    parameterLabel: null,
    elevatedProposalId: null,
    temperatureCheckId: null,
    maxSelections: 1,
    hidden: false,
    votersStore: null,
});

const makeEntry = (id: string, title: string): GovernanceEntry => ({
    systemKey: 'radix-dao',
    systemName: 'Radix DAO',
    kind: 'temperature_check',
    id,
    item: makeItem(title),
});

describe('aggregateHistoricalMethods', () => {
    it('sums ballots, unique voters, cumulative XRD and tracks outcome flips across proposals', () => {
        const inputs: HistoricalVoteInput[] = [
            {
                entry: makeEntry('1', 'Proposal 1'),
                voters: [
                    { account: 'whale', choices: ['For'], power: 10_000_000, ageDays: 30, stakedXrd: 0, twab90Xrd: 0, min90Xrd: 0 },
                    { account: 'vet1', choices: ['Against'], power: 500_000, ageDays: 900, stakedXrd: 500_000, twab90Xrd: 500_000, min90Xrd: 500_000 },
                    { account: 'vet2', choices: ['Against'], power: 500_000, ageDays: 900, stakedXrd: 500_000, twab90Xrd: 500_000, min90Xrd: 500_000 },
                ],
            },
            {
                entry: makeEntry('2', 'Proposal 2'),
                voters: [
                    { account: 'whale', choices: ['For'], power: 8_000_000, ageDays: 30, stakedXrd: 8_000_000, twab90Xrd: 8_000_000, min90Xrd: 8_000_000 },
                    { account: 'vet1', choices: ['For'], power: 1_000_000, ageDays: 900, stakedXrd: 1_000_000, twab90Xrd: 1_000_000, min90Xrd: 1_000_000 },
                    { account: 'vet3', choices: ['Against'], power: 500_000, ageDays: 900, stakedXrd: 500_000, twab90Xrd: 500_000, min90Xrd: 500_000 },
                ],
            },
        ];

        const summary = aggregateHistoricalMethods(inputs, true);

        expect(summary.votesAnalyzed).toBe(2);
        expect(summary.totalBallots).toBe(6);
        expect(summary.uniqueVoters).toBe(4); // whale, vet1, vet2, vet3
        expect(summary.totalXrd).toBe(20_500_000);
        expect(summary.avgXrdPerVote).toBe(10_250_000);

        const linear = summary.methods.find(m => m.key === 'linear')!;
        expect(linear.totalBallotsCounted).toBe(6);
        expect(linear.totalEligibleXrd).toBe(20_500_000);
        expect(linear.changedCount).toBe(0);
        expect(linear.avgDecisiveCount).toBe(1);
        expect(linear.totalDecisiveXrd).toBe(18_000_000);

        // Staked-only flips Proposal 1 (whale had 0 staked) but agrees on Proposal 2
        const stakedOnly = summary.methods.find(m => m.key === 'staked_only')!;
        expect(stakedOnly.votesEvaluated).toBe(2);
        expect(stakedOnly.changedCount).toBe(1);
        expect(stakedOnly.sameCount).toBe(1);
        expect(stakedOnly.changedEntries[0].entry.id).toBe('1');
        expect(stakedOnly.totalEligibleXrd).toBe(10_500_000);

        // Every non-current method evaluates the exact same denominator (2/2 votes),
        // even when nobody met its rules on one of the votes.
        for (const m of summary.methods.filter(x => !x.current)) {
            expect(m.changedCount + m.sameCount, m.key).toBe(2);
        }

        expect(summary.mostBalanced).toBeDefined();
        expect(summary.mostDecentralised).toBeDefined();
    });

    it('matches single-vote MethodsComparison KPIs 1:1 on a single unmet-quorum Majority Judgment election', () => {
        const electionItem: GovernanceItem = {
            ...makeItem('Council Election #1'),
            quorum: 500_000_000, // unmet quorum -> forces effectiveExtremes tie-break by quorumProgress
            approvalThreshold: null,
            options: [
                { id: 0, label: 'Alice' },
                { id: 1, label: 'Bob' },
                { id: 2, label: 'Carol' },
            ],
            election: {
                roleId: 'council',
                seatCount: 2,
                minimumMedianGrade: 2,
                candidates: [
                    { id: 0, displayName: 'Alice', reference: 'alice', description: null, links: [], displayOrder: 0 },
                    { id: 1, displayName: 'Bob', reference: 'bob', description: null, links: [], displayOrder: 1 },
                    { id: 2, displayName: 'Carol', reference: 'carol', description: null, links: [], displayOrder: 2 },
                ],
            },
        };
        const entry: GovernanceEntry = {
            systemKey: 'radix-dao',
            systemName: 'Radix DAO',
            kind: 'election',
            id: '1',
            item: electionItem,
        };
        const voters: MethodVoter[] = [
            { account: 'w1', choices: ['0', '1', '2'], grades: { '0': 4, '1': 4, '2': 0 }, power: 100_000_000, ageDays: 900, stakedXrd: 100_000_000, twab90Xrd: 100_000_000, min90Xrd: 100_000_000 },
            { account: 'w2', choices: ['0', '1', '2'], grades: { '0': 4, '1': 4, '2': 0 }, power: 50_000_000, ageDays: 900, stakedXrd: 50_000_000, twab90Xrd: 50_000_000, min90Xrd: 50_000_000 },
            ...Array.from({ length: 12 }, (_, i) => ({
                account: `s${i}`,
                choices: ['0', '1', '2'],
                grades: { '0': 4, '1': 0, '2': 4 },
                power: 50_000,
                ageDays: 900,
                stakedXrd: 50_000,
                twab90Xrd: 50_000,
                min90Xrd: 50_000,
            })),
        ];

        const singleResults = compareMethods(voters, itemChoices('election', electionItem), electionItem, { gradeQuantile: '3/5' })
            .filter(r => r.counted > 0);
        const singleSpread = spreadExtremes(singleResults, r => r.concentration.spread);
        const { balance: singleBalance, effective: singleEffective } = fairScoreExtremes(singleResults, parseQuantile('3/5'));

        const hist = aggregateHistoricalMethods([{ entry, voters, gradeQuantile: '3/5' }], true);

        expect(hist.mostDecentralised?.key).toBe(singleSpread.most?.key);
        expect(hist.mostCentralised?.key).toBe(singleSpread.least?.key);
        expect(hist.mostBalanced?.key).toBe(singleBalance.most?.key);
        expect(hist.leastBalanced?.key).toBe(singleBalance.least?.key);
        expect(hist.mostEffective?.key).toBe(singleEffective.most?.key);
        expect(hist.leastEffective?.key).toBe(singleEffective.least?.key);
    });

    describe('historical scores are the vote-by-vote average of the single-vote scores', () => {
        const mixedVoters: MethodVoter[] = [
            { account: 'whale', choices: ['For'], power: 12_000_000, ageDays: 1_200, stakedXrd: 9_000_000, twab90Xrd: 11_000_000, min90Xrd: 10_000_000 },
            { account: 'mid', choices: ['Against'], power: 2_500_000, ageDays: 800, stakedXrd: 2_000_000, twab90Xrd: 2_400_000, min90Xrd: 2_300_000 },
            { account: 'small1', choices: ['Against'], power: 40_000, ageDays: 400, stakedXrd: 0, twab90Xrd: 30_000, min90Xrd: 20_000 },
            { account: 'small2', choices: ['For'], power: 15_000, ageDays: 30, stakedXrd: 15_000, twab90Xrd: 5_000, min90Xrd: 0 },
            { account: 'dust', choices: ['Against'], power: 50, ageDays: 2, stakedXrd: 0, twab90Xrd: 10, min90Xrd: 0 },
        ];

        it('equals the single-vote score table 1:1 when only one vote is analysed (incl. share caps)', () => {
            const entry = makeEntry('9', 'Single');
            const results = compareMethods(mixedVoters, itemChoices(entry.kind, entry.item), entry.item);
            const ready = results.filter(r => r.counted > 0);
            const single = computeMethodScoreRows(ready, { quantile: parseQuantile(undefined) });
            const summary = aggregateHistoricalMethods([{ entry, voters: mixedVoters }], true);
            const hist = computeHistoricalMethodScoreRows(summary.methods.filter(m => m.votesEvaluated > 0), summary.votesAnalyzed);
            expect(hist).toHaveLength(single.length);
            const histByKey = new Map(hist.map(r => [r.key, r]));
            for (const row of single) {
                const h = histByKey.get(row.key)!;
                expect(h, row.key).toBeDefined();
                expect(h.resistanceScore, row.key).toBe(row.resistanceScore);
                expect(h.decentralisationScore, row.key).toBe(row.decentralisationScore);
                expect(h.finalScore, row.key).toBe(row.finalScore);
                expect(h.minDifficulty, row.key).toBe(row.minDifficulty);
                expect(h.avgMaxShare, row.key).toBeCloseTo(row.avgMaxShare, 12);
            }
        });

        it('scores 0 on votes where a rule counts nobody, instead of averaging only the votes it survives', () => {
            const withWhale = makeEntry('10', 'With whale');
            const noWhale = makeEntry('11', 'Without whale');
            const smallVoters = mixedVoters.filter(v => v.power < 1_000_000);
            const summary = aggregateHistoricalMethods([
                { entry: withWhale, voters: mixedVoters },
                { entry: noWhale, voters: smallVoters },
            ], true);
            const whalesOnly = summary.methods.find(m => m.key === 'whales_only')!;
            expect(whalesOnly.votesEvaluated).toBe(1);

            const one = compareMethods(mixedVoters, itemChoices(withWhale.kind, withWhale.item), withWhale.item)
                .filter(r => r.key === 'whales_only');
            const [singleRow] = computeMethodScoreRows(one, { quantile: parseQuantile(undefined) });
            expect(whalesOnly.avgFinalScore).toBe(Math.round((singleRow.finalScore! / 2) * 10) / 10);
            expect(whalesOnly.avgDecentralisationScore).toBe(Math.round((singleRow.decentralisationScore! / 2) * 10) / 10);
            // Resistance describes the rule where it applies, so it is averaged over evaluated votes only.
            expect(whalesOnly.avgResistanceScore).toBe(singleRow.resistanceScore);
            expect(whalesOnly.avgSpread).toBeCloseTo(one[0].concentration.spread! / 2, 12);
        });
    });

    describe('quorum', () => {
        const item = { ...makeItem('Quorum'), quorum: 13_000_000 };
        const entry = { ...makeEntry('12', 'Quorum'), item };
        const voters: MethodVoter[] = [
            { account: 'whale', choices: ['For'], power: 12_000_000, ageDays: 30, stakedXrd: 0, twab90Xrd: 0, min90Xrd: 0 },
            { account: 'vet', choices: ['Against'], power: 2_000_000, ageDays: 900, stakedXrd: 2_000_000, twab90Xrd: 2_000_000, min90Xrd: 2_000_000 },
        ];
        const results = compareMethods(voters, itemChoices(entry.kind, item), item);
        const byKey = new Map(results.map(r => [r.key, r]));

        it('weight caps keep the full XRD of every counted voter in the quorum', () => {
            const capped = byKey.get('capped')!;
            expect(capped.totalWeight).toBe(2_000_000);
            expect(capped.quorumXrd).toBe(14_000_000);
            expect(capped.quorumMet).toBe(true);
        });

        it('voters dropped for their size still count toward the quorum, but not toward the vote', () => {
            const noTop1 = byKey.get('no_top1')!;
            expect(noTop1.counted).toBe(1);
            expect(noTop1.eligibleXrd).toBe(2_000_000);
            expect(noTop1.quorumXrd).toBe(14_000_000);
            expect(noTop1.quorumMet).toBe(true);
            expect(noTop1.outcome).toBe('rejected');
        });

        it('voters dropped for failing a requirement do not count toward the quorum', () => {
            const veterans = byKey.get('veterans')!;
            expect(veterans.counted).toBe(1);
            expect(veterans.quorumXrd).toBe(2_000_000);
            expect(veterans.quorumMet).toBe(false);
            expect(veterans.outcome).toBe('no_quorum');
        });
    });
});
