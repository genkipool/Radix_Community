import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransactionCard } from '@/features/dashboard/explorador/components/TransactionCard';
import { type TransactionInfo } from '@/types/radix';
import { type TransactionCardProps } from '@/features/dashboard/explorador/types/components.types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/context/LanguageContext';
import { en } from '@/i18n/locales/en';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    ArrowRight: () => <div data-testid="arrow-right" />,
    ChevronDown: () => <div data-testid="chevron-down" />,
    Clock: () => <div data-testid="clock" />,
    Hash: () => <div data-testid="hash" />,
    ExternalLink: () => <div data-testid="external-link" />,
    AlertCircle: () => <div data-testid="alert-circle" />,
    Copy: () => <div data-testid="copy" />,
    Coins: () => <div data-testid="coins" />,
    Box: () => <div data-testid="box" />,
    Users: () => <div data-testid="users" />,
    Mail: () => <div data-testid="mail" />,
    Check: () => <div data-testid="check" />,
    Landmark: () => <div data-testid="landmark" />,
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
});
