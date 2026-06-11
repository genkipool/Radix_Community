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
import { ValidatorCard } from '../staking/components/ValidatorCard';
import { TransactionCard } from '../explorador/components/TransactionCard';
import { AccountCard } from '../explorador/components/AccountCard';
import { PackageCard } from '../explorador/components/PackageCard';
import { ComponentCard } from '../explorador/components/ComponentCard';

import type { DashboardCardGridProps } from '../types';

const EMPTY_ACCOUNTS: string[] = [];

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
  marketData,
  accountsToShow = EMPTY_ACCOUNTS,
  packagesToShow = EMPTY_ACCOUNTS,
  componentsToShow = EMPTY_ACCOUNTS,
}: DashboardCardGridProps) => {
  return (
    <>
      <div className={`grid gap-4 w-full mb-8 ${gridClass}`}>
        {activeView === 'staking' ? (
          <>
            {filteredValidators.slice(0, visibleValCount).map((val, index) => (
              <ValidatorCard
                key={val.address}
                validator={val}
                index={index}
                searchQuery={searchQuery}
                isExpanded={expandedPosts.has(val.id) && !readingMode}
                columns={columns}
                onExpand={onExpand}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
                t={t}
                network={network}
                marketData={marketData}
                locale={locale}
              />
            ))}
            {/* Progress load sentinel */}
            {visibleValCount < filteredValidators.length && (
              <div
                ref={sentinelRef}
                className="col-span-full h-12 flex items-center justify-center my-4"
                aria-hidden="true"
              >
                <div className="size-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin opacity-50" />
              </div>
            )}
          </>
        ) : (
          <>
            {accountsToShow.length > 0 && accountsToShow.map((address) => (
              <AccountCard
                key={address}
                address={address}
                columns={columns}
                isExpanded={expandedPosts.has(address) && !readingMode}
                onExpand={onExpand}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
                t={t}
                network={network}
                locale={locale}
                marketData={marketData}
                readingMode={readingMode}
              />
            ))}
            {packagesToShow.length > 0 && packagesToShow.map((address) => (
              <PackageCard
                key={address}
                address={address}
                columns={columns}
                isExpanded={expandedPosts.has(address) && !readingMode}
                onExpand={onExpand}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
                t={t}
                network={network}
                locale={locale}
                marketData={marketData}
                readingMode={readingMode}
              />
            ))}
            {componentsToShow.length > 0 && componentsToShow.map((address) => (
              <ComponentCard
                key={address}
                address={address}
                columns={columns}
                isExpanded={expandedPosts.has(address) && !readingMode}
                onExpand={onExpand}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
                t={t}
                network={network}
                locale={locale}
                marketData={marketData}
                readingMode={readingMode}
              />
            ))}
            {loadingTxs
              ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl animate-pulse"
                />
              ))
              : filteredTxs.map((tx, i) => (
                <TransactionCard
                  key={tx.intentHash}
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
                  marketData={marketData}
                />
              ))}
          </>
        )}
      </div>

      {/* ── Empty states ── */}
      {activeView === 'staking' && filteredValidators.length === 0 && (
        <div className="text-center py-20 text-[var(--color-text-muted)]">
          <Shield className="size-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">
            {searchQuery
              ? dt?.search?.no_results ?? 'No results found'
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
};