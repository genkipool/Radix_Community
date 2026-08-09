/**
 * The rule that keeps one ledger's validators from ever being rendered against
 * the other ledger's context.
 *
 * Switching network flips the requested ledger at once, but React Query's
 * `placeholderData` keeps handing back the PREVIOUS ledger's validators until
 * the new list lands. Everything read alongside that list — the stakes that pin
 * the wallet's own nodes, the live proposal store, the network each card links
 * into, and the epoch history whose live row is anchored to an epoch number
 * that only means something on one chain — follows the committed value, not the
 * requested one.
 *
 * Let it advance early and a Stokenet page shows Mainnet validators with
 * Mainnet epoch numbers for as long as the fetch takes. That is the failure
 * these assertions exist to prevent.
 */

import { describe, expect, it } from 'vitest';
import { shouldCommitNetwork } from '@/features/dashboard/hooks/useCommittedNetwork';

const staking = {
    committed: 'mainnet',
    requested: 'stokenet',
    isStakingView: true,
} as const;

describe('committing a network switch', () => {
    it('waits while the list in hand still belongs to the other ledger', () => {
        expect(shouldCommitNetwork({ ...staking, hasOwnList: false })).toBe(false);
    });

    it('advances as soon as the requested ledger\'s own list is in hand', () => {
        expect(shouldCommitNetwork({ ...staking, hasOwnList: true })).toBe(true);
    });

    it('does not wait outside staking, where there is no list to stay in step with', () => {
        expect(shouldCommitNetwork({
            ...staking, isStakingView: false, hasOwnList: false,
        })).toBe(true);
    });

    it('stays put when nothing was asked for', () => {
        expect(shouldCommitNetwork({
            committed: 'mainnet', requested: 'mainnet', isStakingView: true, hasOwnList: true,
        })).toBe(false);
        expect(shouldCommitNetwork({
            committed: 'mainnet', requested: 'mainnet', isStakingView: true, hasOwnList: false,
        })).toBe(false);
    });

    it('holds the previous ledger rather than showing nothing', () => {
        // There is no third state: while it waits, the value returned is still
        // the ledger whose cards are on screen, so the grid keeps rendering them
        // instead of emptying or painting skeletons.
        const waiting = shouldCommitNetwork({ ...staking, hasOwnList: false });
        expect(waiting).toBe(false);
        // …and the caller therefore keeps using `committed`, which is 'mainnet'.
        expect(staking.committed).toBe('mainnet');
    });

    it('works the same way switching back', () => {
        const back = { committed: 'stokenet', requested: 'mainnet', isStakingView: true } as const;
        expect(shouldCommitNetwork({ ...back, hasOwnList: false })).toBe(false);
        expect(shouldCommitNetwork({ ...back, hasOwnList: true })).toBe(true);
    });
});
