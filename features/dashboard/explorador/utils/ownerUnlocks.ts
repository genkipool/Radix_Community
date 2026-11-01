import { EPOCH_MS } from './validatorOwnerActions';

/** One part of the owner's LSUs waiting out the unlock period, as the validator's state lists it. */
export interface PendingOwnerUnlock {
    epoch_unlocked: number;
    stake_unit_amount: string;
}

export interface OwnerUnlockSummary {
    /** LSUs still locked: the parts whose epoch has not come. */
    unlocking: number;
    /** How many parts those are. */
    parts: number;
    /** Epoch the first of them becomes available. */
    nextEpoch: number;
    /** Epoch the last of them does. */
    lastEpoch: number;
}

/**
 * What a validator's owner has in the unlock period right now, from the state's
 * pending list. Parts whose epoch has passed are left out: they are ready, not
 * unlocking, and nothing more is waited for. Null when nothing is.
 */
export function summarizeOwnerUnlocks(pending: PendingOwnerUnlock[] | undefined, currentEpoch: number): OwnerUnlockSummary | null {
    const waiting = (pending ?? []).filter(p => p.epoch_unlocked > currentEpoch);
    if (waiting.length === 0) return null;
    const epochs = waiting.map(p => p.epoch_unlocked);
    return {
        unlocking: waiting.reduce((sum, p) => sum + (parseFloat(p.stake_unit_amount) || 0), 0),
        parts: waiting.length,
        nextEpoch: Math.min(...epochs),
        lastEpoch: Math.max(...epochs),
    };
}

/** The moment an epoch starts, worked out from the ledger's clock at `currentEpoch`. */
export function epochDate(epoch: number, currentEpoch: number, ledgerTime: string | number | Date): Date {
    return new Date(new Date(ledgerTime).getTime() + (epoch - currentEpoch) * EPOCH_MS);
}
