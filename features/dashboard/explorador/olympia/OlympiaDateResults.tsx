'use client';
/**
 * The explorer's calendar on a day before Babylon: the Olympia transactions of
 * the chosen dates, one card each, after whatever Babylon had for them (a range
 * can straddle the migration). Newest first, a page at a time.
 */
import React from 'react';
import { m } from 'motion/react';
import type { AccountCardProps } from '../types/components.types';
import { useOlympiaTxsByDate } from '@/features/dashboard/services/olympiaApi';
import { olympiaDict } from './dict';
import { OlympiaTxCard } from './OlympiaTxCard';

type CardProps = Omit<AccountCardProps, 'address' | 'isExpanded'>;

export function OlympiaDateResults({ range, expandedPosts, readingMode, emptyText, showEmpty, ...card }: CardProps & {
  range: { from: number; to: number };
  expandedPosts: Set<string>;
  readingMode?: boolean;
  /** "No transactions found", said only when Babylon had nothing either. */
  emptyText: string;
  showEmpty: boolean;
}) {
  const o = olympiaDict(card.t?.dashboard?.transactions);
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } = useOlympiaTxsByDate(range);
  const txs = data?.pages.flatMap((p) => p?.items ?? []) ?? [];

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`olympia-skeleton-${i}`} className="col-span-full h-32 bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl animate-pulse" />
        ))}
      </>
    );
  }
  if (isError) {
    return (
      <div className="col-span-full text-center py-10 text-sm text-[var(--color-danger)]">
        {o.error}{' '}
        <button type="button" onClick={() => void refetch()} className="underline font-bold">{card.t?.dashboard?.error?.retry ?? 'Retry'}</button>
      </div>
    );
  }
  if (txs.length === 0) {
    return showEmpty ? (
      <div className="col-span-full text-center py-20 text-[var(--color-text-muted)]">
        <p className="text-lg font-bold">{emptyText}</p>
      </div>
    ) : null;
  }

  return (
    <>
      {txs.map((tx) => (
        <OlympiaTxCard
          key={tx.transactionId}
          {...card}
          address={tx.transactionId}
          isExpanded={expandedPosts.has(tx.transactionId) && !readingMode}
          readingMode={readingMode}
        />
      ))}
      {hasNextPage && (
        <div className="col-span-full flex justify-center mt-2 mb-4">
          <m.button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? o.loading : o.load_more}
          </m.button>
        </div>
      )}
    </>
  );
}
