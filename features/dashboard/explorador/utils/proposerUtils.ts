/**
 * proposerUtils.ts
 *
 * Extracts the proposer validator index from a committed transaction receipt.
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
 */

import type { TransactionDetails } from '@/features/dashboard/types';
import type { Validator } from '@/types/radix';

/* ── Internal types for the raw substate structure ────────────────── */
interface ProposerRewardEntry {
    xrd_amount: string;
    validator_index: { index: number };
}

interface SubstateValue {
    proposer_rewards?: ProposerRewardEntry[];
    [key: string]: unknown;
}

interface UpdatedSubstate {
    new_value?: {
        substate_data?: {
            value?: SubstateValue;
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
}

/**
 * Extracts the `proposer_rewards` array from the consensus manager state update
 * inside the transaction receipt.
 */
function extractProposerRewards(details: TransactionDetails): ProposerRewardEntry[] {
    const substates = (details.receipt as Record<string, unknown>)
        ?.state_updates as Record<string, unknown> | undefined;
    const updated = (substates?.updated_substates as UpdatedSubstate[]) ?? [];

    for (const entry of updated) {
        const rewards = entry?.new_value?.substate_data?.value?.proposer_rewards;
        if (Array.isArray(rewards) && rewards.length > 0) {
            return rewards;
        }
    }
    return [];
}

/**
 * Resolves the proposer validator for a given transaction.
 *
 * Algorithm:
 * 1. Read `fee_destination.to_proposer` (the XRD reward string).
 * 2. Extract `proposer_rewards` from the consensus manager state update.
 * 3. Match the amount to find the validator_index.
 * 4. Return { validatorIndex, rank, rewardAmount }.
 *
 * Returns `null` if the proposer cannot be determined.
 */
export function resolveProposerInfo(details: TransactionDetails | null | undefined): ProposerInfo | null {
    if (!details?.receipt) return null;

    // Step 1: Get the to_proposer amount from fee_destination
    const fd = details.receipt.fee_destination;
    if (!fd) return null;

    const toProposerRaw = fd.to_proposer ?? fd.toProposer;
    const toProposerAmt = typeof toProposerRaw === 'string'
        ? toProposerRaw
        : (toProposerRaw as Record<string, string> | undefined)?.xrd_amount;

    if (!toProposerAmt || toProposerAmt === '0') return null;

    // Step 2: Extract proposer_rewards from state_updates
    const rewards = extractProposerRewards(details);
    if (rewards.length === 0) return null;

    // Step 3: Match the LAST item in the array to see if it's the proposer
    const lastReward = rewards[rewards.length - 1];
    if (!lastReward || lastReward.xrd_amount !== toProposerAmt) {
        return null;
    }

    const validatorIndex = lastReward.validator_index.index;

    return {
        validatorIndex,
        rank: validatorIndex + 1,
        rewardAmount: toProposerAmt,
    };
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
