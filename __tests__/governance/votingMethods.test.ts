import { describe, it, expect } from 'vitest';
import { balanceExtremes, balanceScore, compareMethods, computeElectionConclusions, computeElectionConsensus, concentration, concentrationLevel, type MethodVoter } from '@/features/governance/lib/votingMethods';
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

    it('high-security decentralised veteran methods cap whales while blocking new-account splitting', () => {
        const bigVoters: MethodVoter[] = [
            voter('vet_whale', 'For', 5_000_000, 900),
            voter('fresh_whale', 'For', 5_000_000, 30),
            voter('vet_mid_1', 'Against', 500_000, 900),
            voter('vet_mid_2', 'Against', 500_000, 900),
            voter('vet_mid_3', 'Against', 500_000, 900),
        ];
        const results = compareMethods(bigVoters, choices, item);
        const get = (k: string) => results.find(r => r.key === k)!;

        // capped_veterans: fresh_whale excluded; vet_whale capped at 1M vs 1.5M against -> rejected, high resistance.
        const cappedVet = get('capped_veterans');
        expect(cappedVet.resistance).toBe('high');
        expect(cappedVet.counted).toBe(4);
        expect(cappedVet.rows.find(x => x.key === 'For')!.power).toBe(1_000_000);
        expect(cappedVet.outcome).toBe('rejected');

        // capped_veterans_5m / 10m: vet_whale (5M) weighs 5M, fresh_whale excluded; capped_5m caps both at 5M.
        const cappedVet5m = get('capped_veterans_5m');
        expect(cappedVet5m.resistance).toBe('high');
        expect(cappedVet5m.rows.find(x => x.key === 'For')!.power).toBe(5_000_000);
        const cappedVet10m = get('capped_veterans_10m');
        expect(cappedVet10m.resistance).toBe('high');
        expect(cappedVet10m.rows.find(x => x.key === 'For')!.power).toBe(5_000_000);
        expect(get('capped_5m').rows.find(x => x.key === 'For')!.power).toBe(10_000_000);

        // capped_share_veterans: 5% of 6.5M veteran XRD = 325k cap -> vet_whale and all 3 mids capped at 325k each.
        const cappedShareVet = get('capped_share_veterans');
        expect(cappedShareVet.resistance).toBe('high');
        expect(cappedShareVet.rows.find(x => x.key === 'For')!.power).toBeCloseTo(325_000);
        expect(cappedShareVet.outcome).toBe('rejected');
        // Equal weights among the counted veterans, but the fresh whale who also voted weighs 0.
        expect(cappedShareVet.concentration.spread).toBeCloseTo(cappedShareVet.counted / (cappedShareVet.counted + cappedShareVet.excluded));

        // marginal_veterans: vet_whale 5M -> 100k + 450k + 400k = 950k; each 500k mid -> 100k + 200k = 300k (900k total).
        const marginalVet = get('marginal_veterans');
        expect(marginalVet.resistance).toBe('high');
        expect(marginalVet.rows.find(x => x.key === 'For')!.power).toBeCloseTo(950_000);
        expect(marginalVet.rows.find(x => x.key === 'Against')!.power).toBeCloseTo(900_000);
        expect(marginalVet.attack).toMatchObject({ years: 2 });

        // double_majority_sybil: capital favours For (10M vs 1.5M), but veteran funded (>=10k, 2y) headcount is 1 vs 3 -> rejected.
        const dmSybil = get('double_majority_sybil');
        expect(dmSybil.resistance).toBe('medium');
        expect(dmSybil.headcountShare).toBeCloseTo(1 / 4);
        expect(dmSybil.outcome).toBe('rejected');
        expect(dmSybil.attack).toMatchObject({ addresses: 2, years: 2 });

        // hybrid_half_veterans: excludes fresh_whale, 50% XRD + 50% equal among 4 veteran funded accounts.
        const hybridVet = get('hybrid_half_veterans');
        expect(hybridVet.resistance).toBe('medium');
        expect(hybridVet.counted).toBe(4);
        expect(hybridVet.attack).toMatchObject({ years: 2 });

        // deductible_linear: superadditive — splitting loses 10k per account.
        const deductible = get('deductible_linear');
        expect(deductible.resistance).toBe('high');
        expect(deductible.rows.find(x => x.key === 'For')!.power).toBe(9_980_000);
        expect(deductible.rows.find(x => x.key === 'Against')!.power).toBe(1_470_000);

        // capped_share_veterans_1: 1% of 6.5M veteran XRD = 65k cap per veteran address.
        const cap1Vet = get('capped_share_veterans_1');
        expect(cap1Vet.resistance).toBe('high');
        expect(cap1Vet.rows.find(x => x.key === 'For')!.power).toBeCloseTo(65_000);
        expect(cap1Vet.outcome).toBe('rejected');
    });

    it('staked-only, staked-capped, TWAB 90d and held 90d neutralise liquid and flash-bought capital', () => {
        const histVoters: MethodVoter[] = [
            // Flash-buyer: 10M liquid bought at opening, 0 staked, 0 before opening (TWAB = 2.5M, min = 0)
            { account: 'flash', choices: ['For'], power: 10_000_000, ageDays: 900, stakedXrd: 0, twab90Xrd: 2_500_000, min90Xrd: 0 },
            // Long-term stakers: 2M staked continuously for 90+ days
            { account: 'staker1', choices: ['Against'], power: 2_000_000, ageDays: 900, stakedXrd: 2_000_000, twab90Xrd: 2_000_000, min90Xrd: 2_000_000 },
            { account: 'staker2', choices: ['Against'], power: 2_000_000, ageDays: 900, stakedXrd: 2_000_000, twab90Xrd: 2_000_000, min90Xrd: 2_000_000 },
        ];
        const results = compareMethods(histVoters, choices, item);
        const get = (k: string) => results.find(r => r.key === k)!;

        // Linear: flash-buyer wins 10M vs 4M
        expect(get('linear').outcome).toBe('approved');

        // Staked-only: flash-buyer gets 0 -> stakers win 4M vs 0
        expect(get('staked_only').resistance).toBe('high');
        expect(get('staked_only').counted).toBe(2);
        expect(get('staked_only').outcome).toBe('rejected');

        // Staked-capped (5% of 4M = 200k each): stakers win equally
        expect(get('staked_capped_share').resistance).toBe('high');
        expect(get('staked_capped_share').outcome).toBe('rejected');
        // Two equal stakers out of three addresses that voted: the flash-buyer weighs 0.
        expect(get('staked_capped_share').concentration.spread).toBeCloseTo(2 / 3);

        // TWAB 90d: flash-buyer only gets 2.5M vs 4M -> rejected
        expect(get('twab_90d').resistance).toBe('high');
        expect(get('twab_90d').rows.find(x => x.key === 'For')!.power).toBe(2_500_000);
        expect(get('twab_90d').outcome).toBe('rejected');

        // Held 90d: flash-buyer gets 0 -> rejected
        expect(get('held_90d').resistance).toBe('high');
        expect(get('held_90d').counted).toBe(2);
        expect(get('held_90d').outcome).toBe('rejected');
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
        expect(r.attack).toEqual({ xrd: 4, addresses: 4, years: 0, perAddress: true });
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

describe('anti-sybil with a vote per year', () => {
    it('counts only old, funded addresses and adds a vote per full year', () => {
        const r = compareMethods([
            voter('old', 'For', 2_000, 800),     // 2 full years: 3 votes
            voter('newer', 'Against', 2_000, 400), // 1 full year: 2 votes
            voter('fresh', 'Against', 2_000, 30),  // under a year: left out
            voter('small', 'Against', 500, 900),   // under 1 000 XRD: left out
        ], choices, item).find(x => x.key === 'one_address_sybil_age')!;
        expect(r.counted).toBe(2);
        expect(r.rows.find(x => x.key === 'For')!.power).toBe(3);
        expect(r.rows.find(x => x.key === 'Against')!.power).toBe(2);
        expect(r.resistance).toBe('medium');
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

describe('degree of decentralisation', () => {
    it('is effective voters over voters, so the whole distribution counts', () => {
        // Same top holder, a different tail: the Nakamoto coefficient (1) cannot tell them apart.
        const even = concentration([60, 10, 10, 10, 10]);
        const skewed = concentration([60, 37, 1, 1, 1]);
        expect(even.nakamoto).toBe(1);
        expect(skewed.nakamoto).toBe(1);
        expect(even.spread).toBeCloseTo(even.effective / 5);
        expect(even.spread!).toBeGreaterThan(skewed.spread!);
    });

    it('counts the addresses behind each option', () => {
        expect(byKey('linear').addressesByChoice).toEqual({ For: 1, Against: 5 });
    });
});

describe('concentration', () => {
    it('counts the fewest voters above half and the effective voters', () => {
        const c = concentration([1, 1, 1, 1]);
        expect(c.nakamoto).toBe(3);
        expect(c.effective).toBeCloseTo(4);
        expect(c.top1).toBeCloseTo(0.25);
        // Four equal voters: as decentralised as it gets.
        expect(c.spread).toBeCloseTo(1);
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

describe('Majority Judgment election comparison', () => {
    it('evaluates 60% quantile per method without multiplying eligibleXrd across candidates', () => {
        const electionItem: GovernanceItem = {
            ...item,
            title: 'Council Election #1',
            quorum: 500_000,
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
                    { id: 0, displayName: 'Alice', reference: 'alice', description: '', links: [], displayOrder: 0 },
                    { id: 1, displayName: 'Bob', reference: 'bob', description: '', links: [], displayOrder: 1 },
                    { id: 2, displayName: 'Carol', reference: 'carol', description: '', links: [], displayOrder: 2 },
                ],
            },
        };
        const electionChoices = itemChoices('election', electionItem);
        // Whale (100k XRD) gives Alice=4, Bob=4, Carol=0.
        // 4 small voters (1k XRD each) give Alice=4, Bob=0, Carol=4.
        const electionVoters: MethodVoter[] = [
            { account: 'whale', choices: ['0', '1', '2'], grades: { '0': 4, '1': 4, '2': 0 }, power: 100_000, ageDays: 900 },
            { account: 's1', choices: ['0', '1', '2'], grades: { '0': 4, '1': 0, '2': 4 }, power: 1_000, ageDays: 900 },
            { account: 's2', choices: ['0', '1', '2'], grades: { '0': 4, '1': 0, '2': 4 }, power: 1_000, ageDays: 900 },
            { account: 's3', choices: ['0', '1', '2'], grades: { '0': 4, '1': 0, '2': 4 }, power: 1_000, ageDays: 900 },
            { account: 's4', choices: ['0', '1', '2'], grades: { '0': 4, '1': 0, '2': 4 }, power: 1_000, ageDays: 900 },
        ];

        const res = compareMethods(electionVoters, electionChoices, electionItem);
        const linear = res.find(r => r.key === 'linear')!;
        const oneAddr = res.find(r => r.key === 'one_address')!;

        // Eligible XRD is summed once per voter (104,000), NOT 3 × 104,000.
        expect(linear.eligibleXrd).toBe(104_000);
        expect(linear.quorumMet).toBe(false);

        // Under 1 XRD = 1 vote, whale dominates: Alice & Bob are elected.
        expect(linear.electionSummary?.elected.map(c => c.label)).toEqual(['Alice', 'Bob']);

        // Under 1 address = 1 vote, 4 small voters dominate: Alice & Carol are elected (1 seat changes).
        expect(oneAddr.electionSummary?.elected.map(c => c.label)).toEqual(['Alice', 'Carol']);
        expect(oneAddr.electionSummary?.seatsChanged).toBe(1);
        expect(oneAddr.electionSummary?.entered).toEqual(['Carol']);
        expect(oneAddr.electionSummary?.left).toEqual(['Bob']);
        expect(oneAddr.sameAsCurrent).toBe(false);

        // Double majority requires both XRD and headcount to meet the grade floor:
        // Bob fails headcount floor (4 of 5 give 0), so only Alice is elected.
        const dbl = res.find(r => r.key === 'double_majority')!;
        expect(dbl.electionSummary?.elected.map(c => c.label)).toEqual(['Alice']);
        expect(dbl.electionSummary?.seatsChanged).toBe(1);
        expect(dbl.sameAsCurrent).toBe(false);
    });

    it('preserves exact ties at the seat cutoff instead of arbitrarily breaking by candidate id', () => {
        const tieItem: GovernanceItem = {
            ...item,
            title: 'Tie Election',
            quorum: 100,
            approvalThreshold: null,
            options: [
                { id: 0, label: 'A' },
                { id: 1, label: 'B' },
                { id: 2, label: 'C' },
            ],
            election: {
                roleId: 'council',
                seatCount: 2,
                minimumMedianGrade: 2,
                candidates: [
                    { id: 0, displayName: 'A', reference: 'a', description: '', links: [], displayOrder: 0 },
                    { id: 1, displayName: 'B', reference: 'b', description: '', links: [], displayOrder: 1 },
                    { id: 2, displayName: 'C', reference: 'c', description: '', links: [], displayOrder: 2 },
                ],
            },
        };
        const tieChoices = itemChoices('election', tieItem);
        const tieVoters: MethodVoter[] = [
            { account: 'v1', choices: ['0', '1', '2'], grades: { '0': 4, '1': 3, '2': 3 }, power: 100, ageDays: 900 },
            { account: 'v2', choices: ['0', '1', '2'], grades: { '0': 4, '1': 3, '2': 3 }, power: 100, ageDays: 900 },
        ];
        const linear = compareMethods(tieVoters, tieChoices, tieItem).find(r => r.key === 'linear')!;
        expect(linear.electionSummary?.elected.map(c => c.label)).toEqual(['A']);
        expect(linear.electionSummary?.tiedAtCutoff.map(c => c.label)).toEqual(['B', 'C']);
        expect(linear.electionSummary?.standings.map(c => c.rank)).toEqual([1, 2, 2]);
    });

    it('computes family-balanced consensus and aligns entered/dropped flags with official electionData', () => {
        const electionItem: GovernanceItem = {
            ...item,
            title: 'Council Election #2',
            quorum: 100,
            approvalThreshold: null,
            options: [
                { id: 0, label: 'Alice' },
                { id: 1, label: 'Bob' },
                { id: 2, label: 'Carol' },
                { id: 3, label: 'Dave' },
            ],
            election: {
                roleId: 'council',
                seatCount: 2,
                minimumMedianGrade: 2,
                candidates: [
                    { id: 0, displayName: 'Alice', reference: 'alice', description: '', links: [], displayOrder: 0 },
                    { id: 1, displayName: 'Bob', reference: 'bob', description: '', links: [], displayOrder: 1 },
                    { id: 2, displayName: 'Carol', reference: 'carol', description: '', links: [], displayOrder: 2 },
                    { id: 3, displayName: 'Dave', reference: 'dave', description: '', links: [], displayOrder: 3 },
                ],
            },
        };
        const electionChoices = itemChoices('election', electionItem);
        const electionVoters: MethodVoter[] = [
            { account: 'whale', choices: ['0', '1', '2', '3'], grades: { '0': 4, '1': 4, '2': 2, '3': 0 }, power: 100_000, ageDays: 900 },
            { account: 's1', choices: ['0', '1', '2', '3'], grades: { '0': 4, '1': 0, '2': 4, '3': 0 }, power: 1_000, ageDays: 900 },
            { account: 's2', choices: ['0', '1', '2', '3'], grades: { '0': 4, '1': 0, '2': 4, '3': 0 }, power: 1_000, ageDays: 900 },
            { account: 's3', choices: ['0', '1', '2', '3'], grades: { '0': 4, '1': 0, '2': 4, '3': 0 }, power: 1_000, ageDays: 900 },
            { account: 's4', choices: ['0', '1', '2', '3'], grades: { '0': 4, '1': 0, '2': 4, '3': 0 }, power: 1_000, ageDays: 900 },
        ];
        const res = compareMethods(electionVoters, electionChoices, electionItem);
        const consensus = computeElectionConsensus(res);
        expect(consensus).not.toBeNull();
        // Dave is #4 in both current and consensus -> never flagged as changed/dropped.
        const dave = consensus!.candidates.find(c => c.label === 'Dave')!;
        expect(dave.inSeats).toBe(false);
        expect(dave.changedFromCurrent).toBe(false);

        // When official electionData already matches the consensus top 2 (Alice & Carol),
        // neither Alice, Carol, Bob, nor Dave is flagged as changedFromCurrent.
        const officialAligned = {
            status: 'LIVE',
            round: 'RoundOne' as const,
            provisional: true,
            totalVotingPower: '104000',
            quorumXrd: '100',
            quorumMet: true,
            minimumMedianGrade: 2,
            gradeQuantileApplied: '3/5',
            reserveListDays: null,
            parameterSetId: null,
            parameterSetVersion: null,
            tcVotingStart: null,
            tcVotingEnd: null,
            roundSnapshotAt: null,
            temperatureCheckResult: null,
            candidateResults: [
                { candidateId: 0, histogram: ['0', '0', '0', '0', '104000'] as [string, string, string, string, string], qualifyingGrade: 4, powerAbove: '0', powerBelow: '0', p: '0', q: '0', band: 'B', electable: true, rank: 1, tieGroupId: 1, outcome: 'ELECTED' },
                { candidateId: 2, histogram: ['0', '0', '100000', '0', '4000'] as [string, string, string, string, string], qualifyingGrade: 2, powerAbove: '4000', powerBelow: '0', p: '0.038', q: '0', band: 'A', electable: true, rank: 2, tieGroupId: 2, outcome: 'ELECTED' },
                { candidateId: 1, histogram: ['4000', '0', '0', '0', '100000'] as [string, string, string, string, string], qualifyingGrade: 4, powerAbove: '0', powerBelow: '4000', p: '0', q: '0.038', band: 'C', electable: true, rank: 3, tieGroupId: 3, outcome: 'RESERVE' },
                { candidateId: 3, histogram: ['104000', '0', '0', '0', '0'] as [string, string, string, string, string], qualifyingGrade: 0, powerAbove: '0', powerBelow: '0', p: '0', q: '0', band: 'B', electable: false, rank: 4, tieGroupId: 4, outcome: 'NOT_ELECTABLE' },
            ],
        };
        const aligned = computeElectionConsensus(res, officialAligned)!;
        expect(aligned.candidates.find(c => c.label === 'Dave')!.changedFromCurrent).toBe(false);
        const enteredCount = aligned.candidates.filter(c => c.changedFromCurrent && c.inSeats).length;
        const droppedCount = aligned.candidates.filter(c => c.changedFromCurrent && !c.inSeats).length;
        expect(enteredCount).toBe(droppedCount);

        // Weighted concentration & conclusions match live math with zero drift.
        expect(aligned.weightedConcentration.decisiveQuantile).toBeGreaterThan(1);
        expect(aligned.weightedConcentration.spread).toBeGreaterThan(0);
        const concl = computeElectionConclusions(aligned, res, electionVoters.map(v => v.power), 100, '3/5');
        expect(concl.currentDecisiveBlock?.count).toBe(1); // whale alone holds >60%
        expect(concl.currentDecisiveBlock?.total).toBe(5);
        expect(concl.weightedDecisiveBlock?.avgCount).toBe(aligned.weightedConcentration.decisiveQuantile);
        expect(concl.byFamily.length).toBeGreaterThan(0);
    });
});
