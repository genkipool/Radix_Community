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

// ==========================================
// BATCH MANIFEST BUILDERS
// ==========================================

export interface BatchStakeItem {
  validatorAddress: string;
  amountXrd: number;
}

export const buildBatchStakeManifest = (
  accountAddress: string,
  items: BatchStakeItem[],
  xrdResourceAddress: string
): string => {
  const totalXrd = items.reduce((acc, item) => acc + item.amountXrd, 0);
  
  let manifest = `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${totalXrd}")
;
`;

  items.forEach((item, index) => {
    manifest += `
TAKE_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Decimal("${item.amountXrd}")
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
  amountLsu: number;
  lsuResourceAddress: string;
}

export const buildBatchUnstakeManifest = (
  accountAddress: string,
  items: BatchUnstakeItem[]
): string => {
  let manifest = '';

  // withdraw all LSUs needed
  items.forEach((item) => {
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${item.lsuResourceAddress}")
    Decimal("${item.amountLsu}")
;
`;
  });

  items.forEach((item, index) => {
    manifest += `
TAKE_ALL_FROM_WORKTOP
    Address("${item.lsuResourceAddress}")
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
    manifest += `
TAKE_ALL_FROM_WORKTOP
    Address("${item.claimNftResourceAddress}")
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

export type MixedBatchItem = 
  | (BatchStakeItem & { action: 'Stake' })
  | (BatchUnstakeItem & { action: 'Unstake' })
  | (BatchClaimItem & { action: 'Claim' });

export const buildMixedBatchManifest = (
  accountAddress: string,
  items: MixedBatchItem[],
  xrdResourceAddress: string
): string => {
  let manifest = '';
  
  const stakeItems = items.filter(i => i.action === 'Stake') as (BatchStakeItem & { action: 'Stake' })[];
  const unstakeItems = items.filter(i => i.action === 'Unstake') as (BatchUnstakeItem & { action: 'Unstake' })[];
  const claimItems = items.filter(i => i.action === 'Claim') as (BatchClaimItem & { action: 'Claim' })[];

  // 1. Withdrawals
  const totalXrdStake = stakeItems.reduce((acc, item) => acc + item.amountXrd, 0);
  if (totalXrdStake > 0) {
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${xrdResourceAddress}")
    Decimal("${totalXrdStake}")
;
`;
  }

  unstakeItems.forEach(item => {
    manifest += `
CALL_METHOD
    Address("${accountAddress}")
    "withdraw"
    Address("${item.lsuResourceAddress}")
    Decimal("${item.amountLsu}")
;
`;
  });

  claimItems.forEach(item => {
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

  // 2. Actions (Bucket index tracking)
  let bucketIndex = 1;

  stakeItems.forEach(item => {
    manifest += `
TAKE_FROM_WORKTOP
    Address("${xrdResourceAddress}")
    Decimal("${item.amountXrd}")
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

  unstakeItems.forEach(item => {
    manifest += `
TAKE_ALL_FROM_WORKTOP
    Address("${item.lsuResourceAddress}")
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

  claimItems.forEach(item => {
    if (item.claimNftLocalIds.length === 0) return;
    manifest += `
TAKE_ALL_FROM_WORKTOP
    Address("${item.claimNftResourceAddress}")
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
 */
export const buildOwnerStakeManifest = (
  accountAddress: string,
  validatorAddress: string,
  amountXrd: number,
  xrdResourceAddress: string,
  lsuResourceAddress: string,
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
  amountLsu: number,
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
