import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SwapSettlementCard } from '@/features/dashboard/explorador/components/SwapSettlementCard';
import { BalanceChangeRow } from '@/features/dashboard/explorador/components/BalanceChangeRow';
import { buildSwapRoutingChart } from '@/features/dashboard/explorador/utils/transactionUtils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('@/features/dashboard/explorador/components/MermaidDiagram', () => ({
    MermaidDiagram: () => <div data-testid="mermaid-mock" />
}));

// Mock translations
const mockTt = {
    swap_received_label: 'Token Received',
    swap_sold_label: 'Token Sold',
    account_summary: {
        contributed_tokens_share: 'Your position in',
        contributed_tokens_concept: 'Concepto',
        contributed_tokens_value: 'Valor',
        pool_address: 'Pool Address',
        contributed_tokens_lp_units: 'LP units you own',
        contributed_tokens_total_supply: 'Total supply LP',
        contributed_tokens_pool_share: 'Share',
        contributed_tokens_entitlement: '{symbol} que te corresponde'
    }
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

describe('Theme Standardization Colors', () => {
    it('SwapSettlementCard uses --color-accent for received tokens', () => {
        const mockProps = {
            soldToken: { resource: 'resource_sold', amount: '100' },
            receivedToken: { resource: 'resource_received', amount: '90' },
            dexComponent: 'component_dex',
            initiatorAddress: 'account_1',
            routingHops: [],
            balanceChanges: {
                fungible_fee_balance_changes: [],
                fungible_balance_changes: [
                    { entity_address: 'account_1', resource_address: 'resource_received', balance_change: '90' }
                ]
            } as any,
            initiators: new Set(['account_1']),
            details: {
                receipt: { status: 'Succeeded' },
                balance_changes: {
                    fungible_fee_balance_changes: [],
                    fungible_balance_changes: [
                        { entity_address: 'account_1', resource_address: 'resource_received', balance_change: '90' }
                    ]
                }
            } as any,
            tx: { feePaid: '1' } as any,
            tt: mockTt as any,
            onCopy: () => { },
            copiedAddress: null,
            network: 'mainnet' as const,
            locale: 'en-US'
        };

        render(
            <QueryClientProvider client={queryClient}>
                <SwapSettlementCard {...mockProps} />
            </QueryClientProvider>
        );

        // Check if the received token label has the accent color class
        const receivedLabels = screen.getAllByText('Token Received');
        // The one in the flow should have the accent color
        const flowLabel = receivedLabels.find(el => el.className.includes('text-[var(--color-accent)]'));
        expect(flowLabel).toBeDefined();

        // Check if the amount in the details mini-table has the accent color class
        const amounts = screen.getAllByText((content, element) => {
            return element?.tagName.toLowerCase() === 'span' && content.includes('+90');
        });
        expect(amounts.length).toBeGreaterThan(0);
        amounts.forEach(el => {
            expect(el.className).toContain('text-[var(--color-accent)]');
        });

        // Verify that the Mermaid chart doesn't use CSS variables in linkStyle (Mermaid parser limitation)
        // We can find the chart string passed to buildSwapRoutingChart if we were mocking the util,
        // but here we can just check if any text in the DOM contains linkStyle with var(
        // Actually, since MermaidDiagram is mocked, we can check the 'chart' prop passed to it
        // but we need to capture it.
    });

    it('Mermaid chart does not contain var() in linkStyle', () => {
        const chart = buildSwapRoutingChart([], [], [], new Map(), new Map(), new Map(), {}, 10, {}, 'payer');

        // linkStyle should not contain var(
        const linkStyles = chart.split('\n').filter((l: string) => l.includes('linkStyle'));
        linkStyles.forEach((l: string) => {
            expect(l).not.toContain('var(');
        });
    });

    it('BalanceChangeRow uses --color-accent for positive balances', () => {
        const mockChange = {
            entity_address: 'account_1',
            resource_address: 'resource_1',
            balance_change: '10',
            type: 'Deposit'
        } as any;

        render(
            <QueryClientProvider client={queryClient}>
                <BalanceChangeRow
                    change={mockChange}
                    tt={mockTt as any}
                    onCopy={() => { }}
                    copiedAddress={null}
                    network="mainnet"
                    locale="en-US"
                />
            </QueryClientProvider>
        );

        const amount = screen.getByText('+10');
        // The color class is on the grand-parent div (the one with font-mono font-bold lg:text-lg)
        expect(amount.parentElement?.parentElement?.className).toContain('text-[var(--color-accent)]');
    });
});
