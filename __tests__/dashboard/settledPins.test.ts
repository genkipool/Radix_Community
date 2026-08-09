/**
 * The wallet's pinned validators must never flicker through "none".
 *
 * Which validators belong to the connected wallet decides which cards go first
 * and, with the wallet filter on, which cards exist at all. It is re-read on
 * every wallet-side move — the toolbar's ledger toggle, the toggle inside the
 * connect popover, the one in the profile modal (which swaps the whole account
 * list), picking different accounts — and each of those re-reads reports an
 * empty set on its way to the answer.
 *
 * Believed literally, that empty moment paints skeletons over a grid that had
 * cards a frame ago, and with the filter on it announces that no staking nodes
 * were found. These assertions keep the last settled answer standing until the
 * next one exists, so no path can reopen that gap.
 */

import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettledPins, type Pins } from '@/features/dashboard/staking/hooks/useSettledPins';

const pins = (pinned: string[], owners: string[] = []): Pins => ({
    pinnedValidatorAddresses: pinned,
    ownerValidatorAddresses: owners,
});

const EMPTY = pins([]);
const MAINNET = pins(['validator_a', 'validator_b'], ['validator_a']);
const STOKENET = pins(['validator_t']);

describe('the wallet\'s pinned validators', () => {
    it('holds the last answer while a new one is being read', () => {
        const { result, rerender } = renderHook(
            ({ value, loading }: { value: Pins; loading: boolean }) => useSettledPins(value, loading),
            { initialProps: { value: MAINNET, loading: false } },
        );
        expect(result.current.pinnedValidatorAddresses).toEqual(['validator_a', 'validator_b']);

        // A wallet-side move: the read restarts and reports nothing yet.
        rerender({ value: EMPTY, loading: true });
        expect(result.current.pinnedValidatorAddresses).toEqual(['validator_a', 'validator_b']);
        expect(result.current.ownerValidatorAddresses).toEqual(['validator_a']);
    });

    it('adopts the new answer once it settles', () => {
        const { result, rerender } = renderHook(
            ({ value, loading }: { value: Pins; loading: boolean }) => useSettledPins(value, loading),
            { initialProps: { value: MAINNET, loading: false } },
        );

        rerender({ value: EMPTY, loading: true });
        rerender({ value: STOKENET, loading: false });

        expect(result.current.pinnedValidatorAddresses).toEqual(['validator_t']);
        expect(result.current.ownerValidatorAddresses).toEqual([]);
    });

    it('reports a genuinely empty answer once it has settled', () => {
        // A wallet with nothing staked on this ledger is a real answer, not a
        // gap: holding the previous ledger's pins forever would be a lie.
        const { result, rerender } = renderHook(
            ({ value, loading }: { value: Pins; loading: boolean }) => useSettledPins(value, loading),
            { initialProps: { value: MAINNET, loading: false } },
        );

        rerender({ value: EMPTY, loading: true });
        rerender({ value: EMPTY, loading: false });

        expect(result.current.pinnedValidatorAddresses).toEqual([]);
    });

    it('starts empty when nothing has ever been read', () => {
        const { result } = renderHook(() => useSettledPins(EMPTY, true));
        expect(result.current.pinnedValidatorAddresses).toEqual([]);
    });

    it('survives arrays rebuilt with the same contents', () => {
        // Each read builds fresh arrays, so identity changes every render; only
        // a change in CONTENT may count as a new answer.
        const { result, rerender } = renderHook(
            ({ value, loading }: { value: Pins; loading: boolean }) => useSettledPins(value, loading),
            { initialProps: { value: pins(['validator_a']), loading: false } },
        );
        rerender({ value: pins(['validator_a']), loading: false });
        rerender({ value: pins(['validator_a']), loading: false });

        expect(result.current.pinnedValidatorAddresses).toEqual(['validator_a']);
    });
});
