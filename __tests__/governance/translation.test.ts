import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const store = new Map<string, unknown>();
const redis = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: unknown, opts?: { nx?: boolean }) => {
        if (opts?.nx && store.has(k)) return null;
        store.set(k, v);
        return 'OK';
    }),
    del: vi.fn(async (k: string) => { store.delete(k); return 1; }),
};
vi.mock('@/lib/redis', () => ({ getRedis: () => redis }));

const finalMessage = vi.fn();
const stream = vi.fn((_params: Record<string, unknown>) => ({ finalMessage }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { stream } }; } }));

import { getCachedTranslation, requestTranslation, isTranslatable } from '@/features/governance/services/translation.server';
import type { GovernanceItem } from '@/features/governance/lib/governanceVotes';

const item = {
    title: 'Sample proposal', shortDescription: 'Short', description: '# Heading\n\nBody with account_rdx1_test_voter',
    options: [{ id: 0, label: 'Approve' }, { id: 1, label: 'Reject' }],
} as GovernanceItem;

const answer = { title: 'Propuesta de ejemplo', shortDescription: 'Corta', description: '# Encabezado\n\nCuerpo con account_rdx1_test_voter', options: [{ id: 0, label: 'Aprobar' }, { id: 1, label: 'Rechazar' }, { id: 9, label: 'Inventada' }] };

beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    finalMessage.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(answer) }] });
});

describe('proposal translation', () => {
    it('only offers the site languages besides English', () => {
        expect(isTranslatable('es')).toBe(true);
        expect(isTranslatable('en')).toBe(false);
        expect(isTranslatable('toString')).toBe(false);
    });

    it('claims the work once, stores the result and serves it from the cache afterwards', async () => {
        const first = await requestTranslation(item, 'es');
        expect(first.state).toEqual({ status: 'pending' });
        // A second reader while it runs does not start another translation.
        expect((await requestTranslation(item, 'es')).run).toBeUndefined();

        await first.run!();
        expect(stream).toHaveBeenCalledTimes(1);
        const params = stream.mock.calls[0][0];
        expect(params).toMatchObject({ model: 'claude-opus-5', fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] });

        const cached = await getCachedTranslation(item, 'es');
        // Options the ballot does not have are dropped.
        expect(cached?.options).toEqual([{ id: 0, label: 'Aprobar' }, { id: 1, label: 'Rechazar' }]);
        expect((await requestTranslation(item, 'es')).state).toMatchObject({ status: 'ready' });
        expect(stream).toHaveBeenCalledTimes(1);
    });

    it('stores nothing when the model declines, and releases the lock', async () => {
        finalMessage.mockResolvedValue({ stop_reason: 'refusal', stop_details: { category: null }, content: [] });
        const { run } = await requestTranslation(item, 'es');
        await run!();
        expect(await getCachedTranslation(item, 'es')).toBeNull();
        expect((await requestTranslation(item, 'es')).run).toBeDefined();
    });

    it('is unavailable without an API key', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        expect((await requestTranslation(item, 'es')).state).toEqual({ status: 'unavailable' });
    });
});
