import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock motion/react before anything else
vi.mock('motion/react', () => ({
  m: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
    h3: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <h3 {...props}>{children}</h3>,
  },
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
    h3: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <h3 {...props}>{children}</h3>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Shield: () => <div data-testid="shield" />,
  ShieldAlert: () => <div data-testid="shield-alert" />,
  ShieldCheck: () => <div data-testid="shield-check" />,
  ShieldX: () => <div data-testid="shield-x" />,
  Info: () => <div data-testid="info" />,
  ExternalLink: () => <div data-testid="external-link" />,
  Copy: () => <div data-testid="copy" />,
  ChevronDown: () => <div data-testid="chevron-down" />,
  Zap: () => <div data-testid="zap" />,
  Globe: () => <div data-testid="globe" />,
  Check: () => <div data-testid="check" />,
  Clock: () => <div data-testid="clock" />,
  Percent: () => <div data-testid="percent" />,
  Wallet: () => <div data-testid="wallet" />,
  Stamp: () => <div data-testid="stamp" />,
  Server: () => <div data-testid="server" />,
  Activity: () => <div data-testid="activity" />,
  Users: () => <div data-testid="users" />,
  Building: () => <div data-testid="building" />,
  Tag: () => <div data-testid="tag" />,
  AlertCircle: () => <div data-testid="alert-circle" />,
  Cable: () => <div data-testid="cable" />,
  Landmark: () => <div data-testid="landmark" />,
  Download: () => <div data-testid="download" />,
  Share2: () => <div data-testid="share2" />,
}));

// Mock custom hooks and context
vi.mock('@/context/LayoutContext', () => ({
  useLayout: () => ({
    setShowUnderConstruction: vi.fn(),
  }),
  LayoutProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: {} as Record<string, unknown>,
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/dashboard/staking/hooks/usePrefetchValidator', () => ({
  usePrefetchValidatorEntity: () => ({
    prefetchValidator: vi.fn(),
  }),
}));

vi.mock('@/features/dashboard/staking/components/ValidatorDetailComponents', () => ({
  StatusLabel: () => <div data-testid="status-label" />,
  ProposalsBar: () => <div data-testid="proposals-bar" />,
}));

vi.mock('@/features/dashboard/staking/components/ValidatorBadges', () => ({
  OnlineBadge: () => <div data-testid="online-badge" />,
  ConnectBadge: () => <div data-testid="connect-badge" />,
  VoteBadge: () => <div data-testid="vote-badge" />,
  EntityTagsGrid: () => <div data-testid="tags-grid" />,
}));

import { ValidatorCard } from '@/features/dashboard/staking/components/ValidatorCard';
import { type ValidatorCardProps } from '@/features/dashboard/staking/types/components.types';
import { type Validator } from '@/types/radix';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('ValidatorCard', () => {
  const mockValidator: Validator = {
    id: 'val_1',
    name: 'Super Validator',
    address: 'validator_rdx123',
    status: 'active',
    nominalFee: 1.5,
    recentUptime: 99.9,
    apy: 5.4,
    totalStakeXRD: 1000000,
    delegatedStake: 1000000,
    delegatedStakePercent: 1.2,
    iconUrl: '',
    uptimePercent: 99.9,
    apyProjection: 5.4,
    effectiveFee: 1.5,
    delegators: 100,
    description: 'A great validator',
    website: 'https://superval.com',
    provider: 'Cloud',
    providerPercent: 100,
    country: 'USA',
    countryPercent: 100,
    tags: [],
    onlineStatus: true,
    externalStakeAccepted: true,
    acceptsConnect: true,
    protocolUpdateVote: 'yes',
    // Required technical fields
    registered: true,
    publicKey: '',
    lsuResource: '',
    recentProposalsMissed: 0,
    recentProposalsMade: 0,
    totalProposalsMissed: 0,
    totalProposalsMade: 0,
    totalUptime: 99.9,
    startOfLiveProposalsMade: 0,
    startOfLiveProposalsMissed: 0,
    serverLiveProposalsMade: 0,
    serverLiveProposalsMissed: 0,
    rank: 1,
    ownerDelegation: 0,
    ownerAddress: '',
    lsu2xrdFactor: 1,
    feePercent: 1.5,
    ownerStake: 0,
    proposalsMade: 0,
    proposalsMissed: 0,
    epochPerformance: [],
    countryCode: 'US',
    version: '1.0.0',
    commit: 'abcdef',
  };

  const baseProps: ValidatorCardProps = {
    validator: mockValidator,
    index: 0,
    isExpanded: false,
    columns: 1,
    onExpand: vi.fn(),
    onCopy: vi.fn(),
    copiedAddress: null,
    searchQuery: '',
    network: 'mainnet',
    t: {
      dashboard: {
        staking: {
          fee: 'Fee',
          uptime: 'Uptime',
          apy: 'APY',
          stake: 'Stake',
        },
        card: {
            stake: 'Stake',
            fee: 'Fee',
            apy: 'APY',
            uptime_14d: 'Uptime 14d',
            stake_button: 'Delegar'
        }
      }
    } as unknown as ValidatorCardProps['t'],
  };

  it('renders validator name', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ValidatorCard {...baseProps} />
      </QueryClientProvider>
    );

    expect(screen.getAllByText('Super Validator')[0]).toBeInTheDocument();
  });

  it('calls onExpand when the card is clicked', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ValidatorCard {...baseProps} />
      </QueryClientProvider>
    );

    const name = screen.getAllByText('Super Validator')[0];
    fireEvent.pointerDown(name);
    fireEvent.click(name);
    expect(baseProps.onExpand).toHaveBeenCalledWith('val_1');
  });
});
