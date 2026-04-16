'use client';

/**
 * features/dashboard/components/DashboardCardGrid.tsx
 *
 * Renders the responsive card grid for both validators and transactions,
 * including loading skeletons, empty states, and the progressive-load sentinel.
 *
 * Fully controlled — all state lives in DashboardClient.
 */

import React from 'react';
import { Shield } from 'lucide-react';
import { ValidatorCard } from '../staking';
import { TransactionCard } from '../explorador';

import type { DashboardCardGridProps } from '../types';

export const DashboardCardGrid = ({
  activeView,
  gridClass,
  filteredValidators,
  visibleValCount,
  sentinelRef,
  filteredTxs,
  loadingTxs,
  txsInitialized,
  columns,
  expandedPosts,
  readingMode,
  copiedAddress,
  searchQuery,
  network,
  timezone,
  locale,
  t,
  dt,
  onExpand,
  onCopy,
}: DashboardCardGridProps) => (
  <>
    {/* ── Card grid ── */}
    <div className={`grid gap-4 sm:gap-6 ${gridClass}`}>
      {activeView === 'staking' ? (
        <>
          {filteredValidators.slice(0, visibleValCount).map((validator, i) => (
            <ValidatorCard
              key={validator.id}
              validator={validator}
              index={i}
              searchQuery={searchQuery}
              isExpanded={expandedPosts.has(validator.id) && !readingMode}
              columns={columns}
              onExpand={onExpand}
              onCopy={onCopy}
              copiedAddress={copiedAddress}
              t={t}
              network={network}
            />
          ))}

          {/* Intersection-observer sentinel for progressive loading */}
          {visibleValCount < filteredValidators.length && (
            <div
              ref={sentinelRef}
              className="col-span-full h-10 flex items-center justify-center"
              aria-hidden="true"
            >
              <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin opacity-50" />
            </div>
          )}
        </>
      ) : (
        <>
          {loadingTxs
            ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl animate-pulse"
              />
            ))
            : filteredTxs.map((tx, i) => (
              <TransactionCard
                key={tx.intentHash + i}
                tx={tx}
                index={i}
                isExpanded={expandedPosts.has(tx.intentHash) && !readingMode}
                columns={columns}
                onExpand={onExpand}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
                t={t}
                readingMode={readingMode}
                network={network}
                timezone={timezone}
                locale={locale}
              />
            ))}
        </>
      )}
    </div>

    {/* ── Empty states ── */}
    {activeView === 'staking' && filteredValidators.length === 0 && (
      <div className="text-center py-20 text-[var(--color-text-muted)]">
        <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-bold">
          {searchQuery
            ? dt?.search?.no_results?.replace('{query}', searchQuery) ?? `No results for "${searchQuery}"`
            : dt?.search?.no_validators ?? 'No validators found'}
        </p>
      </div>
    )}

    {activeView === 'transactions' && txsInitialized && filteredTxs.length === 0 && !loadingTxs && (
      <div className="text-center py-20 text-[var(--color-text-muted)]">
        <p className="text-lg font-bold">
          {dt?.transactions?.no_transactions ?? 'No transactions found'}
        </p>
      </div>
    )}
  </>
);