'use client';
/**
 * Under the card of an Olympia account found by the search box: its
 * transactions, one card each, newest first, as Babylon lists an account's
 * transactions under its card. A page at a time.
 */
import React from 'react';
import { m } from 'motion/react';
import type { AccountCardProps } from '../types/components.types';
import { useOlympiaTransactions } from '@/features/dashboard/services/olympiaApi';
import { olympiaDict } from './dict';
import { OlympiaTxCard } from './OlympiaTxCard';

type CardProps = Omit<AccountCardProps, 'address' | 'isExpanded'>;

export function OlympiaAccountTxResults({ address, expandedPosts, readingMode, ...card }: CardProps & {
  address: string;
  expandedPosts: Set<string>;
  readingMode?: boolean;
}) {
  const o = olympiaDict(card.t?.dashboard?.transactions);
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } = useOlympiaTransactions(address);
  const txs = data?.pages.flatMap((p) => p?.items ?? []) ?? [];

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`olympia-tx-skeleton-${i}`} className="col-span-full h-32 bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl animate-pulse" />
        ))}
      </>
    );
  }
  if (isError) {
    return (
      <div className="col-span-full text-center py-10 text-sm text-[var(--color-danger)]">
        {o.error}{' '}
        <button type="button" onClick={() => void refetch()} className="underline font-bold">{card.t?.dashboard?.error?.retry}</button>
      </div>
    );
  }
  if (txs.length === 0) return null;

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
