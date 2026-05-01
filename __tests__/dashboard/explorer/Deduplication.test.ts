import { describe, it, expect } from 'vitest';
import { flattenTransactionPages } from '@/features/dashboard/explorador/hooks/useTransactionsQuery';
import { type TransactionInfo } from '@/types/radix';

describe('flattenTransactionPages (Deduplication)', () => {
  const mockTx = (id: string): TransactionInfo => ({
    intentHash: id,
    status: 'Confirmed',
    feePaid: 0.1,
    confirmedAt: new Date(),
    stateVersion: 1,
    epoch: 1,
    round: 1,
    accountsCount: 1,
    componentsCount: 0,
    hasNfts: false,
  });

  it('flattens multiple pages and removes duplicates by intentHash', () => {
    const pages = [
      {
        transactions: [mockTx('tx1'), mockTx('tx2')],
        nextCursor: 'c1',
      },
      {
        transactions: [mockTx('tx2'), mockTx('tx3')], // tx2 is duplicated across pages
        nextCursor: 'c2',
      },
    ];

    const result = flattenTransactionPages(pages);
    
    expect(result).toHaveLength(3);
    expect(result.map(tx => tx.intentHash)).toEqual(['tx1', 'tx2', 'tx3']);
  });

  it('returns empty array for undefined pages', () => {
    expect(flattenTransactionPages(undefined)).toEqual([]);
  });

  it('handles empty pages correctly', () => {
    expect(flattenTransactionPages([{ transactions: [], nextCursor: undefined }])).toEqual([]);
  });
});
