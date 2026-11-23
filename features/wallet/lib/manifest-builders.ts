import { parseAtto, sumRadixDecimals, toRadixDecimal } from './radix-decimal';

/**
 * Builds a manifest to stake XRD to a validator.
 */
export const buildStakeManifest = (
  accountAddress: string,
  validatorAddress: string,
  amountXrd: number | string,
  xrdResourceAddress: string
): string => {
  const amount = toRadixDecimal(amountXrd);
  return `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${amount}")
;
TAKE_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Decimal("${amount}")
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
  amountLsu: number | string,
  lsuResourceAddress: string
): string => {
  const amount = toRadixDecimal(amountLsu);
  return `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${lsuResourceAddress}")
    Decimal("${amount}")
;
TAKE_FROM_WORKTOP
    Address("${lsuResourceAddress}")
    Decimal("${amount}")
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
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${claimNftResourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
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

// ==========================================
// BATCH MANIFEST BUILDERS
// ==========================================

export interface BatchStakeItem {
  validatorAddress: string;
  amountXrd: number | string;
}

export const buildBatchStakeManifest = (
  accountAddress: string,
  items: BatchStakeItem[],
  xrdResourceAddress: string
): string => {
  const formattedItems = items.map((item) => ({
    ...item,
    amountStr: toRadixDecimal(item.amountXrd),
  }));
  const totalXrd = sumRadixDecimals(formattedItems.map((item) => item.amountStr));

  let manifest = `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${totalXrd}")
;
`;

  formattedItems.forEach((item, index) => {
    manifest += `
TAKE_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Decimal("${item.amountStr}")
    Bucket("bucket${index + 1}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "stake"
    Bucket("bucket${index + 1}")
;
`;
  });

  manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
  return manifest;
};

export interface BatchUnstakeItem {
  validatorAddress: string;
  amountLsu: number | string;
  lsuResourceAddress: string;
}

export const buildBatchUnstakeManifest = (
  accountAddress: string,
  items: BatchUnstakeItem[]
): string => {
  const formattedItems = items.map((item) => ({
    ...item,
    amountStr: toRadixDecimal(item.amountLsu),
  }));
  let manifest = '';

  // withdraw all LSUs needed
  formattedItems.forEach((item) => {
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${item.lsuResourceAddress}")
    Decimal("${item.amountStr}")
;
`;
  });

  formattedItems.forEach((item, index) => {
    manifest += `
TAKE_FROM_WORKTOP
    Address("${item.lsuResourceAddress}")
    Decimal("${item.amountStr}")
    Bucket("bucket${index + 1}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "unstake"
    Bucket("bucket${index + 1}")
;
`;
  });

  manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
  return manifest;
};

export interface BatchClaimItem {
  validatorAddress: string;
  claimNftResourceAddress: string;
  claimNftLocalIds: string[];
}

export const buildBatchClaimManifest = (
  accountAddress: string,
  items: BatchClaimItem[]
): string => {
  let manifest = '';

  items.forEach((item) => {
    if (item.claimNftLocalIds.length === 0) return;
    const idsString = item.claimNftLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw_non_fungibles"
    Address("${item.claimNftResourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
;
`;
  });

  items.forEach((item, index) => {
    if (item.claimNftLocalIds.length === 0) return;
    const idsString = item.claimNftLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
    manifest += `
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${item.claimNftResourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
    Bucket("bucket${index + 1}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "claim_xrd"
    Bucket("bucket${index + 1}")
;
`;
  });

  manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
  return manifest;
};

export interface MixedOwnerStakeItem {
  action: 'OwnerStake';
  validatorAddress: string;
  amountXrd: number | string;
  lsuResourceAddress: string;
  ownerBadgeId: string;
  ownerBadgeResourceAddress: string;
}

export interface MixedOwnerUnstakeItem {
  action: 'OwnerUnstake';
  validatorAddress: string;
  amountLsu: number | string;
  ownerBadgeId: string;
  ownerBadgeResourceAddress: string;
}

export interface MixedOwnerClaimItem {
  action: 'OwnerClaim';
  validatorAddress: string;
  ownerBadgeId: string;
  ownerBadgeResourceAddress: string;
}

export type MixedBatchItem =
  | (BatchStakeItem & { action: 'Stake' })
  | (BatchUnstakeItem & { action: 'Unstake' })
  | (BatchClaimItem & { action: 'Claim' })
  | MixedOwnerStakeItem
  | MixedOwnerUnstakeItem
  | MixedOwnerClaimItem;

export const buildMixedBatchManifest = (
  accountAddress: string,
  items: MixedBatchItem[],
  xrdResourceAddress: string
): string => {
  let manifest = '';

  const ownerStakeItems = items
    .filter((i): i is MixedOwnerStakeItem => i.action === 'OwnerStake')
    .map((item) => ({ ...item, amountStr: toRadixDecimal(item.amountXrd) }));
  const ownerUnstakeItems = items
    .filter((i): i is MixedOwnerUnstakeItem => i.action === 'OwnerUnstake')
    .map((item) => ({ ...item, amountStr: toRadixDecimal(item.amountLsu) }));
  const ownerClaimItems = items.filter((i): i is MixedOwnerClaimItem => i.action === 'OwnerClaim');

  const stakeItems = items
    .filter((i): i is BatchStakeItem & { action: 'Stake' } => i.action === 'Stake')
    .map((item) => ({ ...item, amountStr: toRadixDecimal(item.amountXrd) }));
  const unstakeItems = items
    .filter((i): i is BatchUnstakeItem & { action: 'Unstake' } => i.action === 'Unstake')
    .map((item) => ({ ...item, amountStr: toRadixDecimal(item.amountLsu) }));
  const claimItems = items.filter((i): i is BatchClaimItem & { action: 'Claim' } => i.action === 'Claim');

  // 0. Owner badge proofs (deduplicated per resource + local id)
  const seenBadges = new Set<string>();
  for (const item of [...ownerStakeItems, ...ownerUnstakeItems, ...ownerClaimItems]) {
    const key = `${item.ownerBadgeResourceAddress}:${item.ownerBadgeId}`;
    if (seenBadges.has(key)) continue;
    seenBadges.add(key);
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${item.ownerBadgeResourceAddress}")
    Array<NonFungibleLocalId>(
        NonFungibleLocalId("${item.ownerBadgeId}")
    )
;
`;
  }

  // 1. Withdrawals (exact 18-decimal sum so withdraw === sum of TAKE_FROM_WORKTOP)
  const allXrdAmounts = [
    ...ownerStakeItems.map((i) => i.amountStr),
    ...stakeItems.map((i) => i.amountStr),
  ];
  const totalXrdStake = sumRadixDecimals(allXrdAmounts);
  if (parseAtto(totalXrdStake) > 0n) {
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${totalXrdStake}")
;
`;
  }

  // 2. Bucket index tracking
  let bucketIndex = 1;

  // Owner stakes run BEFORE any LSU withdrawals or delegator stakes so that
  // TAKE_ALL_FROM_WORKTOP only sweeps the freshly minted owner stake units.
  ownerStakeItems.forEach((item) => {
    const xrdBucket = `bucket${bucketIndex++}`;
    const lsuBucket = `bucket${bucketIndex++}`;
    manifest += `
TAKE_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Decimal("${item.amountStr}")
    Bucket("${xrdBucket}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "stake_as_owner"
    Bucket("${xrdBucket}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${item.lsuResourceAddress}")
    Bucket("${lsuBucket}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "lock_owner_stake_units"
    Bucket("${lsuBucket}")
;
`;
  });

  ownerUnstakeItems.forEach((item) => {
    manifest += `
CALL_METHOD
    Address("${item.validatorAddress}")
    "start_unlock_owner_stake_units"
    Decimal("${item.amountStr}")
;
`;
  });

  ownerClaimItems.forEach((item) => {
    manifest += `
CALL_METHOD
    Address("${item.validatorAddress}")
    "finish_unlock_owner_stake_units"
;
`;
  });

  // Delegator LSU & Claim NFT withdrawals
  unstakeItems.forEach((item) => {
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${item.lsuResourceAddress}")
    Decimal("${item.amountStr}")
;
`;
  });

  claimItems.forEach((item) => {
    if (item.claimNftLocalIds.length === 0) return;
    const idsString = item.claimNftLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw_non_fungibles"
    Address("${item.claimNftResourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
;
`;
  });

  // Delegator actions
  stakeItems.forEach((item) => {
    manifest += `
TAKE_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Decimal("${item.amountStr}")
    Bucket("bucket${bucketIndex}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "stake"
    Bucket("bucket${bucketIndex}")
;
`;
    bucketIndex++;
  });

  unstakeItems.forEach((item) => {
    manifest += `
TAKE_FROM_WORKTOP
    Address("${item.lsuResourceAddress}")
    Decimal("${item.amountStr}")
    Bucket("bucket${bucketIndex}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "unstake"
    Bucket("bucket${bucketIndex}")
;
`;
    bucketIndex++;
  });

  claimItems.forEach((item) => {
    if (item.claimNftLocalIds.length === 0) return;
    const idsString = item.claimNftLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
    manifest += `
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${item.claimNftResourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
    Bucket("bucket${bucketIndex}")
;
CALL_METHOD
    Address("${item.validatorAddress}")
    "claim_xrd"
    Bucket("bucket${bucketIndex}")
;
`;
    bucketIndex++;
  });

  // 3. Deposit remainder
  manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;

  return manifest;
};

/**
 * Builds a manifest for an owner to stake XRD (stakes to LSU, then locks LSU).
 *
 * Every other take in this file names its amount, so a bucket can only ever
 * hold what its own withdrawal put on the worktop. The LSU take here is the
 * one exception and has to stay TAKE_ALL_FROM_WORKTOP: those stake units come
 * out of `stake_as_owner`, and how many the validator returns depends on its
 * exchange rate at execution time, so there is no amount to name.
 */
export const buildOwnerStakeManifest = (
  accountAddress: string,
  validatorAddress: string,
  amountXrd: number | string,
  xrdResourceAddress: string,
  lsuResourceAddress: string,
  ownerBadgeId: string,
  ownerBadgeResourceAddress: string
): string => {
  const amount = toRadixDecimal(amountXrd);
  return `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${ownerBadgeResourceAddress}")
    Array<NonFungibleLocalId>(
        NonFungibleLocalId("${ownerBadgeId}")
    )
;
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${amount}")
;
TAKE_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Decimal("${amount}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${validatorAddress}")
    "stake_as_owner"
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
  amountLsu: number | string,
  ownerBadgeId: string,
  ownerBadgeResourceAddress: string
): string => {
  const amount = toRadixDecimal(amountLsu);
  return `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${ownerBadgeResourceAddress}")
    Array<NonFungibleLocalId>(
        NonFungibleLocalId("${ownerBadgeId}")
    )
;
CALL_METHOD
    Address("${validatorAddress}")
    "start_unlock_owner_stake_units"
    Decimal("${amount}")
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
  ownerBadgeId: string,
  ownerBadgeResourceAddress: string
): string => {
  return `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${ownerBadgeResourceAddress}")
    Array<NonFungibleLocalId>(
        NonFungibleLocalId("${ownerBadgeId}")
    )
;
CALL_METHOD
    Address("${validatorAddress}")
    "finish_unlock_owner_stake_units"
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
};

/**
 * Builds a manifest for a validator owner to signal protocol-update readiness
 * (the on-ledger "vote"). Requires a proof of the validator owner badge; the
 * `protocolVersionName` must be exactly 32 characters or the ledger rejects it.
 */
export const buildSignalProtocolUpdateManifest = (
  accountAddress: string,
  validatorAddress: string,
  ownerBadgeId: string,
  ownerBadgeResourceAddress: string,
  protocolVersionName: string
): string => {
  // The version name is an ops-controlled 32-char value; escape defensively so
  // it can never break out of the string literal in the manifest.
  const safeVersion = protocolVersionName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `
CALL_METHOD
    Address("${accountAddress}")
    "create_proof_of_non_fungibles"
    Address("${ownerBadgeResourceAddress}")
    Array<NonFungibleLocalId>(
        NonFungibleLocalId("${ownerBadgeId}")
    )
;
CALL_METHOD
    Address("${validatorAddress}")
    "signal_protocol_update_readiness"
    "${safeVersion}"
;
`;
};

export interface TransferItem {
  type: 'fungible' | 'non_fungible';
  resourceAddress: string;
  amount?: number; // For fungibles
  nonFungibleLocalIds?: string[]; // For non-fungibles
}

export interface TransferGroup {
  toAccountAddress: string;
  items: TransferItem[];
}

export const buildMultiTransferManifest = (
  fromAccountAddress: string,
  groups: TransferGroup[]
): string => {
  let manifest = '';
  let bucketIndex = 1;

  // 1. Withdrawals — one per item (no dedup, so amounts match TAKEs exactly)
  groups.forEach(group => {
    group.items.forEach(item => {
      if (item.type === 'fungible' && item.amount) {
        manifest += `
CALL_METHOD
    Address("${fromAccountAddress}")
    "withdraw"
    Address("${item.resourceAddress}")
    Decimal("${item.amount}")
;
`;
      } else if (item.type === 'non_fungible' && item.nonFungibleLocalIds && item.nonFungibleLocalIds.length > 0) {
        const idsString = item.nonFungibleLocalIds.map(id => `NonFungibleLocalId("${id}")`).join(', ');
        manifest += `
CALL_METHOD
    Address("${fromAccountAddress}")
    "withdraw_non_fungibles"
    Address("${item.resourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
;
`;
      }
    });
  });

  // 2. Take from worktop and deposit to each item's destination
  groups.forEach(group => {
    group.items.forEach(item => {
      if (item.type === 'fungible' && item.amount) {
        manifest += `
TAKE_FROM_WORKTOP
    Address("${item.resourceAddress}")
    Decimal("${item.amount}")
    Bucket("bucket${bucketIndex}")
;
CALL_METHOD
    Address("${group.toAccountAddress}")
    "try_deposit_or_abort"
    Bucket("bucket${bucketIndex}")
    Enum<0u8>()
;
`;
        bucketIndex++;
      } else if (item.type === 'non_fungible' && item.nonFungibleLocalIds && item.nonFungibleLocalIds.length > 0) {
        const idsString = item.nonFungibleLocalIds.map(id => `NonFungibleLocalId("${id}")`).join(', ');
        manifest += `
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${item.resourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
    Bucket("bucket${bucketIndex}")
;
CALL_METHOD
    Address("${group.toAccountAddress}")
    "try_deposit_or_abort"
    Bucket("bucket${bucketIndex}")
    Enum<0u8>()
;
`;
        bucketIndex++;
      }
    });
  });

  // Safety net: deposit any leftover back to the sender
  manifest += `
CALL_METHOD
    Address("${fromAccountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;

  return manifest;
};

export const buildTransferManifest = (
  fromAccountAddress: string,
  toAccountAddress: string,
  items: TransferItem[]
): string => {
  let manifest = '';
  let bucketIndex = 1;

  // 1. Withdrawals
  items.forEach((item) => {
    if (item.type === 'fungible' && item.amount) {
      manifest += `
CALL_METHOD
    Address("${fromAccountAddress}")
    "withdraw"
    Address("${item.resourceAddress}")
    Decimal("${item.amount}")
;
`;
    } else if (item.type === 'non_fungible' && item.nonFungibleLocalIds && item.nonFungibleLocalIds.length > 0) {
      const idsString = item.nonFungibleLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
      manifest += `
CALL_METHOD
    Address("${fromAccountAddress}")
    "withdraw_non_fungibles"
    Address("${item.resourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
;
`;
    }
  });

  // 2. Buckets and Deposits
  items.forEach((item) => {
    if (item.type === 'fungible' && item.amount) {
      manifest += `
TAKE_FROM_WORKTOP
    Address("${item.resourceAddress}")
    Decimal("${item.amount}")
    Bucket("bucket${bucketIndex}")
;
CALL_METHOD
    Address("${toAccountAddress}")
    "try_deposit_or_abort"
    Bucket("bucket${bucketIndex}")
    Enum<0u8>()
;
`;
      bucketIndex++;
    } else if (item.type === 'non_fungible' && item.nonFungibleLocalIds && item.nonFungibleLocalIds.length > 0) {
      const idsString = item.nonFungibleLocalIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
      manifest += `
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${item.resourceAddress}")
    Array<NonFungibleLocalId>(${idsString})
    Bucket("bucket${bucketIndex}")
;
CALL_METHOD
    Address("${toAccountAddress}")
    "try_deposit_or_abort"
    Bucket("bucket${bucketIndex}")
    Enum<0u8>()
;
`;
      bucketIndex++;
    }
  });

  return manifest;
};
