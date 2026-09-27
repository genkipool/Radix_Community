import { describe, it, expect } from 'vitest';
import { compareMethods, concentration, concentrationLevel, type MethodVoter } from '@/features/governance/lib/votingMethods';
import { itemChoices, type GovernanceItem } from '@/features/governance/lib/governanceVotes';

const item: GovernanceItem = {
    title: 'Test', shortDescription: null, description: null, options: [], links: [], voteCount: null, revoteCount: null,
    start: null, deadline: null, quorum: 1_000, approvalThreshold: 0.5, author: null, parameterLabel: null,
    elevatedProposalId: null, temperatureCheckId: null, maxSelections: 1, hidden: false, votersStore: null,
};
const choices = itemChoices('temperature_check', item);
const voter = (account: string, stance: 'For' | 'Against', power: number, ageDays: number | null = 1_000): MethodVoter =>
    ({ account, choices: [stance], power, ageDays });

// One whale in favour against many small, old holders.
const voters: MethodVoter[] = [
    voter('whale', 'For', 10_000, 30),
    ...Array.from({ length: 5 }, (_, i) => voter(`small${i}`, 'Against', 500)),
];
const byKey = (key: string) => compareMethods(voters, choices, item).find(r => r.key === key)!;

describe('compareMethods', () => {
    it('the current rule weighs 1 XRD = 1 vote and a whale decides alone', () => {
        const r = byKey('linear');
        expect(r.current).toBe(true);
        expect(r.outcome).toBe('approved');
        expect(r.approvalShare).toBeCloseTo(0.8);
        expect(r.concentration.nakamoto).toBe(1);
        expect(r.decisive).toMatchObject({ side: 'for', count: 1, of: 1, xrd: 10_000 });
    });

    it('one address one vote flips the result', () => {
        const r = byKey('one_address');
        expect(r.outcome).toBe('rejected');
        expect(r.sameAsCurrent).toBe(false);
        expect(r.concentration.nakamoto).toBe(4);
        // Four of the six addresses: with three against, the other three in favour tie at 50 % and pass.
        expect(r.decisive).toMatchObject({ side: 'against', count: 4, of: 5 });
    });

    it('checks the quorum with the XRD of the voters that count', () => {
        const r = byKey('one_address_min');
        // Only the whale holds 10 000 XRD or more.
        expect(r.counted).toBe(1);
        expect(r.eligibleXrd).toBe(10_000);
        expect(r.outcome).toBe('approved');

        const veterans = byKey('veterans');
        expect(veterans.excluded).toBe(1);
        expect(veterans.eligibleXrd).toBe(2_500);
        expect(veterans.outcome).toBe('rejected');
    });

    it('leaves out accounts of unknown age from age rules', () => {
        const r = compareMethods([voter('a', 'For', 100, null), voter('b', 'Against', 2_000)], choices, item).find(x => x.key === 'seniority_bonus')!;
        expect(r.counted).toBe(1);
        expect(r.rows.find(x => x.key === 'Against')!.power).toBe(2_000 * 1.5);
    });

    it('reports no result when nobody meets the rule', () => {
        const r = compareMethods([voter('a', 'For', 100, 10)], choices, item).find(x => x.key === 'veterans')!;
        expect(r.counted).toBe(0);
        expect(r.outcome).toBeNull();
        expect(r.sameAsCurrent).toBeNull();
    });
});

describe('new methods', () => {
    it('double majority needs both the XRD and the addresses', () => {
        // The whale wins by XRD but five addresses are against: rejected.
        const r = byKey('double_majority');
        expect(r.approvalShare).toBeCloseTo(0.8);
        expect(r.headcountShare).toBeCloseTo(1 / 6);
        expect(r.outcome).toBe('rejected');
        expect(r.sameAsCurrent).toBe(false);
    });

    it('tiers give one more vote per bracket', () => {
        const r = byKey('tiered');
        // 10 000 XRD sits in the third bracket (3 votes); 500 XRD in the first (1 vote).
        expect(r.rows.find(x => x.key === 'For')!.power).toBe(3);
        expect(r.rows.find(x => x.key === 'Against')!.power).toBe(5);
    });

    it('leaves out the largest address, or everyone but the large wallets', () => {
        expect(byKey('no_top1').counted).toBe(5);
        expect(byKey('whales_only').counted).toBe(0);
    });

    it('caps each address at a share of the total', () => {
        const r = byKey('capped_share');
        // 1 % of 12 500 XRD.
        expect(r.rows.find(x => x.key === 'For')!.power).toBeCloseTo(125);
    });

    it('adds a vote per year of age to each address', () => {
        // The whale is 30 days old (1 vote); each small holder is 2 years old (3 votes).
        const r = byKey('address_age');
        expect(r.rows.find(x => x.key === 'For')!.power).toBe(1);
        expect(r.rows.find(x => x.key === 'Against')!.power).toBe(15);
    });
});

describe('concentration', () => {
    it('counts the fewest voters above half and the effective voters', () => {
        const c = concentration([1, 1, 1, 1]);
        expect(c.nakamoto).toBe(3);
        expect(c.effective).toBeCloseTo(4);
        expect(c.top1).toBeCloseTo(0.25);
        expect(concentrationLevel(c.nakamoto)).toBe('high');
        expect(concentrationLevel(50)).toBe('low');
    });
});
