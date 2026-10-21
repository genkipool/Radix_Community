/**
 * features/dashboard/explorador/utils/validatorOwnerActions.ts
 *
 * The actions a validator's OWNER takes on the validator itself — the methods
 * only the owner badge can call: lock and unlock the owner's own stake, register
 * or unregister, rotate the key, set the fee, accept or refuse delegated stake.
 * They are not stakes, unstakes or claims of delegators, so the stake cards
 * leave them out, and most move no assets at all.
 *
 * Everything shown is read from the transaction itself: the method and its
 * arguments from the manifest, what changed from the validator's own state in
 * the receipt (before and after), and amounts that moved from the receipt's
 * events. Pure helpers: no React, no requests.
 */

import { methodCalls } from './parseManifest';
import { callArguments } from './componentCall';

export type OwnerActionKind =
    | 'start_unlock'
    | 'finish_unlock'
    | 'lock'
    | 'register'
    | 'unregister'
    | 'update_key'
    | 'update_fee'
    | 'accept_delegated';

const KIND_BY_METHOD: Record<string, OwnerActionKind> = {
    start_unlock_owner_stake_units: 'start_unlock',
    finish_unlock_owner_stake_units: 'finish_unlock',
    lock_owner_stake_units: 'lock',
    register: 'register',
    unregister: 'unregister',
    update_key: 'update_key',
    update_fee: 'update_fee',
    update_accept_delegated_stake: 'accept_delegated',
};

/** A Radix epoch lasts about five minutes; enough to put a date on an epoch a few days away. */
export const EPOCH_MS = 5 * 60 * 1000;

interface PendingUnlock {
    epoch_unlocked: number;
    stake_unit_amount: string;
}

/** The parts of a validator's state the actions touch. */
interface ValidatorState {
    public_key?: { key_hex?: string };
    is_registered?: boolean;
    validator_fee_factor?: string;
    validator_fee_change_request?: { new_fee_factor?: string; epoch_effective?: number } | null;
    accepts_delegated_stake?: boolean;
    pending_owner_stake_unit_withdrawals?: PendingUnlock[];
    pending_owner_stake_unit_unlock_vault?: { entity_address?: string };
    locked_owner_stake_unit_vault?: { entity_address?: string };
}

interface StateSubstate {
    substate_id?: { entity_address?: string; substate_type?: string };
    previous_value?: { substate_data?: { value?: ValidatorState } };
    new_value?: { substate_data?: { value?: ValidatorState } };
}

interface ReceiptEvent {
    name?: string;
    emitter?: { entity?: { entity_address?: string } };
    data?: { fields?: { field_name?: string; value?: string }[] };
}

export interface OwnerAction {
    kind: OwnerActionKind;
    validator: string;
    /** LSUs moved: locked, put into unlocking, or taken out of it. */
    amount?: number;
    /** start_unlock: the epoch the LSUs become available, and how many epochs away that is. */
    unlockEpoch?: number;
    unlockEpochsAway?: number;
    /** start_unlock: everything the owner now has unlocking, and in how many parts. */
    unlockingTotal?: number;
    unlockingParts?: number;
    registered?: { before: boolean | null; after: boolean | null };
    key?: { before: string | null; after: string | null };
    fee?: {
        /** Fee before and the one asked for, as fractions (0.02 = 2 %). */
        before: number | null;
        requested: number;
        /** True when it already applies (a cut); otherwise it takes effect at `effectiveEpoch`. */
        appliedNow: boolean;
        effectiveEpoch: number | null;
    };
    accepts?: { before: boolean | null; after: boolean };
}

const num = (value: string | undefined | null) => {
    const n = Number(value);
    return value !== undefined && value !== null && Number.isFinite(n) ? n : null;
};

/** The validator's field state before and after, from the receipt. */
function stateOf(validator: string, substates: StateSubstate[]): { before: ValidatorState; after: ValidatorState } {
    const entry = substates.find(s => s.substate_id?.entity_address === validator && s.substate_id?.substate_type === 'ValidatorFieldState');
    return {
        before: entry?.previous_value?.substate_data?.value ?? {},
        after: entry?.new_value?.substate_data?.value ?? {},
    };
}

/** What went into or out of a vault: the amount of its deposit or withdrawal event. */
function movedThrough(vault: string | undefined, event: 'DepositEvent' | 'WithdrawEvent', events: ReceiptEvent[]): number | undefined {
    if (!vault) return undefined;
    const found = events.find(e => e.name?.includes(event) && e.emitter?.entity?.entity_address === vault);
    return num(found?.data?.fields?.find(f => f.field_name === 'amount')?.value) ?? undefined;
}

export function extractValidatorOwnerActions(input: {
    manifest: string | undefined;
    substates: StateSubstate[] | undefined;
    events: ReceiptEvent[] | undefined;
    /** The epoch the transaction ran in. */
    epoch: number | undefined;
    /** What each entity gained or lost: the validator itself gains the LSUs an owner locks. */
    balanceChanges?: { fungible_balance_changes?: { entity_address?: string; balance_change?: string }[] };
}): OwnerAction[] {
    const { manifest, substates = [], events = [], epoch, balanceChanges } = input;
    const actions: OwnerAction[] = [];

    for (const call of methodCalls(manifest ?? '')) {
        const kind = KIND_BY_METHOD[call.method];
        if (!kind || !call.target.startsWith('validator_')) continue;

        const validator = call.target;
        const args = callArguments(call.body, call.method);
        const { before, after } = stateOf(validator, substates);
        const action: OwnerAction = { kind, validator };

        if (kind === 'lock') {
            // The LSUs arrive as a bucket, so the amount is what the validator gained: the receipt
            // shows it as the validator's own balance change (its state is not rewritten by a lock).
            const gained = (balanceChanges?.fungible_balance_changes ?? [])
                .filter(c => c.entity_address === validator)
                .reduce((sum, c) => sum + Math.max(0, num(c.balance_change) ?? 0), 0);
            action.amount = (gained > 0 ? gained : undefined)
                ?? movedThrough(after.locked_owner_stake_unit_vault?.entity_address, 'DepositEvent', events)
                ?? num(args.find(a => a.kind === 'decimal')?.value) ?? undefined;
        } else if (kind === 'start_unlock') {
            action.amount = num(args.find(a => a.kind === 'decimal')?.value) ?? undefined;
            const known = new Set((before.pending_owner_stake_unit_withdrawals ?? []).map(p => p.epoch_unlocked));
            const added = (after.pending_owner_stake_unit_withdrawals ?? []).filter(p => !known.has(p.epoch_unlocked));
            const unlockEpoch = added.length > 0 ? Math.max(...added.map(p => p.epoch_unlocked)) : undefined;
            if (unlockEpoch !== undefined) {
                action.unlockEpoch = unlockEpoch;
                if (epoch !== undefined) action.unlockEpochsAway = unlockEpoch - epoch;
            }
            const parts = after.pending_owner_stake_unit_withdrawals ?? [];
            if (parts.length > 0) {
                action.unlockingParts = parts.length;
                action.unlockingTotal = parts.reduce((sum, p) => sum + (num(p.stake_unit_amount) ?? 0), 0);
            }
        } else if (kind === 'finish_unlock') {
            action.amount = movedThrough(after.pending_owner_stake_unit_unlock_vault?.entity_address, 'WithdrawEvent', events);
        } else if (kind === 'register' || kind === 'unregister') {
            action.registered = { before: before.is_registered ?? null, after: after.is_registered ?? null };
        } else if (kind === 'update_key') {
            const given = call.body.match(/Bytes\("([0-9a-f]+)"\)/i)?.[1] ?? null;
            action.key = { before: before.public_key?.key_hex ?? null, after: after.public_key?.key_hex ?? given };
        } else if (kind === 'update_fee') {
            const requested = num(args.find(a => a.kind === 'decimal')?.value);
            if (requested === null) continue;
            action.fee = {
                before: num(before.validator_fee_factor),
                requested,
                appliedNow: num(after.validator_fee_factor) === requested,
                effectiveEpoch: after.validator_fee_change_request?.epoch_effective ?? null,
            };
        } else if (kind === 'accept_delegated') {
            const value = args.find(a => a.kind === 'bool')?.value;
            if (value === undefined) continue;
            action.accepts = { before: before.accepts_delegated_stake ?? null, after: value === 'true' };
        }

        actions.push(action);
    }
    return actions;
}
