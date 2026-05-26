/**
 * Builds a manifest to stake XRD to a validator.
 */
export const buildStakeManifest = (
  accountAddress: string,
  validatorAddress: string,
  amountXrd: number,
  xrdResourceAddress: string
): string => {
  return `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${amountXrd}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${validatorAddress}")
    "stake"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
};

/**
 * Builds a manifest to unstake (receive claim NFTs) from a validator.
 */
export const buildUnstakeManifest = (
  accountAddress: string,
  validatorAddress: string,
  amountLsu: number,
  lsuResourceAddress: string
): string => {
  return `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${lsuResourceAddress}")
    Decimal("${amountLsu}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${lsuResourceAddress}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${validatorAddress}")
    "unstake"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
};

/**
 * Builds a manifest to claim ready XRD from claim NFTs.
 */
export const buildClaimManifest = (
  accountAddress: string,
  validatorAddress: string,
  claimNftLocalIds: string[],
  claimNftResourceAddress: string
): string => {
  if (claimNftLocalIds.length === 0) {
    throw new Error('No claim NFTs provided');
  }

  const idsString = claimNftLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');

  return `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw_non_fungibles"
    Address("${claimNftResourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
;
TAKE_ALL_FROM_WORKTOP
    Address("${claimNftResourceAddress}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${validatorAddress}")
    "claim_xrd"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
};

/**
 * Builds a manifest for an owner to stake XRD (stakes to LSU, then locks LSU).
 */
export const buildOwnerStakeManifest = (
  accountAddress: string,
  validatorAddress: string,
  amountXrd: number,
  xrdResourceAddress: string,
  lsuResourceAddress: string
): string => {
  return `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${amountXrd}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${validatorAddress}")
    "stake"
    Bucket("bucket1")
;
TAKE_ALL_FROM_WORKTOP
    Address("${lsuResourceAddress}")
    Bucket("bucket2")
;
CALL_METHOD
    Address("${validatorAddress}")
    "lock_owner_stake_units"
    Bucket("bucket2")
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
};

/**
 * Builds a manifest for an owner to unlock owner stake units.
 */
export const buildOwnerUnstakeManifest = (
  accountAddress: string,
  validatorAddress: string,
  amountLsu: number
): string => {
  return `
CALL_METHOD
    Address("${validatorAddress}")
    "start_unlock_owner_stake_units"
    Decimal("${amountLsu}")
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
};

/**
 * Builds a manifest for an owner to claim unlocked owner XRD.
 */
export const buildOwnerClaimManifest = (
  accountAddress: string,
  validatorAddress: string,
  ownerClaimNftLocalIds: string[],
  ownerClaimNftResourceAddress: string
): string => {
  if (ownerClaimNftLocalIds.length === 0) {
    throw new Error('No owner claim NFTs provided');
  }

  const idsString = ownerClaimNftLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');

  return `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw_non_fungibles"
    Address("${ownerClaimNftResourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
;
TAKE_ALL_FROM_WORKTOP
    Address("${ownerClaimNftResourceAddress}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${validatorAddress}")
    "finish_unlock_owner_stake_units"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
};
