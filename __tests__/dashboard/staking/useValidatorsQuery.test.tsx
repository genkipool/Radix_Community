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
  apiFetchValidatorSetFingerprint: vi.fn(),
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
    vi.mocked(apiClient.apiFetchValidatorSetFingerprint).mockRejectedValue(new Error('no fingerprint'));
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

  /**
   * A failed read is retried before it is called a failure. The API answers 503
   * when the Gateway cannot be reached — rather than 200 with an empty list —
   * precisely so this happens, and only when the attempts run out does the view
   * say it could not read the network.
   */
  it('retries a failing fetch, and reports the error once it runs out', async () => {
    vi.mocked(apiClient.apiFetchValidators).mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => useValidatorsQuery('mainnet'), { wrapper });

    // 250 + 500 + 1000 + 2000 ms of backoff, so this is given room to finish.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 10_000 });
    expect(result.current.error).toBeDefined();
    // The first call plus four retries.
    expect(apiClient.apiFetchValidators).toHaveBeenCalledTimes(5);
  });

  /**
   * A change in the validator set (a validator created, registered or renamed)
   * must not wait out the five-minute cache: the list is fetched again for the
   * new fingerprint and swapped in once it has arrived.
   */
  it('refetches once when the live fingerprint no longer matches the list', async () => {
    const stats = { totalStaked: 0, activeValidators: 0, totalValidators: 0, avgApy: 0, avgUptime: 0, epoch: 1 };
    const oldList = { validators: [{ address: 'a' } as Validator], networkStats: stats, fingerprint: 'old' };
    const newList = { validators: [{ address: 'a' }, { address: 'genkipool' }] as Validator[], networkStats: stats, fingerprint: 'new' };
    vi.mocked(apiClient.apiFetchValidatorSetFingerprint).mockResolvedValue({ fingerprint: 'new' });
    vi.mocked(apiClient.apiFetchValidators).mockResolvedValueOnce(oldList).mockResolvedValueOnce(newList);

    const { result } = renderHook(() => useValidatorsQuery('stokenet'), { wrapper });

    await waitFor(() => expect(result.current.data?.fingerprint).toBe('new'));
    expect(result.current.data?.validators).toHaveLength(2);
    expect(apiClient.apiFetchValidators).toHaveBeenCalledTimes(2);
    expect(apiClient.apiFetchValidators).toHaveBeenLastCalledWith('stokenet', 'new');
  });
});
