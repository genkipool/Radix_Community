/**
 * services/gateway/index.ts
 *
 * Barrel re-export for the Radix Gateway service layer.
 * Import from here for clean, explicit access to all Gateway functions.
 */

// ── Infrastructure ────────────────────────────────────────────────────────────
export { withRetry, runWithLimit, runInBatches, CONCURRENCY } from './client';
export type { Network } from './client';

// ── Ledger / Entities ─────────────────────────────────────────────────────────
export {
  fetchLedgerState,
  fetchEntityDetails,
  fetchNonFungibleData,
  fetchNonFungibleLocation,
} from './entities';

// ── Transactions ──────────────────────────────────────────────────────────────
export {
  fetchRecentTransactions,
  searchTransactionsByAddress,
  fetchTransactionDetails,
  fetchRoundProposer,
  fetchStakeHistoryCached,
} from './transactions';

// ── Validators ────────────────────────────────────────────────────────────────
export {
  fetchValidatorsWithLedger,
  fetchValidators,
  computeNetworkStats,
} from './validators';
export type { ValidatorsFetchResult } from './validators';
