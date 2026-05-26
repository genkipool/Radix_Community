import type { TransactionInfo } from '@/types/radix';

/**
 * matchesTransactionTag
 *
 * Client-side tag filter. Tags that have a Gateway-level equivalent
 * (Success / Failed) are normalised here so the display remains consistent
 * even when the server has already pre-filtered by status.
 */
export function matchesTransactionTag(tx: TransactionInfo, tag: string): boolean {
    switch (tag) {
        case 'All':          return true;
        case 'Staking':      return tx.validatorOps?.some(op => (op.stakeXrd ?? 0) > 0) ?? false;
        case 'Unstaking':    return tx.validatorOps?.some(op => (op.unstakeLsu ?? 0) > 0) ?? false;
        case 'Claim':        return tx.validatorOps?.some(op => (op.claimXrd ?? 0) > 0) ?? false;
        case 'Success':      return tx.status === 'CommittedSuccess' || tx.status === 'Committed';
        case 'Failed':       return tx.status !== 'CommittedSuccess' && tx.status !== 'Committed';
        case 'With Message': return !!tx.message;
        case 'With NFTs':    return !!tx.hasNfts;
        default:             return true;
    }
}


