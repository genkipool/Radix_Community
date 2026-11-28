import { describe, expect, it, vi } from 'vitest';
import {
    checkedStateVersion,
    decimalsAgree,
    followCursor,
    isAccountAddress,
    MAX_PAGES,
    requireAll,
    requireIds,
    sumDecimals,
    withDeadline,
    withMissingAccounts,
} from '@/features/governance/lib/votePowerChecks';
import { withRetry } from '@/services/gateway/client';

const AT = '2026-01-10T12:00:00.000Z';

describe('state version at a snapshot', () => {
    it('accepts a state at or just before the requested time', () => {
        expect(checkedStateVersion(AT, { state_version: 500, proposer_round_timestamp: '2026-01-10T11:59:59.900Z' })).toBe(500);
        expect(checkedStateVersion(AT, { state_version: 501, proposer_round_timestamp: '2026-01-10T11:59:10.000Z' })).toBe(501);
    });

    it('rejects a lagging Gateway tip, a pre-genesis state and malformed replies', () => {
        expect(() => checkedStateVersion(AT, { state_version: 500, proposer_round_timestamp: '2026-01-10T11:58:59.000Z' })).toThrow(/lags/);
        expect(() => checkedStateVersion(AT, { state_version: 1, proposer_round_timestamp: '1970-01-01T00:00:00Z' })).toThrow(/genesis/);
        expect(() => checkedStateVersion(AT, { proposer_round_timestamp: AT })).toThrow(/state version/);
        expect(() => checkedStateVersion(AT, { state_version: 500 })).toThrow(/timestamp/);
        expect(() => checkedStateVersion(AT, undefined)).toThrow();
    });
});

describe('partial responses', () => {
    it('requires every requested address', () => {
        const items = [{ address: 'entity_a' }, { address: 'entity_b' }];
        expect(requireAll(['entity_a', 'entity_b'], items, 'pool')).toHaveLength(2);
        expect(() => requireAll(['entity_a', 'entity_b', 'entity_c'], items, 'pool')).toThrow(/1 of 3/);
        // An empty but present entity is fine: zero comes from its balances, not from its absence.
        expect(requireAll(['entity_a'], [{ address: 'entity_a', fungible_resources: { items: [] } }], 'account')).toHaveLength(1);
    });

    it('requires data for every requested non-fungible', () => {
        expect(() => requireIds(['#1#', '#2#'], [{ non_fungible_id: '#1#' }, { non_fungible_id: '#2#' }])).not.toThrow();
        expect(() => requireIds(['#1#', '#2#'], [{ non_fungible_id: '#1#' }])).toThrow(/1 of 2/);
    });
});

describe('accounts missing at the snapshot version', () => {
    it('asks again for each missing account alone and treats a second miss as empty', async () => {
        const single = vi.fn(async (address: string) => (address === 'account_late_reply' ? [{ address, n: 2 }] : []));
        const { items, absent } = await withMissingAccounts(
            ['account_a', 'account_late_reply', 'account_created_later'],
            [{ address: 'account_a', n: 1 }],
            single,
        );
        expect(items).toEqual([{ address: 'account_a', n: 1 }, { address: 'account_late_reply', n: 2 }]);
        expect(absent).toEqual(['account_created_later']);
        expect(single.mock.calls.map(c => c[0])).toEqual(['account_late_reply', 'account_created_later']);
    });

    it('lets an error from the lone query through', async () => {
        await expect(withMissingAccounts(['account_a'], [], async () => { throw new Error('Gateway 503'); })).rejects.toThrow('Gateway 503');
    });
});

describe('cancellation of retries', () => {
    it('does not retry once the caller aborted, and ends a backoff wait at once', async () => {
        const controller = new AbortController();
        const reason = new Error('over budget');
        const fn = vi.fn(async () => {
            controller.abort(reason);
            throw Object.assign(new Error('Gateway 503'), { status: 503 });
        });
        await expect(withRetry(fn, 4, 0, controller.signal)).rejects.toBe(reason);
        expect(fn).toHaveBeenCalledTimes(1);

        const late = new AbortController();
        const failing = vi.fn(async () => { throw Object.assign(new Error('Gateway 503'), { status: 503 }); });
        const started = Date.now();
        const run = withRetry(failing, 4, 0, late.signal);
        setTimeout(() => late.abort(reason), 50);
        await expect(run).rejects.toBe(reason);
        expect(failing).toHaveBeenCalledTimes(1);
        expect(Date.now() - started).toBeLessThan(350);
    });

    it('still retries transient errors without a signal', async () => {
        let calls = 0;
        const fn = vi.fn(async () => {
            if (++calls === 1) throw Object.assign(new Error('Gateway 503'), { status: 503 });
            return 'ok';
        });
        await expect(withRetry(fn, 2)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('pagination', () => {
    it('follows the cursor to the end', async () => {
        const next = vi.fn(async (cursor: string) => (cursor === 'c1' ? { items: [2], next_cursor: 'c2' } : { items: [3], next_cursor: null }));
        expect(await followCursor({ items: [1], cursor: 'c1' }, next)).toEqual([1, 2, 3]);
        expect(next).toHaveBeenCalledTimes(2);
        expect(await followCursor({ items: [1], cursor: null }, next)).toEqual([1]);
    });

    it('gives up after the page cap instead of looping', async () => {
        const next = vi.fn(async () => ({ items: [0], next_cursor: 'again' }));
        await expect(followCursor({ items: [], cursor: 'start' }, next)).rejects.toThrow(`More than ${MAX_PAGES} pages`);
        expect(next).toHaveBeenCalledTimes(MAX_PAGES);
    });
});

describe('reconciliation and eligibility', () => {
    it('sums and compares exact decimals', () => {
        expect(sumDecimals(['0.1', '0.2', '1e-30'])).toBe('0.300000000000000000000000000001');
        expect(decimalsAgree('573986028.910115926492805810412747', '573986028.9101159264928058104127472754849926716616')).toBe(true);
        expect(decimalsAgree('100', '100.000000001')).toBe(true);
        expect(decimalsAgree('100', '100.00000001')).toBe(false);
        expect(decimalsAgree('100', 'not a number')).toBe(false);
    });

    it('computes snapshot power for accounts of the network only', () => {
        expect(isAccountAddress('mainnet', 'account_rdx1_placeholder')).toBe(true);
        expect(isAccountAddress('mainnet', 'component_rdx1_placeholder')).toBe(false);
        expect(isAccountAddress('mainnet', 'account_tdx_2_1_placeholder')).toBe(false);
        expect(isAccountAddress('stokenet', 'account_tdx_2_1_placeholder')).toBe(true);
    });

    it('rejects work that outlives its budget', async () => {
        vi.useFakeTimers();
        const slow = new Promise<string>(resolve => setTimeout(() => resolve('late'), 20_000));
        const onDeadline = vi.fn();
        const raced = withDeadline(slow, 12_000, onDeadline);
        const assertion = expect(raced).rejects.toThrow(/12000 ms/);
        await vi.advanceTimersByTimeAsync(12_000);
        await assertion;
        expect(onDeadline).toHaveBeenCalledTimes(1);
        await expect(withDeadline(Promise.resolve('ok'), 12_000)).resolves.toBe('ok');
        vi.useRealTimers();
    });
});
