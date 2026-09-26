import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }));
const gatewayPost = vi.fn();
vi.mock('@/services/gateway/bases', () => ({ gatewayPost: (...args: unknown[]) => gatewayPost(...args) }));
vi.mock('@/services/gateway/client', () => ({ withRetry: (fn: () => unknown) => fn() }));

import { fetchVoteRecords } from '@/features/governance/services/voteRecords.server';

const COMPONENT = 'component_rdx1_test_governance';
const SYSTEM = { key: 'test', name: 'Test', network: 'mainnet' as const, component: COMPONENT, collector: 'https://collector.example', website: 'https://example.org' };

const voted = (id: string, voteId: string, account: string, stance: string) => ({
    name: 'TemperatureCheckVotedEvent',
    emitter: { entity: { entity_address: COMPONENT } },
    data: { kind: 'Tuple', fields: [
        { field_name: 'temperature_check_id', kind: 'U64', value: id },
        { field_name: 'vote_id', kind: 'U64', value: voteId },
        { field_name: 'account', kind: 'Reference', value: account },
        { field_name: 'vote', kind: 'Enum', variant_name: stance, fields: [] },
        { field_name: 'replacing_vote_id', kind: 'Enum', variant_name: 'None', fields: [] },
    ] },
});

afterEach(() => gatewayPost.mockReset());

describe('fetchVoteRecords', () => {
    it('keeps each account\'s latest vote on the item, across pages, with its transaction', async () => {
        gatewayPost
            .mockResolvedValueOnce({
                items: [
                    { intent_hash: 'txid_a', confirmed_at: '2026-08-01T10:00:00Z', receipt: { events: [voted('6', '0', 'account_rdx1_alice', 'For')] } },
                    { intent_hash: 'txid_b', confirmed_at: '2026-08-01T11:00:00Z', receipt: { events: [voted('5', '3', 'account_rdx1_alice', 'For')] } },
                ],
                next_cursor: 'next',
            })
            .mockResolvedValueOnce({
                items: [
                    { intent_hash: 'txid_c', confirmed_at: '2026-08-02T09:00:00Z', receipt: { events: [voted('6', '1', 'account_rdx1_bob', 'Against')] } },
                    { intent_hash: 'txid_d', confirmed_at: '2026-08-02T10:00:00Z', receipt: { events: [voted('6', '2', 'account_rdx1_alice', 'Against')] } },
                ],
                next_cursor: null,
            });

        const records = await fetchVoteRecords(SYSTEM, 'temperature_check', '6', { start: 1785576512, deadline: 1786008512, closed: true });
        expect(records).toEqual([
            { account: 'account_rdx1_alice', choices: ['Against'], voteId: 2, txid: 'txid_d', time: '2026-08-02T10:00:00Z', votes: 2 },
            { account: 'account_rdx1_bob', choices: ['Against'], voteId: 1, txid: 'txid_c', time: '2026-08-02T09:00:00Z', votes: 1 },
        ]);
        const firstBody = gatewayPost.mock.calls[0][2] as Record<string, unknown>;
        expect(firstBody.event_global_emitters_filter).toEqual([COMPONENT]);
        expect(firstBody.from_ledger_state).toEqual({ timestamp: new Date(1785576512 * 1000).toISOString() });
        expect(gatewayPost.mock.calls[1][2]).toMatchObject({ cursor: 'next' });
    });
});
