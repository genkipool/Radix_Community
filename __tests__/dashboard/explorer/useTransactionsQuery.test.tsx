import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTransactionsQuery } from '@/features/dashboard/explorador/hooks/useTransactionsQuery';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';

// Mock react-query to inspect the arguments passed to useInfiniteQuery
vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-query')>();
    return {
        ...actual,
        useInfiniteQuery: vi.fn().mockReturnValue({ data: undefined }),
    };
});

// Mock the API client
vi.mock('@/features/dashboard/services/apiClient', () => ({
    apiFetchTransactions: vi.fn(),
}));

describe('useTransactionsQuery', () => {
    it('MUST use keepPreviousData to prevent UI flashes during filter changes', () => {
        renderHook(() => useTransactionsQuery({
            network: 'mainnet',
            searchQuery: '',
            tag: 'All',
            dateRange: { start: null, end: null },
            enabled: true,
        }));

        expect(useInfiniteQuery).toHaveBeenCalled();
        const callArgs = vi.mocked(useInfiniteQuery).mock.calls[0][0];

        // This assertion protects against the metadata flickering bug reported by the user.
        // DO NOT REMOVE THIS ASSERTION OR THIS FUNCTIONALITY.
        expect(callArgs.placeholderData).toBe(keepPreviousData);
    });
});
