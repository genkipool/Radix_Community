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
import { RefreshCw, Shield, TriangleAlert } from 'lucide-react';
import { ValidatorCard } from '../staking/components/ValidatorCard';
import { TransactionCard } from '../explorador/components/TransactionCard';
import { AccountCard } from '../explorador/components/AccountCard';
import { PackageCard } from '../explorador/components/PackageCard';
import { ComponentCard } from '../explorador/components/ComponentCard';
import { ResourceCard } from '../explorador/components/ResourceCard';
import { SystemCard } from '../explorador/components/SystemCard';

import type { DashboardCardGridProps } from '../types';

const EMPTY_ACCOUNTS: string[] = [];

/** A read that did not happen, and the offer to try it again. */
const UnavailableState = ({
  message,
  hint,
  retryLabel,
  onRetry,
}: {
  message: string;
  hint?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) => (
  <div className="text-center py-20 text-[var(--color-text-muted)]">
    <TriangleAlert className="size-12 mx-auto mb-4 opacity-40" />
    <p className="text-lg font-bold text-[var(--color-text-main)]">{message}</p>
    {hint && <p className="mt-1 text-sm">{hint}</p>}
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-full border px-5 h-10 text-sm font-bold transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
      >
        <RefreshCw className="size-4" />
        {retryLabel ?? 'Retry'}
      </button>
    )}
  </div>
);

export const DashboardCardGrid = ({
  activeView,
  gridClass,
  filteredValidators,
  visibleValCount,
  sentinelRef,
  filteredTxs,
  loadingTxs,
  txsInitialized,
  loadingValidators = false,
  validatorsFailed = false,
  onRetryValidators,
  txsFailed = false,
  onRetryTxs,
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
  resourcesToShow = EMPTY_ACCOUNTS,
  systemEntitiesToShow = EMPTY_ACCOUNTS,
  validatorsToShow = EMPTY_ACCOUNTS,
}: DashboardCardGridProps) => {
  return (
    <>
      <div className={`grid gap-4 w-full mb-8 ${gridClass}`}>
        {activeView === 'staking' ? (
          <>
            {loadingValidators &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`val-skeleton-${i}`}
                  className="h-32 bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl animate-pulse"
                />
              ))}
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
            {resourcesToShow.length > 0 && resourcesToShow.map((address) => (
              <ResourceCard
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
            {systemEntitiesToShow.length > 0 && systemEntitiesToShow.map((address) => (
              <SystemCard
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
            {validatorsToShow.length > 0 && validatorsToShow.map((address) => (
              <SystemCard
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

      {/* ── Empty and unavailable states ──
          "Nothing found" is a statement about the ledger, so it is only made
          when the ledger actually answered. While a list is loading or being
          retried nothing is said at all, and a read that failed says THAT,
          with a way to try again. */}
      {activeView === 'staking' && validatorsFailed && (
        <UnavailableState
          message={dt?.error?.unavailable_title ?? 'Could not read the network'}
          hint={dt?.error?.unavailable_hint}
          retryLabel={dt?.error?.retry}
          onRetry={onRetryValidators}
        />
      )}

      {activeView === 'staking' &&
        !validatorsFailed &&
        !loadingValidators &&
        filteredValidators.length === 0 && (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <Shield className="size-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-bold">
              {searchQuery
                ? dt?.search?.no_results ?? 'No results found'
                : dt?.search?.no_validators ?? 'No validators found'}
            </p>
          </div>
        )}

      {activeView === 'transactions' && txsFailed && (
        <UnavailableState
          message={dt?.error?.unavailable_title ?? 'Could not read the network'}
          hint={dt?.error?.unavailable_hint}
          retryLabel={dt?.error?.retry}
          onRetry={onRetryTxs}
        />
      )}

      {activeView === 'transactions' &&
        !txsFailed &&
        txsInitialized &&
        filteredTxs.length === 0 &&
        !loadingTxs && (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            <p className="text-lg font-bold">
              {dt?.transactions?.no_transactions ?? 'No transactions found'}
            </p>
          </div>
        )}
    </>
  );
};