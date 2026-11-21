import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { detectAddressNetwork, isRadixAddress } from '@/features/dashboard/utils/radixAddress';
import { useDashboardUrlSync } from '@/features/dashboard/hooks/useDashboardUrlSync';
import { parseDashboardQuery, serializeDashboardQuery } from '@/features/dashboard/lib/routes';

const focusEntityMock = vi.fn();
const setNetworkMock = vi.fn();
const setRankingMock = vi.fn();

vi.mock('@/features/dashboard/hooks/useDashboardNavigation', () => ({
    useDashboardNavigation: () => ({
        isNavigating: false,
        committedEntity: null,
        committedRanking: null,
        goToView: vi.fn(),
        setNetwork: setNetworkMock,
        setDateRange: vi.fn(),
        setTag: vi.fn(),
        setRanking: setRankingMock,
        focusEntity: focusEntityMock,
    }),
}));

describe('Explorer smart network auto-detection', () => {
    const STOKENET_TX = 'txid_tdx_2_1hcvpwxj0hyp65mud2xnvumughqn00fdnq5jsgek7p6dz8u9lg26q9u0dga';
    const STOKENET_ACC = 'account_tdx_2_128kdm8cy2exfj4f37r2t7vz6skclvm8dyrgwz76r69ds43f2q4l0dl';
    const STOKENET_COMP = 'component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl';
    const MAINNET_TX = 'txid_rdx1hcvpwxj0hyp65mud2xnvumughqn00fdnq5jsgek7p6dz8u9lg26q9u0dga';
    const MAINNET_ACC = 'account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6';

    it('detects stokenet and mainnet from Bech32m addresses and transaction hashes', () => {
        expect(isRadixAddress(STOKENET_TX)).toBe(true);
        expect(detectAddressNetwork(STOKENET_TX)).toBe('stokenet');
        expect(detectAddressNetwork(STOKENET_ACC)).toBe('stokenet');
        expect(detectAddressNetwork(STOKENET_COMP)).toBe('stokenet');

        expect(detectAddressNetwork(MAINNET_TX)).toBe('mainnet');
        expect(detectAddressNetwork(MAINNET_ACC)).toBe('mainnet');

        expect(detectAddressNetwork('validator name')).toBeNull();
        expect(detectAddressNetwork('account_')).toBeNull();
        expect(detectAddressNetwork('')).toBeNull();
    });

    it('switches automatically from mainnet to stokenet when a stokenet txid or address is entered', () => {
        focusEntityMock.mockClear();
        const { result } = renderHook(() =>
            useDashboardUrlSync({
                initialView: 'transactions',
                initialNetwork: 'mainnet',
                initialSearchQuery: '',
                locale: 'es',
            }),
        );

        expect(result.current.network).toBe('mainnet');

        act(() => {
            result.current.setSearchQuery(STOKENET_TX);
        });

        expect(result.current.network).toBe('stokenet');
        expect(focusEntityMock).toHaveBeenCalledWith(STOKENET_TX, 'stokenet');
    });

    it('switches automatically from stokenet to mainnet when a mainnet address is entered', () => {
        focusEntityMock.mockClear();
        const { result } = renderHook(() =>
            useDashboardUrlSync({
                initialView: 'transactions',
                initialNetwork: 'stokenet',
                initialSearchQuery: '',
                locale: 'es',
            }),
        );

        expect(result.current.network).toBe('stokenet');

        act(() => {
            result.current.setSearchQuery(MAINNET_ACC);
        });

        expect(result.current.network).toBe('mainnet');
        expect(focusEntityMock).toHaveBeenCalledWith(MAINNET_ACC, 'mainnet');
    });

    it('clears search and persists ranking in URL when clicking top_accounts after searching a txid', () => {
        focusEntityMock.mockClear();
        setRankingMock.mockClear();
        const { result } = renderHook(() =>
            useDashboardUrlSync({
                initialView: 'transactions',
                initialNetwork: 'mainnet',
                initialSearchQuery: '',
                locale: 'es',
            }),
        );

        act(() => {
            result.current.setSearchQuery(STOKENET_TX);
        });
        expect(result.current.network).toBe('stokenet');
        expect(result.current.searchQuery).toBe(STOKENET_TX);

        act(() => {
            result.current.handleRankingChange('top_accounts');
        });
        expect(result.current.searchQuery).toBe('');
        expect(result.current.activeRanking).toBe('top_accounts');
        expect(setRankingMock).toHaveBeenCalledWith('top_accounts', 'stokenet');

        // Verify URL round-trip of ranking query param
        expect(serializeDashboardQuery({ network: 'stokenet', ranking: 'top_accounts' }))
            .toBe('?network=stokenet&ranking=top_accounts');
        expect(parseDashboardQuery({ network: 'stokenet', ranking: 'top_accounts' }).ranking)
            .toBe('top_accounts');
    });
});
