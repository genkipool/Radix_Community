import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/context/LanguageContext';
import { translations } from '@/i18n';
import { NetworkInsightsPanel } from '@/features/dashboard/components/NetworkInsightsPanel';
import { apiFetchNetworkUnstaking, type NetworkUnstakingData } from '@/features/dashboard/services/apiClient';

vi.mock('@/features/dashboard/services/apiClient', () => ({ apiFetchNetworkUnstaking: vi.fn() }));
// The account's own card is the explorer's; here it only has to be opened with the right address.
vi.mock('@/features/dashboard/explorador/components/entityCards', () => ({
    EntityCard: (props: { address: string; isExpanded: boolean }) => <div data-testid="account-card" data-expanded={String(props.isExpanded)}>{props.address}</div>,
}));

const fetchMock = vi.mocked(apiFetchNetworkUnstaking);

const schedule = (values: number[]) =>
    values.map((xrd, i) => ({ date: new Date(Date.UTC(2026, 9, 21 + i)).toISOString().slice(0, 10), xrd }));

const data = (over: Partial<NetworkUnstakingData> = {}): NetworkUnstakingData => ({
    pending: 100_000_000,
    unbonding: 25_000_000,
    unbonding24hAgo: 20_000_000,
    unbonding7dAgo: 30_000_000,
    schedule: schedule([0, 5e6, 10e6, 0, 2e6, 3e6, 4e6, 1e6]),
    accounts: [],
    unattributedXrd: 0,
    validators: 289,
    updatedAt: Date.UTC(2026, 9, 21, 12),
    ...over,
});

const renderPanel = (open = true) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LanguageProvider language="en" dictionary={translations.en}>
            <NetworkInsightsPanel network="mainnet" totalStaked={1_000_000_000} open={open} locale="en" onCopy={vi.fn()} copiedAddress={null} />
        </LanguageProvider>
    </QueryClientProvider>,
);

describe('NetworkInsightsPanel', () => {
    beforeEach(() => { fetchMock.mockReset(); });

    it('does not ask for anything while folded', () => {
        renderPanel(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('separates what is still locked from what is unlocked and unclaimed', async () => {
        fetchMock.mockResolvedValue(data());
        renderPanel();
        expect(await screen.findByText('25.0M XRD')).toBeInTheDocument(); // unlocking now
        expect(screen.getByText('75.0M XRD')).toBeInTheDocument(); // unlocked, not claimed
        expect(screen.getByText('100.0M XRD')).toBeInTheDocument(); // in the vaults
        expect(screen.getByText('2.50%')).toBeInTheDocument(); // of the stake
    });

    it('shows how the locked figure moved over 24 h and 7 days', async () => {
        fetchMock.mockResolvedValue(data());
        renderPanel();
        expect(await screen.findByText(/\+5\.0M XRD/)).toBeInTheDocument(); // 25M vs 20M a day ago
        expect(screen.getByText(/−5\.0M XRD/)).toBeInTheDocument(); // 25M vs 30M a week ago
    });

    it('shows zeros as zeros, not as missing', async () => {
        fetchMock.mockResolvedValue(data({ pending: 0, unbonding: 0, unbonding24hAgo: 0, unbonding7dAgo: 1, schedule: schedule([0, 0, 0, 0, 0, 0, 0, 0]) }));
        renderPanel();
        expect((await screen.findAllByText('0 XRD')).length).toBeGreaterThanOrEqual(3);
        expect(screen.queryByText('---')).not.toBeInTheDocument();
    });

    it('waits, instead of showing the vaults as the wave, while the ledger is still being read', async () => {
        fetchMock.mockResolvedValue(data({ unbonding: null, unbonding24hAgo: null, unbonding7dAgo: null, schedule: [] }));
        renderPanel();
        expect(await screen.findByText('100.0M XRD')).toBeInTheDocument(); // the vaults are known
        expect(screen.queryByText('25.0M XRD')).not.toBeInTheDocument();
        expect(screen.queryByText(/unlock calendar/i)).not.toBeInTheDocument();
    });

    it('says so when the figures cannot be read', async () => {
        fetchMock.mockRejectedValue(new Error('API error: 503'));
        renderPanel();
        expect(await screen.findByText(/not available right now/i)).toBeInTheDocument();
    });
});

describe('UnlockCalendar', () => {
    beforeEach(() => { fetchMock.mockReset(); });

    it('labels only the largest day and gives every day its own value to the table twin', async () => {
        fetchMock.mockResolvedValue(data());
        renderPanel();
        await screen.findByText(/unlock calendar/i);
        // The peak (10M) is the one value written on the chart.
        expect(screen.getAllByText('10.0M').length).toBeGreaterThanOrEqual(1);

        fireEvent.click(screen.getByRole('button', { name: /table/i }));
        const table = screen.getByRole('table');
        expect(within(table).getAllByRole('row')).toHaveLength(1 + 8 + 1); // header + days + total
        expect(within(table).getByText('25,000,000')).toBeInTheDocument(); // total
    });

    it('shows a day\'s value in a tooltip on hover and on focus', async () => {
        fetchMock.mockResolvedValue(data());
        renderPanel();
        await screen.findByText(/unlock calendar/i);
        const column = screen.getByLabelText(/October 23.*10,000,000 XRD/);
        fireEvent.focus(column);
        expect(await screen.findAllByText('10,000,000 XRD')).not.toHaveLength(0);
    });
});

describe('UnlockAccountsTable', () => {
    beforeEach(() => { fetchMock.mockReset(); });

    const account = (n: number, xrd: number) => ({
        address: `account_rdx1acc${String(n).padStart(2, '0')}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
        xrd,
        unstakes: 1 + (n % 3),
        validators: ['validator_rdx1aaaaaaaaaaaaaaaaaaaa', 'validator_rdx1bbbbbbbbbbbbbbbbbbbb'],
        nextUnlock: Date.UTC(2026, 9, 24, 9, 30),
        lastUnstake: Date.UTC(2026, 9, 20, 9, 30),
    });

    it('lists each account with its XRD and its share of the wave, the biggest first', async () => {
        fetchMock.mockResolvedValue(data({ unbonding: 25_000_000, accounts: [account(1, 20_000_000), account(2, 5_000_000)], unattributedXrd: 0 }));
        renderPanel();
        const rows = await screen.findAllByRole('row');
        // header + 2 accounts
        expect(rows).toHaveLength(3);
        expect(within(rows[1]).getByText('20.0M XRD')).toBeInTheDocument();
        expect(within(rows[1]).getByText('80%')).toBeInTheDocument();
        expect(within(rows[2]).getByText('20%')).toBeInTheDocument();
    });

    it('opens an account into its own full card, and only then', async () => {
        fetchMock.mockResolvedValue(data({ unbonding: 10, accounts: [account(1, 10)] }));
        renderPanel();
        await screen.findAllByRole('row');
        expect(screen.queryByTestId('account-card')).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('row')[1]);
        const card = await screen.findByTestId('account-card');
        expect(card).toHaveTextContent('account_rdx1acc01');
        expect(card).toHaveAttribute('data-expanded', 'true');

        fireEvent.click(screen.getAllByRole('row')[1]);
        expect(screen.queryByTestId('account-card')).not.toBeInTheDocument();
    });

    it('shows ten rows first and the rest on request, and says what could not be attributed', async () => {
        const accounts = Array.from({ length: 30 }, (_, i) => account(i + 1, 1000 - i));
        fetchMock.mockResolvedValue(data({ unbonding: 30_000, accounts, unattributedXrd: 1_500 }));
        renderPanel();
        await screen.findAllByRole('row');
        expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
        expect(screen.getByText(/Account not identified: 1\.5K XRD/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /show more/i }));
        expect(screen.getAllByRole('row')).toHaveLength(1 + 30);
        expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
    });

    it('has no table while nobody is identified', async () => {
        fetchMock.mockResolvedValue(data({ accounts: [] }));
        renderPanel();
        await screen.findByText('25.0M XRD');
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});
