'use client';

import type { DashboardView } from '@/features/dashboard/types';
import type { TransactionInfo } from '@/types/radix';
import type { FungibleChange } from '@/features/dashboard/explorador/types';
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
    
    let maxSending = 0;
    let maxSendingHash = '';
    
    // Use ALL loaded transactions, not the filtered subset, for consistent stats
    txs.forEach(tx => {
      // Improve logic: scan ALL fungible balance changes to find any XRD sent
      // This is more robust than relying on tx.displayAmount which might show another token
      // We look for the most negative balance change (withdrawal) of XRD.
      const fungibleChanges = (tx.balanceChanges?.fungible_balance_changes as FungibleChange[]) || [];
      fungibleChanges.forEach((change: FungibleChange) => {
        const amount = parseFloat(change.balance_change);
        if (amount < 0) {
          const absAmount = Math.abs(amount);
          // Only compare if this transaction is XRD-dominant (best effort for summary stats)
          if (tx.displayIsXrd && absAmount > maxSending) {
             maxSending = absAmount;
             maxSendingHash = tx.intentHash;
          }
        }
      });
      
      // Fallback to legacy check if balanceChanges missing/empty but tx is marked as XRD send
      if (tx.displayIsXrd && (tx.displayAmount || 0) > maxSending) {
        maxSending = tx.displayAmount || 0;
        maxSendingHash = tx.intentHash;
      }
    });
    
    return { maxSending, maxSendingHash };
  })();

  return {
    filteredTxs,
    explorerStats,
  };
}
