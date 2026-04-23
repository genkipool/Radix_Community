import type { TransactionInfo } from '@/types/radix';
import type { FungibleChange } from '@/features/dashboard/explorador/types';

export interface ExplorerStats {
    maxSending: number;
    maxSendingHash: string;
}

export function calculateExplorerStats(txs: TransactionInfo[]): ExplorerStats {
    let maxSending = 0;
    let maxSendingHash = '';

    txs.forEach(tx => {
        const fungibleChanges = (tx.balanceChanges?.fungible_balance_changes as FungibleChange[]) || [];
        fungibleChanges.forEach((change: FungibleChange) => {
            const amount = parseFloat(change.balance_change);
            if (amount < 0) {
                const absAmount = Math.abs(amount);
                // Check if this transaction is XRD-dominant (best effort for summary stats)
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
}
