/** The validator state's request to change the commission, kept after it has taken effect too. */
export interface FeeChangeRequest {
    new_fee_factor?: string;
    epoch_effective?: number;
}

export interface PendingFeeChange {
    /** Percent. */
    current: number;
    next: number;
    /** Epoch the new commission applies from. */
    epoch: number;
}

/**
 * The commission change still waiting to take effect. The state keeps the last
 * request after it has applied, so one whose epoch has come is not pending: it
 * is already the commission in force. Null when none waits.
 */
export function pendingFeeChange(
    state: { validator_fee_factor?: string; validator_fee_change_request?: FeeChangeRequest | null } | undefined,
    currentEpoch: number,
): PendingFeeChange | null {
    const request = state?.validator_fee_change_request;
    if (!request || request.epoch_effective === undefined || request.epoch_effective <= currentEpoch) return null;
    const next = parseFloat(request.new_fee_factor ?? '');
    const current = parseFloat(state?.validator_fee_factor ?? '');
    if (!Number.isFinite(next) || !Number.isFinite(current)) return null;
    // Factors are fractions; the page speaks in percent.
    return { current: current * 100, next: next * 100, epoch: request.epoch_effective };
}
