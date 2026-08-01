import type { Dictionary } from '@/i18n';
import type { NetworkStats } from '@/types/radix';

export type Network = 'mainnet' | 'stokenet';
export type DashboardView = 'staking' | 'transactions';
export type SortMode = 'newest' | 'oldest' | 'date' | 'random';

export interface MarketData {
    priceUsd: number;
    priceEur: number;
    priceChange24h: number;
    marketCapUsd: number;
    marketCapEur: number;
    circulatingSupply: number;
    totalValueLockedUsd: number;
    totalValueLockedEur: number;
}

/** Strongly-typed alias for the dashboard translation sub-tree */
export type DashboardDict = Dictionary['dashboard'];

/**
 * Convenience alias for components receiving the full dictionary.
 * Replaces `t: any`.
 */
export type TranslationsT = Dictionary;

/** All cookie-persisted initial values read by dashboard pages */
export interface DashboardInitialProps {
  timezone: string;
  initialView?: DashboardView;
  /** Wallet filter toggle, persisted so a view change does not reset it. */
  initialWalletFilter?: boolean;
  /**
   * Aggregate network figures, so a view that does not list validators never
   * has to carry the full list just to display four numbers.
   */
  initialNetworkStats?: NetworkStats | null;
  /**
   * The URL named the network explicitly (`?network=`). That pins the page: a
   * shared link must open on its own ledger regardless of what the wallet
   * happens to be set to.
   */
  initialNetworkFromUrl?: boolean;
  initialNetwork: Network;
  initialActiveTag?: string[];
  initialTransactionActiveTag?: string;
  initialValSortMode?: SortMode;
  initialTxSortMode?: SortMode;
  initialValColumns?: number;
  initialTxColumns?: number;
  initialValReadingMode?: boolean;
  initialTxReadingMode?: boolean;
  initialValAutoCollapse?: boolean;
  initialTxAutoCollapse?: boolean;
  initialSearchQuery?: string;
  initialDateRange?: { start: string | null; end: string | null };
  randomSeed: number;
  initialMarketData?: MarketData | null;
  dictionary?: Partial<Dictionary>;
  initialIsWalletConnected?: boolean;
  initialConnectedAccounts?: string[];
}

