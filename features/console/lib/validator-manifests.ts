/**
 * Validator manifest instructions — the single source of truth for every
 * operation the Validator blueprint exposes.
 *
 * Templates and blocks both build on these, so a fix to an instruction lands
 * in both builders at once. Each function emits only the validator call
 * itself: the caller composes the fee lock, the owner-badge proof and any
 * bucket plumbing around it, because those differ between the two builders.
 *
 * Nothing here is owner-badge aware. Auth is enforced on-ledger by the
 * `_owner_` role; which calls need a proof is declared once, next to the
 * combination rules, in `validator-operations`.
 */

import { escapeManifestString } from './manifest-escape';
import { setStringMetadata, setUrlMetadata } from './metadata-manifests';

/* ─── Primitives ─────────────────────────────────────────────────────────── */

/** One CALL_METHOD on a validator component, with already-encoded arguments. */
const callValidator = (validator: string, method: string, args: string[] = []) => `
CALL_METHOD
    Address("${validator}")
    "${method}"${args.map((arg) => `\n    ${arg}`).join('')}
;
`;

const decimalArg = (value: string) => `Decimal("${escapeManifestString(value)}")`;
const bucketArg = (name: string) => `Bucket("${escapeManifestString(name)}")`;
const stringArg = (value: string) => `"${escapeManifestString(value)}"`;
const bytesArg = (hex: string) => `Bytes("${escapeManifestString(hex)}")`;
const boolArg = (value: boolean) => (value ? 'true' : 'false');

/* ─── Lifecycle ──────────────────────────────────────────────────────────── */

export interface CreateValidatorArgs {
  /** Compressed secp256k1 consensus key of the node, 33 bytes as hex. */
  publicKeyHex: string;
  /** Operator's cut of emissions, 0..1. */
  feeFactor: string;
  /** Bucket holding the XRD creation fee. */
  paymentBucket: string;
}

/**
 * CREATE_VALIDATOR is the manifest alias for `create_validator` on the
 * consensus manager, so no consensus manager address is needed. The new
 * validator's owner badge lands on the worktop — deposit it or the
 * transaction aborts.
 */
export const createValidatorInstruction = ({
  publicKeyHex,
  feeFactor,
  paymentBucket,
}: CreateValidatorArgs) => `
CREATE_VALIDATOR
    ${bytesArg(publicKeyHex)}
    ${decimalArg(feeFactor)}
    ${bucketArg(paymentBucket)}
;
`;

/** Enter the pool of validators eligible for the active set. Owner only. */
export const registerValidatorInstruction = (validator: string) =>
  callValidator(validator, 'register');

/**
 * Leave the active set at the next epoch boundary. Owner only.
 * The stake is untouched — this is deregistration, not unstaking.
 */
export const unregisterValidatorInstruction = (validator: string) =>
  callValidator(validator, 'unregister');

/* ─── Configuration ──────────────────────────────────────────────────────── */

/** Owner only. Takes effect after the fee-change delay, not immediately. */
export const updateValidatorFeeInstruction = (validator: string, newFeeFactor: string) =>
  callValidator(validator, 'update_fee', [decimalArg(newFeeFactor)]);

/**
 * Owner only. Points the validator at a different consensus key.
 * The node must already hold the matching private key in its keystore —
 * nothing on-ledger checks that, and a mismatch silently stops validation.
 */
export const updateValidatorKeyInstruction = (validator: string, publicKeyHex: string) =>
  callValidator(validator, 'update_key', [bytesArg(publicKeyHex)]);

/** Owner only. Opens or closes the validator to third-party delegation. */
export const updateAcceptDelegatedStakeInstruction = (validator: string, accept: boolean) =>
  callValidator(validator, 'update_accept_delegated_stake', [boolArg(accept)]);

/** Owner only. Votes readiness for a named protocol update. */
export const signalProtocolUpdateReadinessInstruction = (validator: string, vote: string) =>
  callValidator(validator, 'signal_protocol_update_readiness', [stringArg(vote)]);

/* ─── Staking ────────────────────────────────────────────────────────────── */

/** Public. Requires the validator to accept delegated stake. Returns stake units. */
export const stakeInstruction = (validator: string, xrdBucket: string) =>
  callValidator(validator, 'stake', [bucketArg(xrdBucket)]);

/** Owner only. Works even when the validator is closed to delegation. */
export const stakeAsOwnerInstruction = (validator: string, xrdBucket: string) =>
  callValidator(validator, 'stake_as_owner', [bucketArg(xrdBucket)]);

/** Public. Burns stake units and returns a claim NFT redeemable after the delay. */
export const unstakeInstruction = (validator: string, stakeUnitBucket: string) =>
  callValidator(validator, 'unstake', [bucketArg(stakeUnitBucket)]);

/** Public. Redeems a matured claim NFT for XRD. */
export const claimXrdInstruction = (validator: string, claimNftBucket: string) =>
  callValidator(validator, 'claim_xrd', [bucketArg(claimNftBucket)]);

/* ─── Owner stake-unit vault ─────────────────────────────────────────────── */

/** Owner only. Moves owner stake units into the locked vault. */
export const lockOwnerStakeUnitsInstruction = (validator: string, stakeUnitBucket: string) =>
  callValidator(validator, 'lock_owner_stake_units', [bucketArg(stakeUnitBucket)]);

/** Owner only. Starts the unlock timer for part of the locked vault. */
export const startUnlockOwnerStakeUnitsInstruction = (validator: string, amount: string) =>
  callValidator(validator, 'start_unlock_owner_stake_units', [decimalArg(amount)]);

/** Owner only. Collects whatever has finished unlocking. */
export const finishUnlockOwnerStakeUnitsInstruction = (validator: string) =>
  callValidator(validator, 'finish_unlock_owner_stake_units');

/* ─── Public profile ─────────────────────────────────────────────────────── */

/**
 * The public identity of a validator: what wallets and explorers show in the
 * staking list. It is plain metadata on the validator component, gated by the
 * same owner badge, and none of it is set at creation time.
 */
export interface ValidatorProfile {
  name?: string;
  description?: string;
  iconUrl?: string;
  infoUrl?: string;
}

/** Metadata keys in the order wallets read them, paired with their SBOR type. */
const PROFILE_KEYS = [
  ['name', 'name', setStringMetadata],
  ['description', 'description', setStringMetadata],
  ['icon_url', 'iconUrl', setUrlMetadata],
  ['info_url', 'infoUrl', setUrlMetadata],
] as const satisfies ReadonlyArray<
  readonly [string, keyof ValidatorProfile, (address: string, key: string, value: string) => string]
>;

/** Only the fields actually filled in produce an instruction. */
export const validatorProfileInstructions = (validator: string, profile: ValidatorProfile) =>
  PROFILE_KEYS.reduce((manifest, [metadataKey, field, build]) => {
    const value = profile[field]?.trim();
    return value ? manifest + build(validator, metadataKey, value) : manifest;
  }, '');
