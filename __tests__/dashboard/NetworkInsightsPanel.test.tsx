import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NetworkInsightsPanel } from '@/features/dashboard/components/NetworkInsightsPanel';
import { apiFetchNetworkUnstaking, type NetworkUnstakingData } from '@/features/dashboard/services/apiClient';

vi.mock('@/features/dashboard/services/apiClient', () => ({ apiFetchNetworkUnstaking: vi.fn() }));

const HOUR = 3_600_000;
const now = Date.UTC(2026, 9, 21, 12);
const fetchMock = vi.mocked(apiFetchNetworkUnstaking);

const data = (over: Partial<NetworkUnstakingData>): NetworkUnstakingData => ({
    pending: 0, unbonding: null, validators: 289, updatedAt: now, samples: [], days: [], ...over,
});

const renderPanel = (open = true) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NetworkInsightsPanel network="mainnet" totalStaked={1_000_000_000} open={open} locale="en" />
    </QueryClientProvider>,
);

describe('NetworkInsightsPanel', () => {
    beforeEach(() => { fetchMock.mockReset(); });

    it('does not ask for anything while folded', () => {
        renderPanel(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('separates what is still unlocking from what is unlocked and unclaimed', async () => {
        fetchMock.mockResolvedValue(data({ pending: 100_000_000, unbonding: 25_000_000, samples: [[now, 100_000_000, 25_000_000]] }));
        renderPanel();
        expect(await screen.findByText(/≈ 25\.0M XRD/)).toBeInTheDocument(); // unlocking now
        expect(screen.getByText(/≈ 75\.0M XRD/)).toBeInTheDocument(); // unlocked, not claimed
        expect(screen.getByText(/^100\.0M XRD$/)).toBeInTheDocument(); // in the vaults
        expect(screen.getByText('2.50%')).toBeInTheDocument(); // of the stake
    });

    it('does not guess the split when the history is missing', async () => {
        fetchMock.mockResolvedValue(data({ pending: 100_000_000, unbonding: null }));
        renderPanel();
        expect(await screen.findByText(/^100\.0M XRD$/)).toBeInTheDocument();
        expect(screen.queryByText(/^≈ \d/)).not.toBeInTheDocument();
    });

    it('says the history is still being collected until it spans the period', async () => {
        fetchMock.mockResolvedValue(data({ pending: 1000, unbonding: 900, samples: [[now - 2 * HOUR, 900, 800], [now, 1000, 900]] }));
        renderPanel();
        await screen.findByText(/≈ 900 XRD/);
        expect(screen.getAllByText('Collecting history')).toHaveLength(2);
    });

    it('shows the change in the unlocking figure over 24 h and 7 days once there is history', async () => {
        const samples: [number, number, number | null][] = [
            [now - 7 * 24 * HOUR, 9e6, 1_000_000], [now - 24 * HOUR, 9e6, 1_500_000], [now, 9e6, 2_000_000],
        ];
        fetchMock.mockResolvedValue(data({ pending: 9e6, unbonding: 2_000_000, samples }));
        renderPanel();
        expect(await screen.findByText(/\+500\.0K XRD/)).toBeInTheDocument(); // 24 h
        expect(screen.getByText(/\+1\.0M XRD/)).toBeInTheDocument(); // 7 d
    });

    it('says so when the figure cannot be read', async () => {
        fetchMock.mockRejectedValue(new Error('API error: 503'));
        renderPanel();
        expect(await screen.findByText(/not available right now/i)).toBeInTheDocument();
    });
});
