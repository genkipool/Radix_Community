'use client';

import type { DashboardView } from '@/features/dashboard/types';
import type { TransactionInfo } from '@/types/radix';
import { isRadixAddress } from '@/features/dashboard/utils/radixAddress';

export interface UseExploradorFiltersOptions {
  txs: TransactionInfo[];
  deferredSearch: string;
  activeView: DashboardView;
}

export function useExploradorFilters({
  txs,
  deferredSearch,
  activeView,
}: UseExploradorFiltersOptions) {
  
  const filteredTxs = (() => {
    const urlTx = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('tx') : null;
    
    // When tag or date filters are active, the server already returns filtered results.
    // We only need to apply client-side filtering for the search query if it's NOT a Radix address.
    let result = [...txs];

    // Priority 1: Filter by specific tx in URL
    if (urlTx && urlTx.startsWith('txid_')) {
      return result.filter(tx => tx.intentHash === urlTx);
    }

    // Priority 2: Generic search (Substring match on message/hash)
    if (deferredSearch.trim() && !isRadixAddress(deferredSearch)) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(tx =>
        tx.intentHash.toLowerCase().includes(q) ||
        (tx.message || '').toLowerCase().includes(q)
      );
    }

    return result;
  })();

  const explorerStats = (() => {
    if (activeView !== 'transactions') return null;
    
    let maxFee = 0;
    let maxFeeHash = '';
    
    filteredTxs.forEach(tx => {
      if (tx.feePaid > maxFee) {
        maxFee = tx.feePaid;
        maxFeeHash = tx.intentHash;
      }
    });

    return { maxFee, maxFeeHash };
  })();

  return {
    filteredTxs,
    explorerStats,
  };
}
