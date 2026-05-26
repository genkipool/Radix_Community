import type { GatewayEntityDetails } from '@/features/dashboard/types';

/** 
 * Entity and Business models transformed for internal logic
 * Specific to the Explorer (explorador) feature.
 */

// Helper types for resource items
export type FungibleItem = Exclude<GatewayEntityDetails['fungible_resources'], undefined>['items'][number];
export type NonFungibleItem = Exclude<GatewayEntityDetails['non_fungible_resources'], undefined>['items'][number];

export interface ParsedResource {
    address: string;
    name: string;
    symbol: string;
    iconUrl: string;
    amount: string;
    isPoolUnit: boolean;
    isLsu: boolean;
    validatorAddress?: string;
    validatorName?: string;
    isClaim: boolean;
    ids?: string[];
    isNft: boolean;
}

export interface StakingEntry {
    validatorName: string;
    validatorIcon: string;
    validatorAddress: string;
    xrdInStake: number;
    xrdInUnstake: number;
    xrdInClaim: number;
    unstakes: { amount: number; epoch: number }[];
}

export interface OracleUpdate {
  baseToken: string;
  quoteToken: string;
  price: string;
}

export interface AirdropData {
  component: string;
  eventId: string;
  account: string;
  amount: string;
  resource: string | null;
}

export interface ParsedManifest {
  lockFeeAmount: string | null;
  lockFeeAccount: string | null;
  mainAction: string | null;
  nftId: string | null;
  badgeResource: string | null;
  badgeAmount: string | null;
  badgeOrigin: string | null;
  oracleUpdates: OracleUpdate[];
  candiesMatch: RegExpMatchArray | null;
}

/** Visual style tokens for the "Received via:" source badge */
export interface SourceStyle {
  method: string;
  title: string;
  color: string;
  bg: string;
}

/** 
 * Transaction Event structure from Gateway API
 * Used to replace 'any' in details components
 */
export interface TransactionEvent {
  name: string;
  data: {
    fields: Array<{
      field_name?: string;
      value: unknown;
      kind: string;
      elements?: Array<{ kind?: string; value?: string; field_name?: string; fields?: Array<{ field_name?: string; value?: string; kind?: string }> }>;
    }>;
  };
}
