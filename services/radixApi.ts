/**
 * services/radixApi.ts
 *
 * Backward-compatibility barrel.
 * All app/api/* routes and feature code that imports from '@/services/radixApi'
 * continues to work without changes. The implementation now lives in:
 *   services/gateway/client.ts       — Gateway client, auth, retry primitives
 *   services/gateway/entities.ts     — Entity/NFT/ledger-state fetching
 *   services/gateway/transactions.ts — Transaction streaming, search, details
 *   services/gateway/validators.ts   — Validator fetching, uptime, geo, stats
 */

// ── Domain types (re-exported for existing imports) ────────────────────────────
export type { Validator, NetworkStats, TransactionInfo, StakeHistoryEntry } from '@/types/radix';

// ── Constants / helpers (re-exported for existing imports) ─────────────────────
export { DASHBOARD_TAGS } from '@/constants/dashboard';
export { getStatusColor, getUptimeColor, roundTo } from '@/utils/validators';

// ── Gateway layer ──────────────────────────────────────────────────────────────
export {
  withRetry,
  runWithLimit,
  runInBatches,
} from './gateway/client';

export {
  fetchLedgerState,
  fetchEntityDetails,
  fetchNonFungibleData,
  fetchNonFungibleLocation,
} from './gateway/entities';

export {
  fetchRecentTransactions,
  fetchFilteredTransactions,
  searchTransactionsByAddress,
  fetchTransactionDetails,
  fetchRoundProposer,
  fetchStakeHistoryCached,
} from './gateway/transactions';

export {
  fetchValidatorsWithLedger,
  fetchValidators,
  computeNetworkStats,
} from './gateway/validators';
export type { ValidatorsFetchResult } from './gateway/validators';
