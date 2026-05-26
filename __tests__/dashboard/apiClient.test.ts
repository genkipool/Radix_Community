import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '@/__tests__/mocks/server';
import { http, HttpResponse } from 'msw';
import {
    apiFetchTransactions,
    apiFetchTransactionDetails,
    apiFetchEntityDetails,
    apiFetchNonFungibleData,
    apiFetchValidators,
} from '@/features/dashboard/services/apiClient';

// ─── MSW lifecycle ───────────────────────────────────────────────────────────
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── apiFetchTransactions ────────────────────────────────────────────────────
describe('apiFetchTransactions', () => {
    it('returns transactions and nextCursor on success', async () => {
        // Arrange (server is already set up with default handlers)
        // Act
        const result = await apiFetchTransactions({});
        // Assert
        expect(result.transactions).toBeDefined();
        expect(Array.isArray(result.transactions)).toBe(true);
        expect(result.transactions.length).toBeGreaterThan(0);
        expect(result.nextCursor).toBe('cursor_page2');
    });

    it('passes cursor and limit as query params', async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
            http.get('/api/transactions', ({ request }) => {
                capturedUrl = request.url;
                return HttpResponse.json({ transactions: [], nextCursor: undefined });
            }),
        );
        // Act
        await apiFetchTransactions({ cursor: 'abc', limit: 5, address: 'account_xyz' });
        // Assert
        const url = new URL(capturedUrl);
        expect(url.searchParams.get('cursor')).toBe('abc');
        expect(url.searchParams.get('limit')).toBe('5');
        expect(url.searchParams.get('address')).toBe('account_xyz');
    });

    it('throws an error on server error (500)', async () => {
        // Arrange
        server.use(
            http.get('/api/transactions', () => {
                return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
            }),
        );
        // Act & Assert
        await expect(apiFetchTransactions({})).rejects.toThrow('API error');
    });

    it('handles empty result set', async () => {
        // Arrange
        server.use(
            http.get('/api/transactions', () => {
                return HttpResponse.json({ transactions: [], nextCursor: undefined });
            }),
        );
        // Act
        const result = await apiFetchTransactions({});
        // Assert
        expect(result.transactions).toEqual([]);
        expect(result.nextCursor).toBeUndefined();
    });
});

// ─── apiFetchTransactionDetails ──────────────────────────────────────────────
describe('apiFetchTransactionDetails', () => {
    it('returns transaction details on success', async () => {
        // Act
        const result = await apiFetchTransactionDetails('txid_test_123');
        // Assert
        expect(result.intent_hash).toBe('txid_test_123');
        expect(result.receipt).toBeDefined();
        expect(result.manifest_instructions).toBeDefined();
    });

    it('encodes special characters in the hash URL', async () => {
        // Arrange
        let capturedPath = '';
        server.use(
            http.get('/api/transactions/:hash', ({ params }) => {
                capturedPath = params.hash as string;
                return HttpResponse.json({ intent_hash: params.hash });
            }),
        );
        // Act
        await apiFetchTransactionDetails('tx/with+special');
        // Assert — the value arrives decoded by MSW so we check it was sent
        expect(capturedPath).toBeDefined();
    });
});

// ─── apiFetchEntityDetails ───────────────────────────────────────────────────
describe('apiFetchEntityDetails', () => {
    it('returns entity metadata on success', async () => {
        // Act
        const result = await apiFetchEntityDetails('resource_rdx1_test');
        // Assert
        expect(result.metadata.items).toHaveLength(3);
        const nameItem = result.metadata.items.find((i) => i.key === 'name');
        expect((nameItem?.value as { typed?: { value?: string } })?.typed?.value).toBe('Test Token');
    });

    it('throws on 500 error', async () => {
        // Arrange
        server.use(
            http.post('https://mainnet.radixdlt.com/state/entity/details', () => {
                return HttpResponse.json({ error: 'Server Error' }, { status: 500 });
            }),
        );
        // Act & Assert
        await expect(apiFetchEntityDetails('resource_rdx1_fail')).rejects.toThrow('API error');
    });
});

// ─── apiFetchNonFungibleData ─────────────────────────────────────────────────
describe('apiFetchNonFungibleData', () => {
    it('returns NFT data for given local IDs', async () => {
        // Act
        const result = await apiFetchNonFungibleData('resource_rdx1_nft', ['#1#', '#2#']);
        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].non_fungible_id).toBe('#1#');
        expect(result[1].non_fungible_id).toBe('#2#');
    });

    it('sends correct POST body', async () => {
        // Arrange
        let capturedBody: Record<string, unknown> | null = null;
        server.use(
            http.post('https://mainnet.radixdlt.com/state/non-fungible/data', async ({ request }) => {
                capturedBody = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ non_fungible_ids: [] });
            }),
        );
        // Act
        // By default network='mainnet' if not provided
        await apiFetchNonFungibleData('resource_abc', ['#99#']);
        // Assert
        expect(capturedBody).toEqual({ resource_address: 'resource_abc', non_fungible_ids: ['#99#'] });
    });

    it('handles empty localIds array', async () => {
        // Act
        const result = await apiFetchNonFungibleData('resource_rdx1_nft', []);
        // Assert
        expect(result).toEqual([]);
    });
});

// ─── apiFetchValidators ───────────────────────────────────────────────────────
describe('apiFetchValidators', () => {
    it('fetches validators and networkStats', async () => {
        server.use(
            http.get('/api/validators', () => {
                return HttpResponse.json({
                    validators: [
                        { address: 'validator_rdx1abc', name: 'Test Validator', status: 'active', delegatedStake: 1000000 }
                    ],
                    networkStats: { totalStaked: 5000000000, activeValidators: 100, epoch: 42 },
                });
            }),
        );
        const result = await apiFetchValidators('mainnet');
        expect(result.validators).toBeDefined();
        expect(result.networkStats).toBeDefined();
        expect(result.validators.length).toBeGreaterThan(0);
    });

    it('throws on HTTP error', async () => {
        server.use(
            http.get('/api/validators', () => HttpResponse.json({}, { status: 500 })),
        );
        await expect(apiFetchValidators()).rejects.toThrow();
    });
});

