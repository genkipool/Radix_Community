// Removed unused type imports from radix
import { type SortMode } from './core.types';

/**
 * UseExpandedCardsOptions
 * Options for the useExpandedCards hook
 */
export interface UseExpandedCardsOptions {
  valColumns:                number;
  txColumns:                 number;
  activeView:                'staking' | 'transactions';
  readingMode:               boolean;
  autoCollapse:              boolean;
}

/**
 * UseDashboardPreferencesOptions
 * Options for the useDashboardPreferences hook
 */
export interface UseDashboardPreferencesOptions {
  initialValSortMode:          SortMode;
  initialTxSortMode:           SortMode;
  initialValColumns:           number;
  initialTxColumns:            number;
  initialValReadingMode:       boolean;
  initialTxReadingMode:        boolean;
  initialValAutoCollapse:      boolean;
  initialTxAutoCollapse:       boolean;
  initialActiveTag:            string[];
  initialTransactionActiveTag: string;
  /** Wallet filter toggle, persisted so a view change does not reset it. */
  initialWalletFilter:         boolean;
}
