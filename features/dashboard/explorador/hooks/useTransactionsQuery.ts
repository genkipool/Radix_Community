'use client';

/**
 * features/dashboard/explorador/hooks/useTransactionsQuery.ts
 *
 * Infinite React Query for the transaction explorer.
 * Cursor-based pagination with deduplication, retry, and cache pre-warming.
 */

import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetchTransactions } from '@/features/dashboard/services/apiClient';
import { isRadixAddress } from '@/features/dashboard/utils/radixAddress';
import type { TransactionInfo } from '@/types/radix';
import type { Network } from '@/features/dashboard/types';

interface TransactionsPage {
  transactions: TransactionInfo[];
  nextCursor:   string | undefined;
}

interface UseTransactionsQueryOptions {
  network:     Network;
  searchQuery: string;
  tag:         string;
  dateRange:   { start: string | null; end: string | null };
  /**
   * Whether the explorer view is currently active.
   *
   * Previously this flag was forwarded directly to `enabled`, which caused the
   * HydrationBoundary cache to be ignored: React Query only hydrates a query
   * when it is observed (enabled) at mount time. With `enabled: false` on the
   * first render the cache was skipped, and the moment the explorer tab became
   * active the query started fresh — showing the skeleton on every page reload.
   *
   * Fix: the query is now always enabled (`enabled: true`) so the server-side
   * prefetched data is consumed immediately on mount. This flag is used instead
   * to gate `refetchOnMount` — so a background network call is only triggered
   * when the explorer is actually visible, not while the validator view is shown.
   */
  enabled:     boolean;
}

export function useTransactionsQuery({ network, searchQuery, tag, dateRange, enabled }: UseTransactionsQueryOptions) {
  const trimmedQuery   = searchQuery.trim();
  const isAddress      = isRadixAddress(trimmedQuery);
  const serverSideAddr = isAddress ? trimmedQuery : undefined;

  return useInfiniteQuery<TransactionsPage>({
    queryKey:             ['transactions', network, serverSideAddr, tag, dateRange],
    queryFn:              async ({ pageParam }) =>
      apiFetchTransactions({
        cursor:  pageParam as string | undefined,
        limit:   15,
        address: serverSideAddr,
        network,
        tag,
        start:   dateRange.start || undefined,
        end:     dateRange.end   || undefined,
      }),
    initialPageParam:     undefined as string | undefined,
    getNextPageParam:     (lastPage) => lastPage.nextCursor ?? undefined,
    // [PROTECTIVE COMMENT] DO NOT REMOVE or CHANGE placeholderData: keepPreviousData.
    // It is strictly required to prevent the UI from flashing skeletons when the user reloads the list or changes filters.
    placeholderData:      keepPreviousData,
    enabled:              true,
    refetchOnMount:       enabled,
    staleTime:            30_000,
    refetchOnWindowFocus: false,
  });
}

/** Flatten infinite query pages into a single array. Memoize with useMemo in the consumer. */
export function flattenTransactionPages(
  pages: TransactionsPage[] | undefined,
): TransactionInfo[] {
  if (!pages) return [];
  const all  = pages.flatMap(p => p.transactions);
  const seen = new Set<string>();
  return all.filter(tx => {
    if (seen.has(tx.intentHash)) return false;
    seen.add(tx.intentHash);
    return true;
  });
}
