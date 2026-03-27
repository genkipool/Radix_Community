import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExploradorFilters } from '@/features/dashboard/explorador/hooks/useExploradorFilters';
import { type TransactionInfo } from '@/types/radix';

describe('useExploradorFilters (Combined Logic)', () => {
    const mockTx = (id: string, message: string): TransactionInfo => ({
        intentHash: id,
        status: 'Confirmed',
        feePaid: 0.1,
        confirmedAt: new Date(),
        epoch: 1,
        round: 1,
        accountsCount: 1,
        componentsCount: 0,
        hasNfts: false,
        message,
    });

    const txs: TransactionInfo[] = [
        mockTx('txid_1', 'Payment for coffee'),
        mockTx('txid_2', 'Staking XRD'),
        mockTx('txid_3', 'DEX Swap'),
    ];

    it('filters by substring in message', () => {
        const { result } = renderHook(() => useExploradorFilters({
            txs,
            deferredSearch: 'coffee',
            activeView: 'transactions'
        }));
        expect(result.current.filteredTxs).toHaveLength(1);
        expect(result.current.filteredTxs[0].intentHash).toBe('txid_1');
    });

    it('ignores Radix addresses in client-side substring filter (server handles them)', () => {
      // If it's a radix address, useExploradorFilters should return all txs (it doesn't filter them client-side)
      const { result } = renderHook(() => useExploradorFilters({
          txs,
          deferredSearch: 'account_rdx1234567890abcdef',
          activeView: 'transactions'
      }));
      expect(result.current.filteredTxs).toHaveLength(3);
    });

    it('filters by txid in URL if present', () => {
        // Mock window.location.href using spyOn (cleanest for Vitest/JSDOM)
        const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
            href: 'http://localhost/?tx=txid_2',
        } as Location);

        const { result } = renderHook(() => useExploradorFilters({
            txs,
            deferredSearch: '',
            activeView: 'transactions'
        }));
        
        expect(result.current.filteredTxs).toHaveLength(1);
        expect(result.current.filteredTxs[0].intentHash).toBe('txid_2');

        locationSpy.mockRestore();
    });
});
