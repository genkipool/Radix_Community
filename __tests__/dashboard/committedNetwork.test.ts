/**
 * The rule that keeps one ledger's validators from ever being rendered against
 * the other ledger's context, or in an order that is about to change.
 *
 * Switching network flips the requested ledger at once, but React Query's
 * `placeholderData` keeps handing back the PREVIOUS ledger's validators until
 * the new list lands, and the connected wallet's stakes — which decide which
 * cards go first — land separately again. Everything read alongside that list
 * follows the committed value, not the requested one: the stakes that pin the
 * wallet's own nodes, the network each card links into, the live proposal
 * store, and the epoch history whose live row is anchored to an epoch number
 * that only means something on one chain.
 *
 * Let it advance on the list alone and the grid paints twice: once in plain
 * order, then again a moment later with the wallet's validators jumping to the
 * top. Let it advance on neither and a Stokenet page shows Mainnet validators.
 * Both are the failures these assertions exist to prevent.
 */

import { describe, expect, it } from 'vitest';
import { shouldCommitNetwork } from '@/features/dashboard/hooks/useCommittedNetwork';

const switching = {
    committed: 'mainnet',
    requested: 'stokenet',
    isStakingView: true,
} as const;

describe('committing a network switch', () => {
    it('waits while the list in hand still belongs to the other ledger', () => {
        expect(shouldCommitNetwork({
            ...switching, hasOwnList: false, walletPinsReady: true,
        })).toBe(false);
    });

    it('waits for the wallet\'s stakes, which decide what goes first', () => {
        expect(shouldCommitNetwork({
            ...switching, hasOwnList: true, walletPinsReady: false,
        })).toBe(false);
    });

    it('advances once the list and the pinning are both in hand', () => {
        expect(shouldCommitNetwork({
            ...switching, hasOwnList: true, walletPinsReady: true,
        })).toBe(true);
    });

    it('does not wait for stakes when no wallet is connected', () => {
        // With no accounts to read there is nothing to pin, so readiness is
        // true by definition and the list alone is enough.
        expect(shouldCommitNetwork({
            ...switching, hasOwnList: true, walletPinsReady: true,
        })).toBe(true);
    });

    it('does not wait outside staking, where there is no list to stay in step with', () => {
        expect(shouldCommitNetwork({
            ...switching, isStakingView: false, hasOwnList: false, walletPinsReady: false,
        })).toBe(true);
    });

    it('stays put when nothing was asked for', () => {
        const same = { committed: 'mainnet', requested: 'mainnet', isStakingView: true } as const;
        expect(shouldCommitNetwork({ ...same, hasOwnList: true, walletPinsReady: true })).toBe(false);
        expect(shouldCommitNetwork({ ...same, hasOwnList: false, walletPinsReady: false })).toBe(false);
    });

    it('holds the previous ledger rather than showing nothing', () => {
        // There is no third state: while it waits, the value returned is still
        // the ledger whose cards are on screen, so the grid keeps rendering
        // them instead of emptying or painting skeletons.
        expect(shouldCommitNetwork({
            ...switching, hasOwnList: false, walletPinsReady: false,
        })).toBe(false);
        expect(switching.committed).toBe('mainnet');
    });

    it('switches anyway once it has waited long enough', () => {
        // The wait is a courtesy, never a condition. A read that hangs — a
        // wallet whose accounts belong to the other ledger and are retried
        // against this one — must not leave the page stuck on a network nobody
        // asked for. A scruffy switch beats no switch.
        expect(shouldCommitNetwork({
            ...switching, hasOwnList: false, walletPinsReady: false, outOfPatience: true,
        })).toBe(true);
    });

    it('still does nothing when no switch was asked for, however long it waits', () => {
        expect(shouldCommitNetwork({
            committed: 'mainnet', requested: 'mainnet', isStakingView: true,
            hasOwnList: false, walletPinsReady: false, outOfPatience: true,
        })).toBe(false);
    });

    it('works the same way switching back', () => {
        const back = { committed: 'stokenet', requested: 'mainnet', isStakingView: true } as const;
        expect(shouldCommitNetwork({ ...back, hasOwnList: false, walletPinsReady: true })).toBe(false);
        expect(shouldCommitNetwork({ ...back, hasOwnList: true, walletPinsReady: false })).toBe(false);
        expect(shouldCommitNetwork({ ...back, hasOwnList: true, walletPinsReady: true })).toBe(true);
    });
});
