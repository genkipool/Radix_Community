/**
 * features/dashboard/explorador/utils/transactionUtils.ts
 *
 * Centralized logic for resolving transaction types and flags
 * to avoid duplication across components.
 */

import type { TranslationsT } from '@/features/dashboard/types';

/**
 * Returns a standardized string for the given transaction, checking
 * its manifest classes and events against a set of rules.
 */
export function resolveTransactionType(
    classes: string[],
    events: { name?: string }[],
    tt: Partial<TranslationsT['dashboard']['transactions']>
): string {
    if (classes.includes('ProtocolVote') || events.some((e) => e.name === 'ProtocolUpdateReadinessSignalEvent')) {
        return tt.tx_type_protocol_vote || 'Protocol Vote';
    }
    if (classes.length === 0) return tt.tx_type_general || 'General';
    
    const c = classes[0];
    if (c === 'ValidatorStake')    return tt.tx_type_stake    || 'Stake';
    if (c === 'ValidatorUnstake')  return tt.tx_type_unstake  || 'Unstake';
    if (c === 'ValidatorClaimXrd' || c === 'ValidatorClaim') return tt.tx_type_claim || 'Claim';
    if (c === 'Transfer')          return tt.tx_type_transfer || 'Transfer';
    if (c === 'AccountDepositSettingsUpdate') return tt.tx_type_settings || 'Settings';
    
    return c || (tt.tx_type_general || 'General');
}

/**
 * Returns a set of boolean flags derived from the transaction's primary manifest class.
 * Useful for determining how to render operation-specific panels (e.g., stake, unstake).
 */
export function getTransactionFlags(classes: string[]) {
    const primaryClass = classes[0] ?? '';
    return {
        isStake: primaryClass === 'ValidatorStake',
        isUnstake: primaryClass === 'ValidatorUnstake',
        isClaim: primaryClass === 'ValidatorClaimXrd' || primaryClass === 'ValidatorClaim',
        isTransfer: primaryClass === 'Transfer',
    };
}
