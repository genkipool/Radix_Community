/**
 * features/dashboard/explorador/index.ts
 *
 * Public API barrel for the Transaction Explorer slice.
 * Components, hooks, types, and constants — all from one import point.
 */

// ── Components ────────────────────────────────────────────────────────────────
export { TransactionCard }          from './components/TransactionCard';
export { AccountCard }              from './components/AccountCard';
export { TransactionDetailModal }   from './components/TransactionDetailModal';
export { TransactionTabs }          from './components/TransactionTabs';
export { EntityBadge, AddressDisplay, ValidatorNameLabel } from './components/EntityBadge';
export { SourceBadge }              from './components/SourceBadge';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useTransactionsQuery, flattenTransactionPages } from './hooks/useTransactionsQuery';
export { usePrefetchTransactionDetails } from './hooks/usePrefetchTx';
export { useInfiniteScrollTx } from './hooks/useDashboardTxEffects';

// ── Constants ─────────────────────────────────────────────────────────────────
export { TRANSACTION_TAGS } from './constants';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  OracleUpdate,
  AirdropData,
  ParsedManifest,
  SourceStyle,
} from './types';

