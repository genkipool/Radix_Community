import { describe, it, expect } from 'vitest';
import { balanceExtremes, balanceScore, compareMethods, concentration, concentrationLevel, type MethodVoter } from '@/features/governance/lib/votingMethods';
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

describe('resistance to manipulation', () => {
    it('prices a flip under 1 XRD = 1 vote in XRD: splitting gains nothing', () => {
        // 10 000 in favour against 2 500: another 7 500 against brings it to 50 %.
        expect(byKey('linear').resistance).toBe('high');
        expect(byKey('linear').attack).toEqual({ xrd: 7_500, addresses: 1, years: 0 });
    });

    it('prices a flip under 1 address = 1 vote in new addresses', () => {
        // 1 in favour, 5 against: 4 empty addresses in favour tie it at 50 % and it passes.
        const r = byKey('one_address');
        expect(r.resistance).toBe('very_low');
        expect(r.attack).toEqual({ xrd: 4, addresses: 4, years: 0 });
    });

    it('asks for old accounts when the rule leaves new ones out', () => {
        // Only the five old accounts count (2 500 against): 2 500 XRD in favour, in a 2-year-old account.
        expect(byKey('veterans').attack).toEqual({ xrd: 2_500, addresses: 1, years: 2 });
    });

    it('tips a double majority with the headcount', () => {
        // Rejected by addresses: 4 empty addresses in favour make 5 against 5.
        expect(byKey('double_majority').attack).toMatchObject({ addresses: 4, years: 0 });
    });

    it('has nothing to flip without a clear result', () => {
        const r = compareMethods([voter('a', 'For', 100, 10)], choices, item).find(x => x.key === 'veterans')!;
        expect(r.attack).toBeNull();
    });
});

describe('balance', () => {
    const at = (resistance: 'very_low' | 'low' | 'medium' | 'high', spread: number) =>
        ({ resistance, concentration: { nakamoto: 1, spread, effective: 1, top1: 0, top10: 0 } });

    it('needs both resistance and decentralisation', () => {
        expect(balanceScore(at('high', 1))).toBe(1);
        // Fully decentralised but free to game: not balanced at all.
        expect(balanceScore(at('very_low', 1))).toBe(0);
        expect(balanceScore(at('high', 0.25))).toBeCloseTo(0.5);
    });

    it('picks the extremes, the least balanced being the most lopsided on a tie', () => {
        const capped = at('high', 0.56);
        const linear = at('high', 0.1);
        const quadratic = at('very_low', 0.26);
        const oneAddress = at('very_low', 1);
        const { most, least } = balanceExtremes([linear, capped, quadratic, oneAddress]);
        expect(most).toBe(capped);
        expect(least).toBe(oneAddress);
    });
});

describe('concentration', () => {
    it('counts the fewest voters above half and the effective voters', () => {
        const c = concentration([1, 1, 1, 1]);
        expect(c.nakamoto).toBe(3);
        expect(c.effective).toBeCloseTo(4);
        expect(c.top1).toBeCloseTo(0.25);
        // Four equal voters: 3 is the most possible, so it is as spread out as it gets.
        expect(c.spread).toBe(1);
        expect(concentrationLevel(c)).toBe('minimal');
    });

    it('rates the level against the most possible, not a fixed count', () => {
        // One address above half is always extreme.
        expect(concentrationLevel({ nakamoto: 1, spread: 1 })).toBe('extreme');
        // 7 of 143 voters: the most possible would be 72.
        expect(concentrationLevel({ nakamoto: 7, spread: 7 / 72 })).toBe('high');
        expect(concentrationLevel({ nakamoto: 19, spread: 19 / 72 })).toBe('moderate');
        expect(concentrationLevel({ nakamoto: 40, spread: 40 / 72 })).toBe('low');
        expect(concentrationLevel({ nakamoto: 3, spread: 3 / 4 })).toBe('minimal');
    });
});
