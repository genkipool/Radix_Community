import type { Dictionary } from '@/types/i18n';
import React from 'react';

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
  /** Validator IDs expanded on the last session */
  initialExpandedValidators?: string[];
  /** Transaction intent hashes expanded on the last session */
  initialExpandedTxs?: string[];
  initialSearchQuery?: string;
  initialDateRange?: { start: string | null; end: string | null };
  randomSeed: number;
  initialMarketData?: MarketData | null;
  statsRow?: React.ReactNode;
}
