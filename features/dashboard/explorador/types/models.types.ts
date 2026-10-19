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
    /** The pool a pool unit redeems from. */
    poolAddress?: string;
    isClaim: boolean;
    ids?: string[];
    isNft: boolean;
    claimXrdTotal?: number;
    isOwnerBadge?: boolean;
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
  /** What the price is quoted in; '' when the manifest does not say. */
  quoteToken: string;
  price: string;
}

/** The oracle call behind a set of price updates. */
export interface OracleCall {
  component: string;
  method: string;
  /** The resource every price is quoted in (the one the call prices at exactly 1), when there is one. */
  reference: string | null;
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
  /** Local ids of the badge, when the proof is of non-fungibles. */
  badgeNftIds: string[];
  oracleUpdates: OracleUpdate[];
  oracleCall: OracleCall | null;
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
