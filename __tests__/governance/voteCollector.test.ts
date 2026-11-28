import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
import { collectorFor, fetchVoteTally } from '@/features/governance/services/voteCollector.server';

const DAO = 'component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k';
const VOTER = 'account_rdx1_test_voter';

afterEach(() => vi.unstubAllGlobals());

describe('voteCollector', () => {
    it('only knows the listed governance components', () => {
        expect(collectorFor(DAO)).toBe('https://vote.radixdao.org');
        expect(collectorFor('component_rdx1unknown')).toBeNull();
        expect(collectorFor('toString')).toBeNull();
    });

    it('returns the tally and just the requested account power', async () => {
        const fetchMock = vi.fn(async (url: string) => ({
            ok: true,
            json: async () => url.includes('/vote-results')
                ? { results: [{ vote: '0', votePower: '899008040.9' }, { vote: 1, votePower: 'x' }] }
                : [{ accountAddress: 'account_rdx1other', vote: '1', votePower: '5' }, { accountAddress: VOTER, vote: '0', votePower: '12.5' }],
        }));
        vi.stubGlobal('fetch', fetchMock);

        const tally = await fetchVoteTally(DAO, 'proposal', '0', { account: VOTER, withVoters: true });
        expect(tally).toEqual({
            results: [{ vote: '0', votePower: '899008040.9' }],
            accountPower: '12.5',
            accountVotes: [
                { account: 'account_rdx1other', vote: '1', votePower: '5' },
                { account: VOTER, vote: '0', votePower: '12.5' },
            ],
            source: 'vote.radixdao.org',
        });
        expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
            'https://vote.radixdao.org/vote-results?type=proposal&entityId=0',
            'https://vote.radixdao.org/account-votes?type=proposal&entityId=0',
        ]);
        expect(await fetchVoteTally('component_rdx1unknown', 'proposal', '0')).toBeNull();
    });

    it('weighs an election at round one snapshot, also during a rerun', async () => {
        const payload = (round: string) => ({
            election: { snapshotAt: '2026-01-01T00:00:00.000Z' },
            currentRound: { round, snapshotAt: round === 'Rerun' ? '2026-01-20T00:00:00.000Z' : '2026-01-08T00:00:00.000Z' },
            rounds: [
                { round: 'RoundOne', snapshotAt: '2026-01-08T00:00:00.000Z' },
                ...(round === 'Rerun' ? [{ round: 'Rerun', snapshotAt: '2026-01-20T00:00:00.000Z' }] : []),
            ],
            result: { round, totalVotingPower: '10', candidateResults: [] },
        });
        for (const round of ['RoundOne', 'Rerun']) {
            vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload(round) })));
            const tally = await fetchVoteTally(DAO, 'election', '7');
            expect(tally?.electionData?.roundSnapshotAt).toBe('2026-01-08T00:00:00.000Z');
        }
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ result: { totalVotingPower: '1' } }) })));
        expect((await fetchVoteTally(DAO, 'election', '8'))?.electionData?.roundSnapshotAt).toBeNull();
    });
});
