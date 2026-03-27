import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FeesDistributionSection } from '@/features/dashboard/explorador/components/FeesDistributionSection';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FeesDistributionSectionProps } from '@/features/dashboard/explorador/types';
import type { TransactionDetails } from '@/features/dashboard/types';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Check: () => <div data-testid="icon-check" />,
  Copy: () => <div data-testid="icon-copy" />,
  ChevronDown: () => <div data-testid="icon-chevron" />,
  ExternalLink: () => <div data-testid="icon-external" />,
  Coins: () => <div data-testid="icon-coins" />,
}));
vi.mock('@/features/dashboard/explorador/components/TransactionIcons', () => ({
    IconFlame: () => <div data-testid="icon-flame" />,
    IconMedal: () => <div data-testid="icon-medal" />,
    IconBolt: () => <div data-testid="icon-bolt" />,
    IconGem: () => <div data-testid="icon-gem" />,
    IconTip: () => <div data-testid="icon-tip" />,
}));

const queryClient = new QueryClient();

const mockProps = {
    tx: { feePaid: '3.0', epoch: 10, round: 50 },
    tt: {
        fees_distribution: 'Fees Distributed',
        fees_from_label: 'Fees Paid',
        fees_breakdown: 'Breakdown',
        fees_burn: 'Burn',
        fees_proposer: 'Proposer',
        fees_validator_set: 'Validator Set',
    },
    onCopy: vi.fn(),
    copiedAddress: null,
    onResourceClick: vi.fn(),
    readingMode: false,
    network: 'mainnet' as const,
    columns: 2,
};

describe('FeesDistributionSection', () => {
    it('returns null if there are no fee payers or consensus manager fees', () => {
        const details = {
            receipt: { fee_destination: null, fee_summary: null },
            balance_changes: { fungible_fee_balance_changes: [] },
        };
        const { container } = render(
            <QueryClientProvider client={queryClient}>
                <FeesDistributionSection {...mockProps as unknown as FeesDistributionSectionProps} details={details as unknown as TransactionDetails} />
            </QueryClientProvider>
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders with explicit fee_destination data', () => {
        const details = {
            receipt: {
                fee_destination: {
                    to_burn: { xrd_amount: '0.5' },
                    to_proposer: { xrd_amount: '0.25' },
                    to_validator_set: { xrd_amount: '0.25', shares: [] },
                },
                fee_summary: { xrd_total_execution_cost: '0.8', xrd_total_storage_cost: '0.2' },
            },
            balance_changes: { 
                fungible_fee_balance_changes: [
                    { entity_address: 'account_rdx12v6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6', balance_change: '-1.0' }
                ] 
            },
        };
        render(
            <QueryClientProvider client={queryClient}>
                <FeesDistributionSection {...mockProps as unknown as FeesDistributionSectionProps} details={details as unknown as TransactionDetails} />
            </QueryClientProvider>
        );

        expect(screen.getByText('Fees Distributed')).toBeInTheDocument();
        expect(screen.getByText('Breakdown')).toBeInTheDocument();
        
        // Assert the exact parsed strings
        // Burn is 0.5000 -> 0.5
        expect(screen.getByText('0.5 XRD')).toBeInTheDocument();
        // Proposer/Validator is 0.25
        expect(screen.getAllByText('0.25 XRD')).toHaveLength(2);
    });

    it('falls back to splitting cmAmount if fee_destination is missing (stokenet fallback test)', () => {
        // In this case, cmAmount is 2.0 (Burn gets 2.0, Validator gets 1.0, Proposer gets 1.0)
        // because the formula is finalBurn=cmAmount, finalValidator=cmAmount/2, finalProposer=cmAmount/2
        const details = {
            receipt: {
                fee_destination: null,
                fee_summary: null,
            },
            balance_changes: { 
                fungible_fee_balance_changes: [
                    { entity_address: 'consensusmanager_rdx1scxxxxxxxxxxcnsmgrxxxxxxxxx000999993157', balance_change: '2.0' }
                ] 
            },
        };
        render(
            <QueryClientProvider client={queryClient}>
                <FeesDistributionSection {...mockProps as unknown as FeesDistributionSectionProps} details={details as unknown as TransactionDetails} />
            </QueryClientProvider>
        );

        expect(screen.getByText('Fees Distributed')).toBeInTheDocument();
        expect(screen.getByText('2 XRD')).toBeInTheDocument(); // Burn (cmAmount)
        expect(screen.getAllByText('1 XRD')).toHaveLength(2); // Proposer/Validator
    });
});
