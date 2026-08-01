import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFocusedColumns } from '@/features/dashboard/hooks/useFocusedColumns';

const VALIDATOR = 'validator_rdx1sdvntpsfvlyx2hapn5zfr6z7etfwgqljsqdqh23876r33fpd8cvu5j';
const ACCOUNT = 'account_rdx12xt7t4kxhujrp0pjw828v30ejhkxux8zpfesxz6tu6h9vdw9fzc78r';

describe('useFocusedColumns', () => {
    it('collapses to one column when a validator page is opened directly', () => {
        const { result } = renderHook(() => useFocusedColumns(VALIDATOR, 4));
        expect(result.current.columns).toBe(1);
        expect(result.current.isOverridden).toBe(true);
    });

    it('leaves the stored preference alone with no search', () => {
        const { result } = renderHook(() => useFocusedColumns('', 4));
        expect(result.current.columns).toBe(4);
        expect(result.current.isOverridden).toBe(false);
    });

    it('collapses when a validator address is typed into the search box', () => {
        const { result, rerender } = renderHook(
            ({ q }) => useFocusedColumns(q, 3),
            { initialProps: { q: '' } },
        );
        expect(result.current.columns).toBe(3);

        rerender({ q: VALIDATOR });
        expect(result.current.columns).toBe(1);
    });

    // The whole reason the override is kept apart from the cookie-backed
    // preference: clearing the box has to give the user their grid back.
    it('restores the configured grid when the search box is cleared', () => {
        const { result, rerender } = renderHook(
            ({ q }) => useFocusedColumns(q, 3),
            { initialProps: { q: VALIDATOR } },
        );
        expect(result.current.columns).toBe(1);

        rerender({ q: '' });
        expect(result.current.columns).toBe(3);
        expect(result.current.isOverridden).toBe(false);
    });

    it('ignores whitespace around a pasted address', () => {
        const { result } = renderHook(() => useFocusedColumns(`  ${VALIDATOR}  `, 5));
        expect(result.current.columns).toBe(1);
    });

    it('only reacts to validators, not to other entity kinds or free text', () => {
        expect(renderHook(() => useFocusedColumns(ACCOUNT, 4)).result.current.columns).toBe(4);
        expect(renderHook(() => useFocusedColumns('genkipool', 4)).result.current.columns).toBe(4);
    });

    it('lets a manual column choice win while the focus lasts', () => {
        const { result, rerender } = renderHook(
            ({ cols }) => useFocusedColumns(VALIDATOR, cols),
            { initialProps: { cols: 2 } },
        );
        expect(result.current.columns).toBe(1);

        act(() => result.current.releaseOverride());
        rerender({ cols: 4 });
        expect(result.current.columns).toBe(4);
        expect(result.current.isOverridden).toBe(false);
    });

    it('collapses again on the next validator after a manual override', () => {
        const { result, rerender } = renderHook(
            ({ q }) => useFocusedColumns(q, 2),
            { initialProps: { q: VALIDATOR } },
        );
        act(() => result.current.releaseOverride());
        expect(result.current.columns).toBe(2);

        // Leaving and re-entering focus is a fresh decision, not a remembered one.
        rerender({ q: '' });
        rerender({ q: VALIDATOR });
        expect(result.current.columns).toBe(1);
    });
});
