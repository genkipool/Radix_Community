import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransactionCard } from '@/features/dashboard/explorador/components/TransactionCard';
import { type TransactionInfo } from '@/types/radix';
import { type TransactionCardProps } from '@/features/dashboard/explorador/types/components.types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/context/LanguageContext';
import { translations } from '@/i18n';
const en = translations.en;

// Mock Lucide icons
// Partial: the icons below are stubbed, any other comes from the real module.
vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
    ArrowRight: () => <div data-testid="arrow-right" />,
    ChevronDown: () => <div data-testid="chevron-down" />,
    Clock: () => <div data-testid="clock" />,
    Hash: () => <div data-testid="hash" />,
    ExternalLink: () => <div data-testid="external-link" />,
    AlertCircle: () => <div data-testid="alert-circle" />,
    Copy: () => <div data-testid="copy" />,
    Download: () => <div data-testid="download" />,
    Coins: () => <div data-testid="coins" />,
    Box: () => <div data-testid="box" />,
    Users: () => <div data-testid="users" />,
    Mail: () => <div data-testid="mail" />,
    Check: () => <div data-testid="check" />,
    Landmark: () => <div data-testid="landmark" />,
    ArrowUpRight: () => <div data-testid="arrow-up-right" />,
    XCircle: () => <div data-testid="x-circle" />,
    AlertTriangle: () => <div data-testid="alert-triangle" />,
    BadgeCheck: () => <div data-testid="badge-check" />,
    Vote: () => <div data-testid="vote" />,
    ThumbsUp: () => <div data-testid="thumbs-\1p" />,
    ThumbsDown: () => <div data-testid="thumbs-\1own" />,
    CircleDot: () => <div data-testid="circle-\1ot" />,
    CheckCircle2: () => <div data-testid="check-\1ircle-\1" />,
    Circle: () => <div data-testid="circle" />,
    UserRound: () => <div data-testid="user-\1ound" />,
    Target: () => <div data-testid="target" />,
    PenLine: () => <div data-testid="pen-\1ine" />,
    CalendarClock: () => <div data-testid="calendar-\1lock" />,
    RefreshCw: () => <div data-testid="refresh-\1w" />,
    Info: () => <div data-testid="info" />,
}));

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
});

describe('Complex Transactions UI', () => {
    const mockTx = (id: string, manifestClasses: string[]): TransactionInfo => ({
        intentHash: id,
        status: 'CommittedSuccess',
        feePaid: 0.1,
        confirmedAt: new Date(),
        stateVersion: 1,
        epoch: 123,
        round: 456,
        accountsCount: 2,
        componentsCount: 1,
        hasNfts: false,
        manifestClasses,
    });

    const baseProps: Partial<TransactionCardProps> = {
        isExpanded: false,
        onExpand: vi.fn(),
        onCopy: vi.fn(),
        copiedAddress: null,
        columns: 1,
        t: en,
        network: 'mainnet',
    };

    it('identifies and displays a Staking transaction', () => {
        const tx = mockTx('tx_stake', ['ValidatorStake']);
        render(
            <QueryClientProvider client={queryClient}>
                <LanguageProvider language="en" dictionary={en}>
                    <TransactionCard {...(baseProps as TransactionCardProps)} tx={tx} />
                </LanguageProvider>
            </QueryClientProvider>
        );
        expect(screen.getByText('Stake')).toBeInTheDocument();
    });

    it('identifies and displays an Unstaking transaction', () => {
        const tx = mockTx('tx_unstake', ['ValidatorUnstake']);
        render(
            <QueryClientProvider client={queryClient}>
                <LanguageProvider language="en" dictionary={en}>
                    <TransactionCard {...(baseProps as TransactionCardProps)} tx={tx} />
                </LanguageProvider>
            </QueryClientProvider>
        );
        expect(screen.getByText('Unstake')).toBeInTheDocument();
    });

    it('identifies and displays a Claim transaction', () => {
        const tx = mockTx('tx_claim', ['ValidatorClaim']);
        render(
            <QueryClientProvider client={queryClient}>
                <LanguageProvider language="en" dictionary={en}>
                    <TransactionCard {...(baseProps as TransactionCardProps)} tx={tx} />
                </LanguageProvider>
            </QueryClientProvider>
        );
        expect(screen.getByText('Claim')).toBeInTheDocument();
    });

    describe('amount column of stake operations', () => {
        const renderTx = (tx: TransactionInfo) => render(
            <QueryClientProvider client={queryClient}>
                <LanguageProvider language="en" dictionary={en}>
                    <TransactionCard {...(baseProps as TransactionCardProps)} tx={tx} />
                </LanguageProvider>
            </QueryClientProvider>
        );

        it('shows the XRD staked instead of the fee', () => {
            const tx = { ...mockTx('tx_stake_amount', ['ValidatorStake']), feePaid: 0.1234, validatorOps: [{ validatorAddress: 'validator_rdx1a', stakeXrd: 1500 }] };
            renderTx(tx);
            expect(screen.getByText(/1[,.]?500 XRD/)).toBeInTheDocument();
            expect(screen.queryByText(/Fee Paid/i)).not.toBeInTheDocument();
        });

        it('shows the XRD an unstake will release, summed over validators', () => {
            const tx = {
                ...mockTx('tx_unstake_amount', ['ValidatorUnstake']),
                validatorOps: [
                    { validatorAddress: 'validator_rdx1a', unstakeLsu: 90, unstakeXrdExpected: 100 },
                    { validatorAddress: 'validator_rdx1b', unstakeLsu: 45, unstakeXrdExpected: 50 },
                ],
            };
            renderTx(tx);
            expect(screen.getByText(/150 XRD/)).toBeInTheDocument();
        });

        it('shows the claimed XRD', () => {
            const tx = { ...mockTx('tx_claim_amount', ['ValidatorClaim']), validatorOps: [{ validatorAddress: 'validator_rdx1a', claimXrd: 42 }] };
            renderTx(tx);
            expect(screen.getByText(/42 XRD/)).toBeInTheDocument();
        });

        it('keeps the fee when the transaction has no stake operations', () => {
            renderTx({ ...mockTx('tx_plain', ['General']), feePaid: 0.5 });
            expect(screen.getByText(/Fee Paid/i)).toBeInTheDocument();
        });
    });
});
