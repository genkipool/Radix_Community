import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as apiClient from '@/features/dashboard/services/apiClient';
import React from 'react';
import { type Validator } from '@/types/radix';

// Mock the API client
vi.mock('@/features/dashboard/services/apiClient', () => ({
  apiFetchValidators: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('useValidatorsQuery', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('fetches validators successfully', async () => {
    const mockData = {
      validators: [{ id: '1', name: 'Val 1', address: 'addr1' } as unknown as Validator],
      networkStats: { totalStaked: 0, activeValidators: 0, totalValidators: 0, avgApy: 0, avgUptime: 0, epoch: 1 }
    };
    vi.mocked(apiClient.apiFetchValidators).mockResolvedValue(mockData);

    const { result } = renderHook(() => useValidatorsQuery('mainnet'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('handles API errors correctly', async () => {
    vi.mocked(apiClient.apiFetchValidators).mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => useValidatorsQuery('mainnet'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
