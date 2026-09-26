import { describe, it, expect, vi, afterEach } from 'vitest';
import { collectorFor, fetchVoteTally } from '@/services/governance/voteCollector';

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
                : [{ accountAddress: 'account_rdx1other', votePower: '5' }, { accountAddress: VOTER, votePower: '12.5' }],
        }));
        vi.stubGlobal('fetch', fetchMock);

        const tally = await fetchVoteTally(DAO, 'proposal', '0', VOTER);
        expect(tally).toEqual({ results: [{ vote: '0', votePower: '899008040.9' }], accountPower: '12.5', source: 'vote.radixdao.org' });
        expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
            'https://vote.radixdao.org/vote-results?type=proposal&entityId=0',
            'https://vote.radixdao.org/account-votes?type=proposal&entityId=0',
        ]);
        expect(await fetchVoteTally('component_rdx1unknown', 'proposal', '0', null)).toBeNull();
    });
});
