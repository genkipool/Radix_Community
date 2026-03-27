import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EntitiesSection } from '@/features/dashboard/explorador/components/EntitiesSection';
import type { TransactionDetails, TranslationsT } from '@/features/dashboard/types';

// Mock the hook and component that fetch data
vi.mock('@/features/dashboard/hooks/useEntityData', () => ({
    useEntityData: vi.fn(() => null),
    isConsensusManager: vi.fn(() => false),
    getEntityType: vi.fn(() => ({ label: 'Account', color: 'text-gray-500', bg: 'bg-gray-100' })),
    formatEntityAddress: vi.fn((addr: string) => addr.slice(0, 10) + '...'),
}));

// Mock EntityBadge components
vi.mock('@/features/dashboard/explorador/components/EntityBadge', () => ({
    EntityBadge: vi.fn(({ address }: { address: string }) => <div data-testid="entity-badge">{address}</div>),
    AddressDisplay: vi.fn(({ address }: { address: string }) => <div data-testid="address-display">{address}</div>),
    ConsensusManagerInfoCard: vi.fn(() => null),
    ValidatorNameLabel: vi.fn(() => null),
}));

describe('EntitiesSection', () => {
    const mockTt = {
        no_affected_entities: 'No affected entities found',
        no_created_entities: 'No created entities found',
    } as unknown as TranslationsT['dashboard']['transactions'];

    const baseDetails: TransactionDetails = {
        intent_hash: 'tx_123',
        status: 'CommittedSuccess',
        state_version: 1,
        epoch: 1,
        round: 1,
        confirmed_at: '2024-01-01',
    } as unknown as TransactionDetails;

    it('renders empty message when no entities exist', () => {
        render(<EntitiesSection variant="affected" details={baseDetails} tt={mockTt} onCopy={() => {}} copiedAddress={null} network="mainnet" />);
        expect(screen.getByText('No affected entities found')).toBeInTheDocument();
    });

    it('renders affected entities when data is a string array', () => {
        const details = {
            ...baseDetails,
            affected_global_entities: [
                'account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6',
                'account_rdx12v6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6'
            ]
        };
        render(<EntitiesSection variant="affected" details={details} tt={mockTt} onCopy={() => {}} copiedAddress={null} network="mainnet" />);
        const badges = screen.getAllByTestId('entity-badge');
        expect(badges).toHaveLength(2);
        expect(badges[0]).toHaveTextContent('account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6');
    });

    it('renders affected entities when data is an object array', () => {
        const details = {
            ...baseDetails,
            affected_global_entities: [{ address: 'account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6' }]
        };
        render(<EntitiesSection variant="affected" details={details as unknown as TransactionDetails} tt={mockTt} onCopy={() => {}} copiedAddress={null} network="mainnet" />);
        expect(screen.getByText('account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6')).toBeInTheDocument();
    });

    it('renders created entities using entity_address', () => {
        const details = {
            ...baseDetails,
            receipt: {
                state_updates: {
                    new_global_entities: [{ entity_address: 'account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6' }]
                }
            }
        };
        render(<EntitiesSection variant="created" details={details as unknown as TransactionDetails} tt={mockTt} onCopy={() => {}} copiedAddress={null} network="mainnet" />);
        expect(screen.getByText('account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6')).toBeInTheDocument();
    });
});
