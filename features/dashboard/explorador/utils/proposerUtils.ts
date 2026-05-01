/**
 * proposerUtils.ts
 *
 * Unified proposer resolution for Radix transactions.
 *
 * The Radix Gateway API returns `proposer_rewards` inside the consensus manager
 * state update substate at:
 *   receipt.state_updates.updated_substates[].new_value.substate_data.value.proposer_rewards
 *
 * Each entry has { xrd_amount: string, validator_index: { index: number } }.
 * We match `fee_destination.to_proposer` (a string amount) against those entries
 * to identify WHICH validator proposed this round.
 *
 * The validator's index is 0-based in the active set, so rank = index + 1.
 *
 * This module exports a single shared algorithm (`resolveProposerFromReceipt`)
 * consumed by both:
 *   - `resolveProposerInfo()` → client-side detail views (TransactionDetails)
 *   - `transactions.ts`       → server-side stream parsing (GatewayItem)
 */

import type { TransactionDetails } from '@/features/dashboard/types';
import type { Validator } from '@/types/radix';

/* ── Shared types for the raw substate structure ─────────────────── */
export interface ProposerRewardEntry {
    xrd_amount: string;
    validator_index: { index: number };
}

interface UpdatedSubstate {
    new_value?: {
        substate_data?: {
            value?: {
                proposer_rewards?: ProposerRewardEntry[];
                [key: string]: unknown;
            };
        };
    };
    previous_value?: {
        substate_data?: {
            value?: {
                proposer_rewards?: ProposerRewardEntry[];
                [key: string]: unknown;
            };
        };
    };
    [key: string]: unknown;
}

/* ── Public result type ───────────────────────────────────────────── */
export interface ProposerInfo {
    /** 0-based index of the proposer in the active validator set */
    validatorIndex: number;
    /** 1-based rank (index + 1) matching the validators list rank field */
    rank: number;
    /** Amount of XRD rewarded to the proposer */
    rewardAmount: string;
    /** Pre-enriched display fields (resolved server-side from validators cache or Redis) */
    name?: string;
    iconUrl?: string;
    address?: string;
}

/* ── Minimal receipt shape accepted by the shared algorithm ───────── */
export interface ReceiptLike {
    fee_destination?: {
        to_proposer?: string | { xrd_amount?: string };
        toProposer?: string | { xrd_amount?: string };
    };
    state_updates?: {
        updated_substates?: UpdatedSubstate[];
    };
}

/* ── Constants ───────────────────────────────────────────────────── */
const DELTA_EPSILON = 0.000000000001;

// ─────────────────────────────────────────────────────────────────────────────
// resolveProposerFromReceipt  (SHARED CORE ALGORITHM)
//
// Works on any object with `fee_destination` and `state_updates.updated_substates`.
// Both GatewayItem.receipt and TransactionDetails.receipt satisfy this shape.
//
// Algorithm:
// 1. Read `fee_destination.to_proposer` (the XRD reward expected for this tx).
// 2. Extract both `new_value` and `previous_value` rewards for all validators.
// 3. For each index `i`, calculate the increase (delta):
//    delta = newRewards[i].xrd_amount - (previousRewards[i]?.xrd_amount || 0)
// 4. Match the delta against `to_proposer` to identify the proposer.
//
// Returns `null` if the proposer cannot be determined.
// ─────────────────────────────────────────────────────────────────────────────
export function resolveProposerFromReceipt(
    receipt: ReceiptLike | null | undefined,
): ProposerInfo | null {
    if (!receipt?.fee_destination) return null;

    const fd = receipt.fee_destination;
    const toProposerRaw = fd.to_proposer ?? fd.toProposer;
    const toProposerAmtStr = typeof toProposerRaw === 'string'
        ? toProposerRaw
        : (toProposerRaw as { xrd_amount?: string } | undefined)?.xrd_amount;

    if (!toProposerAmtStr || toProposerAmtStr === '0') return null;

    const targetDelta = parseFloat(toProposerAmtStr);

    // Extract proposer_rewards (new and previous)
    const updated = (receipt.state_updates?.updated_substates as UpdatedSubstate[]) ?? [];

    let newRewards: ProposerRewardEntry[] = [];
    let previousRewards: ProposerRewardEntry[] = [];

    for (const entry of updated) {
        const nr = entry?.new_value?.substate_data?.value?.proposer_rewards;
        if (Array.isArray(nr) && nr.length > 0) {
            newRewards = nr;
            previousRewards = entry?.previous_value?.substate_data?.value?.proposer_rewards ?? [];
            break;
        }
    }

    if (newRewards.length === 0) return null;

    // Identify the index where the reward increased by the targetDelta
    for (let i = 0; i < newRewards.length; i++) {
        const nr = newRewards[i];
        const pr = previousRewards[i];

        const newAmt = parseFloat(nr.xrd_amount);
        const prevAmt = pr ? parseFloat(pr.xrd_amount) : 0;
        const delta = newAmt - prevAmt;

        if (Math.abs(delta - targetDelta) < DELTA_EPSILON) {
            const validatorIndex = nr.validator_index.index;
            return {
                validatorIndex,
                rank: validatorIndex + 1,
                rewardAmount: toProposerAmtStr,
            };
        }
    }

    return null;
}

/**
 * Resolves the proposer validator for a given transaction detail object.
 *
 * Thin wrapper over `resolveProposerFromReceipt` that accepts the
 * full `TransactionDetails` type used by client-side detail views.
 */
export function resolveProposerInfo(
    details: TransactionDetails | null | undefined,
): ProposerInfo | null {
    if (!details?.receipt) return null;
    return resolveProposerFromReceipt(details.receipt as ReceiptLike);
}

/**
 * Finds the proposer validator from the cached validators list using the
 * resolved proposer info.
 *
 * @param proposerInfo - Result from `resolveProposerInfo`.
 * @param validators   - The full validators list (from React Query cache).
 * @returns The matched `Validator` or `null`.
 */
export function findProposerValidator(
    proposerInfo: ProposerInfo,
    validators: Validator[],
): Validator | null {
    // Primary: match by rank (most reliable)
    const byRank = validators.find(v => v.rank === proposerInfo.rank);
    if (byRank) return byRank;

    // Fallback: index-based access (if ranks are 1:1 with array position)
    const byIndex = validators[proposerInfo.validatorIndex];
    return byIndex ?? null;
}
