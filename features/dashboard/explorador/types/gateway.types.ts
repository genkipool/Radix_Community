import { FungibleChange, NonFungibleChange } from '../../types/shared.types';

export type { FungibleChange, NonFungibleChange };

export interface FeeChange {
  entity_address: string;
  resource_address: string;
  balance_change: string;
  type?: string;
}

export interface BalanceChanges {
  fungible_balance_changes?: FungibleChange[];
  non_fungible_balance_changes?: NonFungibleChange[];
  fungible_fee_balance_changes?: FeeChange[];
}

export interface RoyaltyRecipientObj {
    royalty_recipient?: { entity_address?: string; entityAddress?: string };
    recipient_address?: string;
    recipientAddress?: string;
    recipient_component_address?: string;
    xrd_amount?: string;
    xrdAmount?: string;
    amount?: string;
}

export interface ValidatorSetObj {
    shares?: Array<Record<string, unknown>>;
    xrd_amount?: string;
    xrdAmount?: string;
}

export interface ValueWithXrd {
    xrd_amount?: string;
    xrdAmount?: string;
}
