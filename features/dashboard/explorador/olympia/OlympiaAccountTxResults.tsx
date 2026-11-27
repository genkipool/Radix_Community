'use client';
/**
 * Under the card of an Olympia account found by the search box: its
 * transactions, one card each, newest first, as Babylon lists an account's
 * transactions under its card. A page at a time.
 */
import React, { useEffect } from 'react';
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

  // Same scroll-based pagination as Babylon (useInfiniteScrollTx): no button
  // and no bottom spinner that feeds back into scrollHeight.
  useEffect(() => {
    if (!hasNextPage) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY + window.innerHeight;
        const total = document.documentElement.scrollHeight;
        if (scrolled >= total - 800 && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, txs.length]);

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
    </>
  );
}
