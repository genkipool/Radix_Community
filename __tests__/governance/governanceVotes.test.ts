import { describe, it, expect } from 'vitest';
import {
    ballotChoices, summarizeTally,
    extractGovernanceVotes, parseGovernanceItem, findStoreAddress, selectedLabels, toneOf, votingPhase, votingProgress,
} from '@/features/governance/lib/governanceVotes';
import type { GatewayEvent } from '@/features/dashboard/types';

const ACCOUNT = 'account_rdx1_test_voter';
const DAO = 'component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k';
const V2 = 'component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt';
const none = { variant_id: '0', variant_name: 'None', fields: [], kind: 'Enum', type_name: 'Option', field_name: 'replacing_vote_id' };

// Event shapes as emitted by the governance blueprints (proposal and temperature check)
const proposalVote = {
    name: 'ProposalVotedEvent',
    emitter: { entity: { entity_address: DAO, entity_type: 'GlobalGenericComponent' } },
    data: {
        kind: 'Tuple', fields: [
            { value: '0', kind: 'U64', field_name: 'proposal_id' },
            { value: '100', kind: 'U64', field_name: 'vote_id' },
            { value: ACCOUNT, kind: 'Reference', field_name: 'account' },
            { kind: 'Array', field_name: 'options', elements: [{ kind: 'Tuple', fields: [{ value: '0', kind: 'U32' }] }] },
            none,
        ],
    },
};
const tcVote = {
    name: 'TemperatureCheckVotedEvent',
    emitter: { entity: { entity_address: V2, entity_type: 'GlobalGenericComponent' } },
    data: {
        kind: 'Tuple', fields: [
            { value: '4', kind: 'U64', field_name: 'temperature_check_id' },
            { value: '42', kind: 'U64', field_name: 'vote_id' },
            { value: ACCOUNT, kind: 'Reference', field_name: 'account' },
            { variant_id: '0', variant_name: 'For', fields: [], kind: 'Enum', field_name: 'vote' },
            { ...none, variant_id: '1', variant_name: 'Some', fields: [{ value: '7', kind: 'U64' }] },
        ],
    },
};
const noise = { name: 'LockFeeEvent', emitter: { entity: { entity_address: 'internal_vault_x', entity_type: 'InternalFungibleVault' } }, data: { fields: [] } };

const option = (id: number, label: string) => ({ kind: 'Tuple', fields: [
    { kind: 'Tuple', field_name: 'id', fields: [{ kind: 'U32', value: String(id) }] },
    { kind: 'String', field_name: 'label', value: label },
] });

// Programmatic JSON shaped like a governance proposal (thresholds under its parameter set)
const proposal = {
    kind: 'Tuple', type_name: 'Proposal', fields: [
        { kind: 'String', field_name: 'title', value: 'Sample governance proposal' },
        { kind: 'String', field_name: 'short_description', value: 'A short summary' },
        { kind: 'Array', field_name: 'vote_options', elements: [option(0, 'Approve'), option(1, 'Reject'), option(2, 'Abstain')] },
        { kind: 'Array', field_name: 'links', elements: [{ kind: 'String', value: 'https://example.org/discussion' }, { kind: 'String', value: 'javascript:alert(1)' }] },
        { kind: 'Tuple', field_name: 'parameter_set', fields: [
            { kind: 'String', field_name: 'label', value: 'Constitutional' },
            { kind: 'Enum', field_name: 'parameters', variant_name: 'Standard', fields: [
                { kind: 'Tuple', field_name: 'temperature_check', fields: [{ kind: 'Decimal', field_name: 'approval_threshold', value: '0.5' }] },
                { kind: 'Tuple', field_name: 'proposal', fields: [
                    { kind: 'Decimal', field_name: 'quorum', value: '1350832592' },
                    { kind: 'Decimal', field_name: 'approval_threshold', value: '0.66' },
                ] },
            ] },
        ] },
        { kind: 'U64', field_name: 'vote_count', value: '101' },
        { kind: 'I64', field_name: 'start', value: '1790349531' },
        { kind: 'I64', field_name: 'deadline', value: '1790954331' },
        { kind: 'Reference', field_name: 'author', value: 'account_rdx1_test_author' },
    ],
};

describe('governanceVoteUtils', () => {
    it('reads proposal and temperature check votes and skips other events', () => {
        const votes = extractGovernanceVotes([noise, proposalVote, tcVote] as unknown as GatewayEvent[]);
        expect(votes).toEqual([
            { kind: 'proposal', component: DAO, itemId: '0', voteId: '100', account: ACCOUNT, selection: { type: 'options', optionIds: [0] }, replacingVoteId: null },
            { kind: 'temperature_check', component: V2, itemId: '4', voteId: '42', account: ACCOUNT, selection: { type: 'stance', stance: 'For' }, replacingVoteId: '7' },
        ]);
        expect(extractGovernanceVotes()).toEqual([]);
    });

    it('parses a proposal, taking its thresholds from the matching parameter set', () => {
        const item = parseGovernanceItem(proposal, 'proposal');
        expect(item).toMatchObject({
            title: 'Sample governance proposal',
            options: [{ id: 0, label: 'Approve' }, { id: 1, label: 'Reject' }, { id: 2, label: 'Abstain' }],
            links: ['https://example.org/discussion'],
            voteCount: 101,
            quorum: 1350832592,
            approvalThreshold: 0.66,
            parameterLabel: 'Constitutional',
        });
        expect(parseGovernanceItem(null, 'proposal')).toBeNull();
    });

    it('labels the choice and its tone', () => {
        const item = parseGovernanceItem(proposal, 'proposal');
        expect(selectedLabels({ type: 'options', optionIds: [0] }, item)).toEqual(['Approve']);
        expect(selectedLabels({ type: 'options', optionIds: [5] }, null)).toEqual(['#5']);
        expect(selectedLabels({ type: 'stance', stance: 'For' }, null)).toEqual(['For']);
        expect([toneOf('Approve'), toneOf('Against'), toneOf('No'), toneOf('Abstain')]).toEqual(['positive', 'negative', 'negative', 'neutral']);
    });

    it('places the vote in its voting window', () => {
        const item = parseGovernanceItem(proposal, 'proposal');
        expect(votingPhase(item, 1790349000)).toBe('upcoming');
        expect(votingPhase(item, 1790600000)).toBe('open');
        expect(votingPhase(item, 1791000000)).toBe('closed');
        expect(votingProgress(item, 1790651931)).toBeCloseTo(0.5, 5);
        expect(votingPhase(null)).toBe('unknown');
    });

    it('finds the item store in the component state', () => {
        const state = { kind: 'Tuple', fields: [{ kind: 'Own', field_name: 'proposals', value: 'internal_keyvaluestore_rdx1abc' }] };
        expect(findStoreAddress(state, 'proposals')).toBe('internal_keyvaluestore_rdx1abc');
        expect(findStoreAddress(state, 'temperature_checks')).toBeNull();
    });

    it('reads a temperature check with its own thresholds and the proposal it moved on to', () => {
        const tc = {
            kind: 'Tuple', type_name: 'TemperatureCheck', fields: [
                { kind: 'String', field_name: 'title', value: 'Sample temperature check' },
                { kind: 'Decimal', field_name: 'quorum', value: '402876916' },
                { kind: 'Decimal', field_name: 'approval_threshold', value: '0.5' },
                { kind: 'Enum', field_name: 'elevated_proposal_id', variant_name: 'Some', fields: [{ kind: 'U64', value: '1' }] },
            ],
        };
        expect(parseGovernanceItem(tc, 'temperature_check')).toMatchObject({ quorum: 402876916, approvalThreshold: 0.5, elevatedProposalId: '1' });
        expect(parseGovernanceItem(proposal, 'proposal')?.elevatedProposalId).toBeNull();
    });

    describe('weighted result', () => {
        const item = parseGovernanceItem(proposal, 'proposal');
        const vote = extractGovernanceVotes([proposalVote] as unknown as GatewayEvent[])[0];
        const choices = ballotChoices(vote, item);

        it('passes when the quorum is met and approval reaches the threshold, leaving abstentions out', () => {
            const t = summarizeTally(choices, {
                results: [{ vote: '0', votePower: '1200000000' }, { vote: '1', votePower: '300000000' }, { vote: '2', votePower: '500000000' }],
                accountPower: '20000000',
            }, item);
            expect(t.turnout).toBe(2e9);
            expect(t.quorumMet).toBe(true);
            expect(t.approvalShare).toBeCloseTo(0.8);
            expect(t.outcome).toBe('approved');
            expect(t.rows.map(r => [r.key, r.selected, r.share])).toEqual([['0', true, 0.6], ['1', false, 0.15], ['2', false, 0.25]]);
            expect(t.accountShare).toBeCloseTo(0.01);
        });

        it('fails below the threshold and reports a missing quorum first', () => {
            expect(summarizeTally(choices, { results: [{ vote: '0', votePower: '800000000' }, { vote: '1', votePower: '700000000' }], accountPower: null }, item).outcome).toBe('rejected');
            const low = summarizeTally(choices, { results: [{ vote: '0', votePower: '899008040.9' }], accountPower: null }, item);
            expect(low.quorumMet).toBe(false);
            expect(low.outcome).toBe('no_quorum');
            expect(low.accountPower).toBeNull();
        });

        it('weighs For/Against temperature checks and keeps choices the ballot did not list', () => {
            const tc = extractGovernanceVotes([tcVote] as unknown as GatewayEvent[])[0];
            const t = summarizeTally(ballotChoices(tc, null), {
                results: [{ vote: 'For', votePower: '613014860.17' }, { vote: 'Other', votePower: '1' }],
                accountPower: null,
            }, { ...item!, quorum: 402876916, approvalThreshold: 0.5 });
            expect(t.rows.map(r => r.key)).toEqual(['For', 'Against', 'Other']);
            expect(t.outcome).toBe('approved');
        });
    });
});
