import { describe, it, expect } from 'vitest';
import { aggregateHistoricalMethods, type HistoricalVoteInput } from '@/features/governance/lib/historicalMethods';
import type { GovernanceItem } from '@/features/governance/lib/governanceVotes';
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
});
