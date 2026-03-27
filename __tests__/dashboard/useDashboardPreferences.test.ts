import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardPreferences } from '@/features/dashboard/hooks/useDashboardPreferences';

// Mock cookies
vi.mock('@/utils/cookies', () => ({
    setCookie: vi.fn(),
}));

import { setCookie } from '@/utils/cookies';
import { COOKIE_KEYS } from '@/constants/dashboard';

describe('useDashboardPreferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        initialValSortMode: 'newest' as const,
        initialTxSortMode: 'oldest' as const,
        initialValColumns: 3,
        initialTxColumns: 2,
        initialValReadingMode: false,
        initialTxReadingMode: false,
        initialValAutoCollapse: true,
        initialTxAutoCollapse: true,
        initialActiveTag: ['all'],
        initialTransactionActiveTag: 'stake',
    };

    it('initializes with provided props', () => {
        const { result } = renderHook(() => useDashboardPreferences(defaultProps));

        expect(result.current.valSortMode).toBe('newest');
        expect(result.current.txSortMode).toBe('oldest');
        expect(result.current.valColumns).toBe(3);
        expect(result.current.activeTag).toEqual(['all']);
    });

    it('updates state and calls setCookie when preferences change', () => {
        const { result } = renderHook(() => useDashboardPreferences(defaultProps));

        // Initial render calls setCookie for all 10 props
        expect(setCookie).toHaveBeenCalledTimes(10);
        vi.clearAllMocks();

        // Change one preference
        act(() => {
            result.current.setValColumns(4);
        });

        // State updated
        expect(result.current.valColumns).toBe(4);
        
        // setCookie called with new value
        expect(setCookie).toHaveBeenCalledWith(COOKIE_KEYS.valColumns, '4', 604800);
        expect(setCookie).toHaveBeenCalledTimes(1);
    });

    it('updates boolean and string preferences correctly', () => {
        const { result } = renderHook(() => useDashboardPreferences(defaultProps));
        vi.clearAllMocks();

        act(() => {
            result.current.setValReadingMode(true);
            result.current.setActiveTag(['favoritos']);
        });

        expect(result.current.valReadingMode).toBe(true);
        expect(result.current.activeTag).toEqual(['favoritos']);
        
        expect(setCookie).toHaveBeenCalledWith(COOKIE_KEYS.valReadingMode, 'true', 604800);
        expect(setCookie).toHaveBeenCalledWith(COOKIE_KEYS.activeTag, 'favoritos', 604800);
    });
});
