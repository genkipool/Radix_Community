import { describe, it, expect } from 'vitest';
import { buildVoteManifest } from '@/features/governance/lib/voteManifest';
import { parseVoterEntry, uniqueVoters } from '@/features/governance/lib/governanceVotes';
import { governanceItemPath, kindFromSegment } from '@/features/governance/lib/paths';

const COMPONENT = 'component_rdx1_test_governance';
const ACCOUNT = 'account_rdx1_test_voter';

describe('buildVoteManifest', () => {
    it('votes on a proposal with the chosen option ids', () => {
        const m = buildVoteManifest({ component: COMPONENT, kind: 'proposal', itemId: '0', accounts: [ACCOUNT], selection: { type: 'options', optionIds: [0, 2] } });
        expect(m).toBe([
            'CALL_METHOD',
            `    Address("${COMPONENT}")`,
            '    "vote_on_proposal"',
            `    Address("${ACCOUNT}")`,
            '    0u64',
            '    Array<Tuple>(Tuple(0u32), Tuple(2u32))',
            ';',
            // Makes the wallet sign with the voting account (owner-protected method).
            'CALL_METHOD',
            `    Address("${ACCOUNT}")`,
            '    "deposit_batch"',
            '    Expression("ENTIRE_WORKTOP")',
            ';',
            '',
        ].join('\n'));
        expect(m).not.toContain('lock_fee');
    });

    it('votes on a temperature check with the stance enum variant', () => {
        const forVote = buildVoteManifest({ component: COMPONENT, kind: 'temperature_check', itemId: '6', accounts: [ACCOUNT], selection: { type: 'stance', stance: 'For' } });
        const against = buildVoteManifest({ component: COMPONENT, kind: 'temperature_check', itemId: '6', accounts: [ACCOUNT], selection: { type: 'stance', stance: 'Against' } });
        expect(forVote).toContain('"vote_on_temperature_check"');
        expect(forVote).toContain('    6u64\n    Enum<0u8>()');
        expect(against).toContain('Enum<1u8>()');
    });

    it('refuses anything that could break out of the manifest', () => {
        const base = { component: COMPONENT, kind: 'proposal' as const, itemId: '0', accounts: [ACCOUNT], selection: { type: 'options' as const, optionIds: [0] } };
        expect(() => buildVoteManifest({ ...base, accounts: ['account_x") ; CALL_METHOD'] })).toThrow();
        expect(() => buildVoteManifest({ ...base, accounts: [] })).toThrow();
        expect(() => buildVoteManifest({ ...base, itemId: '1u64' })).toThrow();
        expect(() => buildVoteManifest({ ...base, selection: { type: 'options', optionIds: [] } })).toThrow();
        expect(() => buildVoteManifest({ ...base, selection: { type: 'options', optionIds: [-1] } })).toThrow();
        expect(() => buildVoteManifest({ ...base, kind: 'temperature_check', selection: { type: 'stance', stance: 'Maybe' } })).toThrow();
    });
});

describe('voting with several accounts', () => {
    it('casts the vote from every account and makes each one sign', () => {
        const m = buildVoteManifest({ component: COMPONENT, kind: 'temperature_check', itemId: '7', accounts: [ACCOUNT, 'account_rdx1_test_second', ACCOUNT], selection: { type: 'stance', stance: 'For' } });
        expect(m.match(/"vote_on_temperature_check"/g)).toHaveLength(2);
        expect(m.match(/"deposit_batch"/g)).toHaveLength(2);
        expect(m.indexOf('account_rdx1_test_second')).toBeGreaterThan(m.indexOf(ACCOUNT));
    });
});

describe('voter entries and paths', () => {
    it('reads the current vote of an account', () => {
        expect(parseVoterEntry({ kind: 'Tuple', fields: [
            { kind: 'U64', field_name: 'vote_id', value: '0' },
            { kind: 'Enum', field_name: 'vote', variant_name: 'For', fields: [] },
        ] }, 'temperature_check')).toEqual({ type: 'stance', stance: 'For' });
        expect(parseVoterEntry({ kind: 'Tuple', fields: [
            { kind: 'Array', field_name: 'options', elements: [{ kind: 'Tuple', fields: [{ kind: 'U32', value: '1' }] }] },
        ] }, 'proposal')).toEqual({ type: 'options', optionIds: [1] });
        expect(parseVoterEntry(null, 'proposal')).toBeNull();
    });

    it('counts distinct voters, not vote records', () => {
        expect(uniqueVoters({ voteCount: 108, revoteCount: 1 } as never)).toBe(107);
        expect(uniqueVoters(null)).toBeNull();
    });

    it('maps kinds to URL segments and back', () => {
        expect(governanceItemPath('radix-dao', 'temperature_check', '4')).toBe('/governance/radix-dao/temperature-check/4');
        expect(kindFromSegment('proposal')).toBe('proposal');
        expect(kindFromSegment('nope')).toBeNull();
    });
});
