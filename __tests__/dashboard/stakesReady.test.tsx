/**
 * "The wallet's stakes have been read" must not be answered by vacuity.
 *
 * The grid waits for this before adopting a new ledger, because it decides
 * which cards go first. The accounts it reads them for are seeded by the server
 * PER LEDGER, from the session cookie, so a switch has a window with none in
 * hand — and `[].every(...)` is true, which answered "ready, nothing to wait
 * for". The grid committed with nothing pinned and the wallet's own validators
 * arrived a moment later and reordered it. Whether that window is open at all
 * depends on when the navigation lands, which is why it came and went.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/dashboard/services/apiClient', () => ({
    apiFetchEntityDetails: vi.fn(() => new Promise(() => { /* never settles */ })),
}));

import { useStakesReady } from '@/features/dashboard/staking/hooks/useStakesReady';

function Probe({ addresses, expectsAccounts }: { addresses: string[]; expectsAccounts: boolean }) {
    const ready = useStakesReady(addresses, 'mainnet', expectsAccounts);
    return <span data-testid="ready">{String(ready)}</span>;
}

function renderProbe(addresses: string[], expectsAccounts: boolean) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <Probe addresses={addresses} expectsAccounts={expectsAccounts} />
        </QueryClientProvider>,
    );
    return screen.getByTestId('ready').textContent;
}

describe('knowing whether the wallet\'s stakes have been read', () => {
    it('is not ready when a session exists but its accounts are not in hand', () => {
        expect(renderProbe([], true)).toBe('false');
    });

    it('is ready when there is genuinely no wallet on this ledger', () => {
        expect(renderProbe([], false)).toBe('true');
    });

    it('is not ready while the accounts it has are still being read', () => {
        expect(renderProbe(['account_rdx_1'], true)).toBe('false');
    });
});
