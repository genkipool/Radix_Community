import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransactionCard } from '@/features/dashboard/explorador/components/TransactionCard';
import { type TransactionCardProps } from '@/features/dashboard/explorador/types/components.types';
import { type TransactionInfo } from '@/types/radix';

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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/context/LanguageContext';
import { en } from '@/i18n/locales/en';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('Security & Sanitization', () => {
  const maliciousInput = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

  const mockTx: TransactionInfo = {
    intentHash: 'tx_security_test',
    status: 'Confirmed',
    feePaid: 0.5,
    confirmedAt: new Date(),
    message: maliciousInput,
    manifestClasses: ['Transfer'],
    epoch: 123,
    round: 456,
    accountsCount: 1,
    componentsCount: 1,
    hasNfts: false,
  };

  const baseProps: TransactionCardProps = {
    tx: mockTx,
    isExpanded: false,
    onExpand: vi.fn(),
    onCopy: vi.fn(),
    copiedAddress: null,
    network: 'mainnet',
    index: 0,
    columns: 1,
    t: en,
    timezone: 'UTC',
    locale: 'en',
  };

  it('renders malicious messages as literal text and does not execute scripts', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider language="en" dictionary={en}>
          <TransactionCard {...baseProps} />
        </LanguageProvider>
      </QueryClientProvider>
    );

    // The text should be rendered literally, meaning the tags are escaped by React
    const messageElement = screen.getByText(maliciousInput);
    expect(messageElement).toBeInTheDocument();
  });
});
