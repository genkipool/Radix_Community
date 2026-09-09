/**
 * Reading validators off the ledger: the shapes the Gateway returns and how to
 * get the facts the validator tools need out of them.
 *
 * Pure parsers only — no transport. The browser hooks call these with the
 * client fetchers and the MCP server calls them with its own, so the field
 * names and the semantics live in exactly one place.
 */

import { mapHoldings } from './account-holdings';
import { getMetadataString, type GatewayMetadataItem } from './metadata-manifests';

/* ─── Gateway response shapes ────────────────────────────────────────────── */

interface EntityDetailsShape {
  metadata?: { items?: GatewayMetadataItem[] };
  ledger_state?: { epoch?: number };
  details?: { state?: GatewayValidatorState };
}

interface GatewayValidatorState {
  is_registered?: boolean;
  accepts_delegated_stake?: boolean;
  validator_fee_factor?: string | number;
  stake_unit_resource_address?: string;
  claim_token_resource_address?: string;
  public_key?: { key_hex?: string };
}

export interface NonFungibleDataItem {
  non_fungible_id: string;
  data?: { programmatic_json?: { fields?: Array<{ field_name?: string; value?: unknown }> } };
}

const dataField = (item: NonFungibleDataItem, name: string) =>
  item.data?.programmatic_json?.fields?.find((entry) => entry.field_name === name)?.value;

export const metadataItemsOf = (details: unknown) =>
  (details as EntityDetailsShape).metadata?.items;

export const epochOf = (details: unknown) =>
  (details as EntityDetailsShape).ledger_state?.epoch ?? 0;

/** Non-fungible resources the account holds, with their local ids. */
export const nonFungibleHoldingsOf = (accountDetails: unknown) =>
  mapHoldings(accountDetails as Record<string, unknown>).nonFungibles.filter(
    (holding) => holding.ids.length > 0,
  );

/* ─── Validator state ────────────────────────────────────────────────────── */

/** The on-ledger state of a validator, as the Gateway reports it. */
export interface ValidatorState {
  isRegistered: boolean;
  acceptsDelegatedStake: boolean;
  feeFactor: string;
  /** Stake unit (LSU) resource minted by this validator. */
  stakeUnitResource: string;
  /** Claim NFT resource minted by this validator on unstake. */
  claimNftResource: string;
  publicKey: string;
}

/** Null for an address that is not a validator — what a half-typed one gives. */
export function parseValidatorState(details: unknown): ValidatorState | null {
  const raw = (details as EntityDetailsShape).details?.state;
  if (!raw || typeof raw.is_registered !== 'boolean') return null;

  return {
    isRegistered: raw.is_registered,
    acceptsDelegatedStake: raw.accepts_delegated_stake ?? false,
    feeFactor: String(raw.validator_fee_factor ?? ''),
    stakeUnitResource: raw.stake_unit_resource_address ?? '',
    claimNftResource: raw.claim_token_resource_address ?? '',
    publicKey: raw.public_key?.key_hex ?? '',
  };
}

/* ─── Owner badges ───────────────────────────────────────────────────────── */

/**
 * Every `ValidatorOwnerBadge` carries the address of the validator it governs
 * in its own NFT data, so one lookup turns "badges this account holds" into
 * "validators this account owns" without scanning the validator set.
 */
export const validatorOfOwnerBadge = (item: NonFungibleDataItem): string | undefined => {
  const value = dataField(item, 'validator');
  return typeof value === 'string' ? value : undefined;
};

/* ─── Claim NFTs ─────────────────────────────────────────────────────────── */

/** One stake claim NFT held by an account, with the validator it came from. */
export interface ClaimableNft {
  /** Claim NFT resource, i.e. the validator's claim_token_resource_address. */
  resourceAddress: string;
  localId: string;
  validatorAddress: string;
  validatorName: string;
  validatorIconUrl?: string;
  /** XRD the NFT redeems for. */
  amount: number;
  /** Epoch from which it can be redeemed. */
  claimEpoch: number;
  /** False while `claimEpoch` is still in the future. */
  isClaimable: boolean;
}

/**
 * A validator locks a `validator` metadata entry onto both resources it
 * creates. Among an account's NON-fungibles only the claim NFT carries it, so
 * its presence identifies the resource and names its validator in one read.
 */
export const validatorOfResource = (resourceDetails: unknown) =>
  getMetadataString(metadataItemsOf(resourceDetails), 'validator');

export interface ClaimNftContext {
  resourceAddress: string;
  validatorAddress: string;
  validatorDetails: unknown;
  currentEpoch: number;
}

export function parseClaimNft(item: NonFungibleDataItem, ctx: ClaimNftContext): ClaimableNft {
  const metadata = ctx.validatorDetails ? metadataItemsOf(ctx.validatorDetails) : undefined;
  const claimEpoch = Number(dataField(item, 'claim_epoch') ?? 0);

  return {
    resourceAddress: ctx.resourceAddress,
    localId: item.non_fungible_id,
    validatorAddress: ctx.validatorAddress,
    validatorName: getMetadataString(metadata, 'name') || ctx.validatorAddress,
    validatorIconUrl: getMetadataString(metadata, 'icon_url') || undefined,
    amount: Number(dataField(item, 'claim_amount') ?? 0),
    claimEpoch,
    isClaimable: claimEpoch <= ctx.currentEpoch,
  };
}

/** Redeemable first, then the ones still unbonding by how soon they mature. */
export const sortClaimNfts = (nfts: ClaimableNft[]) =>
  [...nfts].sort(
    (a, b) => Number(b.isClaimable) - Number(a.isClaimable) || a.claimEpoch - b.claimEpoch,
  );
