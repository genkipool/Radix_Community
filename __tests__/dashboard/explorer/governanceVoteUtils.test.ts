import { describe, it, expect } from 'vitest';
import {
    extractGovernanceVotes, parseGovernanceItem, findStoreAddress, selectedLabels, toneOf, votingPhase, votingProgress,
} from '@/features/dashboard/explorador/utils/governanceVoteUtils';
import type { GatewayEvent } from '@/features/dashboard/types';

const ACCOUNT = 'account_rdx168u7hevd7s30a3hj8cu6qvp4ffehm5f3xvzet3gspdsdc2cq7y6tjq';
const DAO = 'component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k';
const V2 = 'component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt';
const none = { variant_id: '0', variant_name: 'None', fields: [], kind: 'Enum', type_name: 'Option', field_name: 'replacing_vote_id' };

// Events from txid_rdx1ey3evjm9… (proposal GP #0) and txid_rdx19uawa8… (temperature check #4)
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

// Trimmed programmatic JSON of proposal #0 (thresholds under its parameter set)
const proposal = {
    kind: 'Tuple', type_name: 'Proposal', fields: [
        { kind: 'String', field_name: 'title', value: 'RadixDAO: Constitutional ratification of the Governance Framework' },
        { kind: 'String', field_name: 'short_description', value: 'Ratify the Charter' },
        { kind: 'Array', field_name: 'vote_options', elements: [option(0, 'Approve'), option(1, 'Reject'), option(2, 'Abstain')] },
        { kind: 'Array', field_name: 'links', elements: [{ kind: 'String', value: 'https://radixdao.org' }, { kind: 'String', value: 'javascript:alert(1)' }] },
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
        { kind: 'Reference', field_name: 'author', value: 'account_rdx12yu55zy3cx3lx3xjkp9f2vzp2ye2mql5vzhxvq0tks74d5hcp0xkvs' },
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
            title: 'RadixDAO: Constitutional ratification of the Governance Framework',
            options: [{ id: 0, label: 'Approve' }, { id: 1, label: 'Reject' }, { id: 2, label: 'Abstain' }],
            links: ['https://radixdao.org'],
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
                { kind: 'String', field_name: 'title', value: 'Stokenet hosting proposal' },
                { kind: 'Decimal', field_name: 'quorum', value: '402876916' },
                { kind: 'Decimal', field_name: 'approval_threshold', value: '0.5' },
                { kind: 'Enum', field_name: 'elevated_proposal_id', variant_name: 'Some', fields: [{ kind: 'U64', value: '1' }] },
            ],
        };
        expect(parseGovernanceItem(tc, 'temperature_check')).toMatchObject({ quorum: 402876916, approvalThreshold: 0.5, elevatedProposalId: '1' });
        expect(parseGovernanceItem(proposal, 'proposal')?.elevatedProposalId).toBeNull();
    });
});
