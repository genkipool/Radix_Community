/**
 * The validator tool's domain model: which operations exist, which of them can
 * share one transaction, and how a batch of them becomes a single manifest.
 *
 * The combination rules below are not guesses — each was run against the Radix
 * engine (resim, Cuttlefish v1.3.1) and the observed behaviour is recorded on
 * the rule it produced:
 *
 *   · One `create_proof_of_non_fungibles` covers every owner call in the
 *     transaction, for any number of validators, in any order.
 *   · `create_validator` cannot share a transaction with anything acting on
 *     the validator it creates: neither its address nor its badge id exists
 *     until the transaction commits, so no later instruction can name them.
 *   · `claim_xrd` on a claim NFT minted by an `unstake` in the same
 *     transaction aborts the whole thing with EpochUnlockHasNotOccurredYet.
 *     Claiming a matured NFT on its own succeeds.
 *   · Contradictory calls (register + unregister, two update_fee) are NOT
 *     rejected by the engine. They commit, and the last one silently wins.
 *     Nothing on-ledger will warn the operator, so the UI has to.
 */

import { buildNonFungibleBadgeProof } from './badge-proof-manifest';
import { escapeManifestString } from './manifest-escape';
import {
  claimXrdInstruction,
  createValidatorInstruction,
  finishUnlockOwnerStakeUnitsInstruction,
  lockOwnerStakeUnitsInstruction,
  registerValidatorInstruction,
  signalProtocolUpdateReadinessInstruction,
  stakeAsOwnerInstruction,
  stakeInstruction,
  startUnlockOwnerStakeUnitsInstruction,
  unregisterValidatorInstruction,
  unstakeInstruction,
  updateAcceptDelegatedStakeInstruction,
  updateValidatorFeeInstruction,
  updateValidatorKeyInstruction,
  validatorProfileInstructions,
} from './validator-manifests';

/* ─── Catalogue ──────────────────────────────────────────────────────────── */

export const VALIDATOR_OPERATION_KINDS = [
  'register',
  'unregister',
  'update-fee',
  'update-key',
  'accept-delegated-stake',
  'signal-protocol-update',
  'profile',
  'stake-as-owner',
  'stake',
  'unstake',
  'lock-owner-stake-units',
  'start-unlock-owner-stake-units',
  'finish-unlock-owner-stake-units',
  'claim-xrd',
  'create-validator',
] as const;

export type ValidatorOperationKind = (typeof VALIDATOR_OPERATION_KINDS)[number];

/** Palette sections, ordered the way an operator works through them. */
export type ValidatorOperationGroup = 'lifecycle' | 'profile' | 'staking' | 'creation';

export type ValidatorFieldKind =
  | 'address'
  | 'resource'
  | 'decimal'
  | 'text'
  | 'nonFungibleId'
  | 'choice';

export interface ValidatorOperationField {
  key: string;
  kind: ValidatorFieldKind;
  optional?: boolean;
  options?: string[];
}

export interface ValidatorOperationDef {
  kind: ValidatorOperationKind;
  group: ValidatorOperationGroup;
  /** 'standalone' operations refuse to share a transaction with anything. */
  combination: 'batchable' | 'standalone';
  /** Needs the validator owner badge in the transaction's auth zone. */
  ownerOnly: boolean;
  /** Acts on an existing validator, so it needs a validator address. */
  needsValidator: boolean;
  /**
   * Two operations claiming the same slot on the same validator overwrite each
   * other on-ledger without error. Only one of each slot per validator.
   */
  exclusiveSlot?: string;
  /** Aborts the transaction when combined with these, on the same validator. */
  abortsWith?: ValidatorOperationKind[];
  fields: ValidatorOperationField[];
}

const VALIDATOR_FIELD: ValidatorOperationField = { key: 'validator', kind: 'address' };

export const VALIDATOR_OPERATIONS: Record<ValidatorOperationKind, ValidatorOperationDef> = {
  register: {
    kind: 'register',
    group: 'lifecycle',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    exclusiveSlot: 'registration',
    fields: [VALIDATOR_FIELD],
  },
  unregister: {
    kind: 'unregister',
    group: 'lifecycle',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    exclusiveSlot: 'registration',
    fields: [VALIDATOR_FIELD],
  },
  'update-fee': {
    kind: 'update-fee',
    group: 'lifecycle',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    exclusiveSlot: 'fee',
    fields: [VALIDATOR_FIELD, { key: 'feeFactor', kind: 'decimal' }],
  },
  'update-key': {
    kind: 'update-key',
    group: 'lifecycle',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    exclusiveSlot: 'key',
    fields: [VALIDATOR_FIELD, { key: 'publicKey', kind: 'text' }],
  },
  'accept-delegated-stake': {
    kind: 'accept-delegated-stake',
    group: 'lifecycle',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    exclusiveSlot: 'delegation',
    fields: [VALIDATOR_FIELD, { key: 'accept', kind: 'choice', options: ['true', 'false'] }],
  },
  'signal-protocol-update': {
    kind: 'signal-protocol-update',
    group: 'lifecycle',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    exclusiveSlot: 'protocol-vote',
    fields: [VALIDATOR_FIELD, { key: 'version', kind: 'text' }],
  },
  profile: {
    kind: 'profile',
    group: 'profile',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    exclusiveSlot: 'profile',
    fields: [
      VALIDATOR_FIELD,
      { key: 'name', kind: 'text', optional: true },
      { key: 'description', kind: 'text', optional: true },
      { key: 'iconUrl', kind: 'text', optional: true },
      { key: 'infoUrl', kind: 'text', optional: true },
    ],
  },
  'stake-as-owner': {
    kind: 'stake-as-owner',
    group: 'staking',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    fields: [VALIDATOR_FIELD, { key: 'amount', kind: 'decimal' }],
  },
  stake: {
    kind: 'stake',
    group: 'staking',
    combination: 'batchable',
    ownerOnly: false,
    needsValidator: true,
    fields: [VALIDATOR_FIELD, { key: 'amount', kind: 'decimal' }],
  },
  unstake: {
    kind: 'unstake',
    group: 'staking',
    combination: 'batchable',
    ownerOnly: false,
    needsValidator: true,
    abortsWith: ['claim-xrd'],
    fields: [
      VALIDATOR_FIELD,
      { key: 'stakeUnitResource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  'lock-owner-stake-units': {
    kind: 'lock-owner-stake-units',
    group: 'staking',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    fields: [
      VALIDATOR_FIELD,
      { key: 'stakeUnitResource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  'start-unlock-owner-stake-units': {
    kind: 'start-unlock-owner-stake-units',
    group: 'staking',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    fields: [VALIDATOR_FIELD, { key: 'amount', kind: 'decimal' }],
  },
  'finish-unlock-owner-stake-units': {
    kind: 'finish-unlock-owner-stake-units',
    group: 'staking',
    combination: 'batchable',
    ownerOnly: true,
    needsValidator: true,
    fields: [VALIDATOR_FIELD],
  },
  'claim-xrd': {
    kind: 'claim-xrd',
    group: 'staking',
    combination: 'batchable',
    ownerOnly: false,
    needsValidator: true,
    abortsWith: ['unstake'],
    fields: [
      VALIDATOR_FIELD,
      { key: 'claimNftResource', kind: 'resource' },
      { key: 'claimNftIds', kind: 'nonFungibleId' },
    ],
  },
  'create-validator': {
    kind: 'create-validator',
    group: 'creation',
    combination: 'standalone',
    ownerOnly: false,
    needsValidator: false,
    fields: [
      { key: 'publicKey', kind: 'text' },
      { key: 'feeFactor', kind: 'decimal' },
      { key: 'payment', kind: 'decimal' },
    ],
  },
};

export const VALIDATOR_OPERATION_GROUPS: ReadonlyArray<{
  id: ValidatorOperationGroup;
  kinds: ValidatorOperationKind[];
}> = [
  {
    id: 'lifecycle',
    kinds: [
      'register',
      'unregister',
      'update-fee',
      'update-key',
      'accept-delegated-stake',
      'signal-protocol-update',
    ],
  },
  { id: 'profile', kinds: ['profile'] },
  {
    id: 'staking',
    kinds: [
      'stake-as-owner',
      'stake',
      'unstake',
      'lock-owner-stake-units',
      'start-unlock-owner-stake-units',
      'finish-unlock-owner-stake-units',
      'claim-xrd',
    ],
  },
  { id: 'creation', kinds: ['create-validator'] },
];

/* ─── Instances ──────────────────────────────────────────────────────────── */

export interface ValidatorOperation {
  id: string;
  kind: ValidatorOperationKind;
  values: Record<string, string>;
}

/** Seeds a choice field so the form matches the manifest from the first render. */
export const createValidatorOperation = (
  kind: ValidatorOperationKind,
  seed: Record<string, string> = {},
): ValidatorOperation => ({
  id: crypto.randomUUID(),
  kind,
  values: {
    ...Object.fromEntries(
      VALIDATOR_OPERATIONS[kind].fields
        .filter((field) => field.kind === 'choice' && field.options?.length)
        .map((field) => [field.key, field.options![0]]),
    ),
    ...seed,
  },
});

const val = (operation: ValidatorOperation, key: string) => (operation.values[key] ?? '').trim();

export const isOperationComplete = (operation: ValidatorOperation): boolean => {
  const def = VALIDATOR_OPERATIONS[operation.kind];
  const required = def.fields.filter((field) => !field.optional);
  if (!required.every((field) => val(operation, field.key).length > 0)) return false;
  // A profile update with every optional field blank would emit no instruction.
  if (operation.kind === 'profile') {
    return ['name', 'description', 'iconUrl', 'infoUrl'].some((key) => val(operation, key));
  }
  return true;
};

/* ─── Batch validation ───────────────────────────────────────────────────── */

export type ValidatorIssueCode =
  /** A standalone operation is sharing the batch with others. */
  | 'standalone'
  /** Two operations write the same thing; the later one silently wins. */
  | 'exclusive'
  /** Combining these aborts the transaction on-ledger. */
  | 'aborts'
  /** Owner-gated operation with no badge available for its validator. */
  | 'missing-badge';

export interface ValidatorBatchIssue {
  code: ValidatorIssueCode;
  /** Operations the issue is about, so the UI can mark the exact cards. */
  operationIds: string[];
  /** Extra context for the message (validator address, operation kind…). */
  subject?: string;
}

const pairsOnSameValidator = (operations: ValidatorOperation[]) => {
  const byValidator = new Map<string, ValidatorOperation[]>();
  for (const operation of operations) {
    if (!VALIDATOR_OPERATIONS[operation.kind].needsValidator) continue;
    const validator = val(operation, 'validator');
    if (!validator) continue;
    byValidator.set(validator, [...(byValidator.get(validator) ?? []), operation]);
  }
  return byValidator;
};

/**
 * Everything wrong with a batch, in the order the UI should surface it.
 * Incomplete operations are the caller's concern (see `isOperationComplete`);
 * this reports only problems that come from operations being *combined*.
 */
export function validateValidatorBatch(
  operations: ValidatorOperation[],
  badgeIdByValidator: Record<string, string> = {},
): ValidatorBatchIssue[] {
  const issues: ValidatorBatchIssue[] = [];

  const standalone = operations.filter(
    (operation) => VALIDATOR_OPERATIONS[operation.kind].combination === 'standalone',
  );
  if (standalone.length && operations.length > 1) {
    issues.push({
      code: 'standalone',
      operationIds: standalone.map((operation) => operation.id),
      subject: standalone[0].kind,
    });
  }

  for (const [validator, group] of pairsOnSameValidator(operations)) {
    const bySlot = new Map<string, ValidatorOperation[]>();
    for (const operation of group) {
      const slot = VALIDATOR_OPERATIONS[operation.kind].exclusiveSlot;
      if (slot) bySlot.set(slot, [...(bySlot.get(slot) ?? []), operation]);
    }
    for (const [slot, clashing] of bySlot) {
      if (clashing.length > 1) {
        issues.push({
          code: 'exclusive',
          operationIds: clashing.map((operation) => operation.id),
          subject: slot,
        });
      }
    }

    for (const operation of group) {
      const aborts = VALIDATOR_OPERATIONS[operation.kind].abortsWith ?? [];
      const offenders = group.filter((other) => aborts.includes(other.kind));
      if (offenders.length) {
        const ids = [operation.id, ...offenders.map((other) => other.id)].sort();
        const already = issues.some(
          (issue) => issue.code === 'aborts' && issue.operationIds.join() === ids.join(),
        );
        if (!already) issues.push({ code: 'aborts', operationIds: ids, subject: validator });
      }
    }

    const ownerOps = group.filter((operation) => VALIDATOR_OPERATIONS[operation.kind].ownerOnly);
    if (ownerOps.length && !badgeIdByValidator[validator]) {
      issues.push({
        code: 'missing-badge',
        operationIds: ownerOps.map((operation) => operation.id),
        subject: validator,
      });
    }
  }

  return issues;
}

/* ─── Manifest assembly ──────────────────────────────────────────────────── */

export interface ValidatorBatchContext {
  /** Account that locks the fee, presents the badges and receives everything. */
  account: string;
  xrdAddress: string;
  ownerBadgeResource: string;
  /** validator address → owner badge local id held by `account`. */
  badgeIdByValidator: Record<string, string>;
  /** XRD locked for the network fee. */
  feeLock?: string;
}

const withdraw = (account: string, resource: string, amount: string) => `
CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${resource}")
    Decimal("${escapeManifestString(amount)}")
;
`;

const withdrawNonFungibles = (account: string, resource: string, ids: string[]) => `
CALL_METHOD
    Address("${account}")
    "withdraw_non_fungibles"
    Address("${resource}")
    Array<NonFungibleLocalId>(${ids
      .map((id) => `NonFungibleLocalId("${escapeManifestString(id)}")`)
      .join(', ')})
;
`;

const takeAll = (resource: string, bucket: string) => `
TAKE_ALL_FROM_WORKTOP
    Address("${resource}")
    Bucket("${bucket}")
;
`;

const lockFee = (account: string, amount: string) => `
CALL_METHOD
    Address("${account}")
    "lock_fee"
    Decimal("${escapeManifestString(amount)}")
;
`;

const depositAll = (account: string) => `
CALL_METHOD
    Address("${account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;

const parseIds = (raw: string) =>
  raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

/** Withdraw + take + call, for the operations that consume a bucket. */
function fundedOperation(
  operation: ValidatorOperation,
  ctx: ValidatorBatchContext,
  bucket: string,
): string | null {
  const validator = val(operation, 'validator');
  switch (operation.kind) {
    case 'stake':
    case 'stake-as-owner': {
      const call = operation.kind === 'stake' ? stakeInstruction : stakeAsOwnerInstruction;
      return (
        withdraw(ctx.account, ctx.xrdAddress, val(operation, 'amount')) +
        takeAll(ctx.xrdAddress, bucket) +
        call(validator, bucket)
      );
    }
    case 'unstake':
    case 'lock-owner-stake-units': {
      const resource = val(operation, 'stakeUnitResource');
      const call =
        operation.kind === 'unstake' ? unstakeInstruction : lockOwnerStakeUnitsInstruction;
      return (
        withdraw(ctx.account, resource, val(operation, 'amount')) +
        takeAll(resource, bucket) +
        call(validator, bucket)
      );
    }
    case 'claim-xrd': {
      const resource = val(operation, 'claimNftResource');
      return (
        withdrawNonFungibles(ctx.account, resource, parseIds(val(operation, 'claimNftIds'))) +
        takeAll(resource, bucket) +
        claimXrdInstruction(validator, bucket)
      );
    }
    case 'create-validator':
      return (
        withdraw(ctx.account, ctx.xrdAddress, val(operation, 'payment')) +
        takeAll(ctx.xrdAddress, bucket) +
        createValidatorInstruction({
          publicKeyHex: val(operation, 'publicKey'),
          feeFactor: val(operation, 'feeFactor'),
          paymentBucket: bucket,
        })
      );
    default:
      return null;
  }
}

/** The plain calls, which need neither a bucket nor a withdrawal. */
function plainOperation(operation: ValidatorOperation): string {
  const validator = val(operation, 'validator');
  switch (operation.kind) {
    case 'register':
      return registerValidatorInstruction(validator);
    case 'unregister':
      return unregisterValidatorInstruction(validator);
    case 'update-fee':
      return updateValidatorFeeInstruction(validator, val(operation, 'feeFactor'));
    case 'update-key':
      return updateValidatorKeyInstruction(validator, val(operation, 'publicKey'));
    case 'accept-delegated-stake':
      return updateAcceptDelegatedStakeInstruction(validator, val(operation, 'accept') !== 'false');
    case 'signal-protocol-update':
      return signalProtocolUpdateReadinessInstruction(validator, val(operation, 'version'));
    case 'start-unlock-owner-stake-units':
      return startUnlockOwnerStakeUnitsInstruction(validator, val(operation, 'amount'));
    case 'finish-unlock-owner-stake-units':
      return finishUnlockOwnerStakeUnitsInstruction(validator);
    case 'profile':
      return validatorProfileInstructions(validator, {
        name: val(operation, 'name'),
        description: val(operation, 'description'),
        iconUrl: val(operation, 'iconUrl'),
        infoUrl: val(operation, 'infoUrl'),
      });
    default:
      return '';
  }
}

/**
 * One manifest for the whole batch: fee lock, a single proof carrying every
 * badge the batch needs, the operations in the operator's order, and one
 * closing deposit.
 *
 * The single proof is what makes batching cheap — the engine keeps it in the
 * auth zone for the rest of the transaction, so N owner calls across M
 * validators still cost exactly one proof instruction.
 */
export function buildValidatorBatchManifest(
  operations: ValidatorOperation[],
  ctx: ValidatorBatchContext,
): string {
  const usable = operations.filter(isOperationComplete);
  if (!usable.length || !ctx.account) return '';

  const badgeIds = [
    ...new Set(
      usable
        .filter((operation) => VALIDATOR_OPERATIONS[operation.kind].ownerOnly)
        .map((operation) => ctx.badgeIdByValidator[val(operation, 'validator')])
        .filter(Boolean),
    ),
  ];

  const proof = buildNonFungibleBadgeProof(ctx.account, ctx.ownerBadgeResource, badgeIds);

  let bucketCount = 0;
  let returnsToWorktop = false;
  const body = usable
    .map((operation) => {
      const funded = fundedOperation(operation, ctx, `bucket${bucketCount + 1}`);
      if (funded) {
        bucketCount += 1;
        returnsToWorktop = true;
        return funded;
      }
      if (operation.kind === 'finish-unlock-owner-stake-units') returnsToWorktop = true;
      return plainOperation(operation);
    })
    .join('');

  return (
    lockFee(ctx.account, ctx.feeLock ?? '10') +
    proof +
    body +
    (returnsToWorktop ? depositAll(ctx.account) : '')
  );
}
