import { http, HttpResponse } from 'msw';

const mockTransaction = {
    intentHash: 'txid_test_abc123',
    status: 'CommittedSuccess',
    feePaid: 0.5,
    confirmedAt: '2026-03-01T12:00:00Z',
    message: 'Test transfer',
    epoch: 100,
    round: 5,
    accountsCount: 2,
    componentsCount: 1,
    hasNfts: false,
};

export const handlers = [
    // GET /api/transactions
    http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '15');
        const cursor = url.searchParams.get('cursor');

        return HttpResponse.json({
            transactions: Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
                ...mockTransaction,
                intentHash: `txid_test_${cursor ? 'page2_' : ''}${i}`,
            })),
            nextCursor: cursor ? undefined : 'cursor_page2',
        });
    }),

    // GET /api/transactions/:hash
    http.get('/api/transactions/:hash', ({ params }) => {
        return HttpResponse.json({
            intent_hash: params.hash,
            state_version: 12345,
            epoch: 100,
            round: 5,
            confirmed_at: '2026-03-01T12:00:00Z',
            receipt: {
                status: 'CommittedSuccess',
                events: [],
            },
            manifest_instructions: 'CALL_METHOD ...',
            balance_changes: {
                fungible_fee_balance_changes: [],
                fungible_balance_changes: [],
                non_fungible_balance_changes: [],
            },
        });
    }),

    // GET /api/entity/:address
    http.get('/api/entity/:address', () => {
        return HttpResponse.json({
            metadata: {
                items: [
                    { key: 'name', value: { typed: { value: 'Test Token' } } },
                    { key: 'symbol', value: { typed: { value: 'TST' } } },
                    { key: 'icon_url', value: { typed: { value: 'https://example.com/icon.png' } } },
                ],
            },
        });
    }),


    // GET /api/validators
    http.get('/api/validators', () => {
        return HttpResponse.json({
            validators: [
                {
                    address: 'validator_rdx1test',
                    name: 'Test Validator',
                    status: 'active',
                    delegatedStake: 1000000,
                    apy: 7.5,
                    nominalFee: 1,
                    recentUptime: 99.5,
                    rank: 1,
                },
            ],
            networkStats: {
                totalStaked: 5000000000,
                activeValidators: 100,
                totalValidators: 150,
                avgApy: 7.2,
                avgUptime: 98.5,
                epoch: 42,
            },
        });
    }),

    // GET /api/round-proposer
    http.get('/api/round-proposer', () => {
        return HttpResponse.json('validator_rdx1proposer');
    }),

    // POST /api/nft-data
    http.post('/api/nft-data', async ({ request }) => {
        const body = (await request.json()) as { resourceAddress: string; localIds: string[] };
        return HttpResponse.json(
            (body.localIds || []).map((id: string) => ({
                non_fungible_id: id,
                data: { programmatic_json: { fields: [{ field_name: 'name', value: `NFT #${id}` }] } },
            })),
        );
    }),
];
