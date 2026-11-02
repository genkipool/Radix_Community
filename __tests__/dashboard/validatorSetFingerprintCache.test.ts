import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** The live fingerprint is read from Redis once per instance per TTL, never kept longer than Redis keeps it. */
const store = new Map<string, string>();
const gets: string[] = [];
const redis = {
    async get(key: string) {
        gets.push(key);
        return store.get(key) ?? null;
    },
    async set(key: string, value: string) {
        store.set(key, value);
        return 'OK';
    },
};
vi.mock('@/lib/redis', () => ({ getRedis: () => redis }));
const fetchList = vi.fn(async () => [{ address: 'validator_rdx1a' }]);
vi.mock('@/services/gateway/validatorList', () => ({ fetchValidatorListRest: () => fetchList() }));

describe('live validator-set fingerprint cache', () => {
    beforeEach(async () => {
        store.clear();
        gets.length = 0;
        fetchList.mockClear();
        (await import('@/services/gateway/validatorSetFingerprint')).forgetHeldFingerprints();
    });
    afterEach(() => vi.useRealTimers());

    it('stores its expiry with it and answers from memory until then', async () => {
        vi.useFakeTimers({ now: 1_800_000_000_000 });
        const { fetchLiveValidatorSetFingerprint, FINGERPRINT_TTL_S } = await import('@/services/gateway/validatorSetFingerprint');

        const first = await fetchLiveValidatorSetFingerprint('mainnet');
        expect(first).toMatch(/^[0-9a-f]{16}$/);
        expect(store.get('validators_fingerprint_mainnet')).toBe(`${first}@${Date.now() + FINGERPRINT_TTL_S * 1000}`);

        gets.length = 0;
        expect(await fetchLiveValidatorSetFingerprint('mainnet')).toBe(first);
        expect(gets).toHaveLength(0);

        vi.advanceTimersByTime(FINGERPRINT_TTL_S * 1000);
        store.clear(); // Redis let it expire too
        await fetchLiveValidatorSetFingerprint('mainnet');
        expect(gets).toHaveLength(1);
        expect(fetchList).toHaveBeenCalledTimes(2);
    });

    it('takes another instance\'s value from Redis, and an old value without expiry as it is', async () => {
        const { fetchLiveValidatorSetFingerprint } = await import('@/services/gateway/validatorSetFingerprint');
        store.set('validators_fingerprint_mainnet', `abcdef0123456789@${Date.now() + 20_000}`);
        expect(await fetchLiveValidatorSetFingerprint('mainnet')).toBe('abcdef0123456789');

        const mod = await import('@/services/gateway/validatorSetFingerprint');
        mod.forgetHeldFingerprints();
        store.set('validators_fingerprint_mainnet', '0123456789abcdef');
        expect(await fetchLiveValidatorSetFingerprint('mainnet')).toBe('0123456789abcdef');
        expect(fetchList).not.toHaveBeenCalled();
    });
});
