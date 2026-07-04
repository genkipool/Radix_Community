/**
 * Block-based manifest building for the build-manifest tool.
 *
 * A manifest is composed as an ordered list of blocks; each block maps to one
 * or two manifest instructions. Buckets created by "take" blocks are
 * auto-named (bucket1, bucket2, …) and offered to later bucket-consuming
 * blocks; proofs created by proof blocks are auto-named (proof1, proof2, …)
 * the same way. All user-facing labels live in the locales under
 * console.buildManifest.
 */

export type BlockType =
  // Account
  | 'withdraw'
  | 'withdrawNfts'
  | 'depositBucket'
  | 'depositAll'
  | 'proof'
  // Annotation
  | 'comment'
  // Invoke
  | 'callMethod'
  // Bucket
  | 'takeFromWorktop'
  | 'takeAllFromWorktop'
  | 'takeNonFungiblesFromWorktop'
  | 'returnToWorktop'
  // Asserts
  | 'assertWorktopContains'
  | 'assertWorktopContainsAny'
  | 'assertWorktopContainsNonFungibles'
  | 'assertWorktopIsEmpty'
  // Resource
  | 'burnResource'
  | 'mintFungible'
  | 'mintNonFungible'
  // Proof
  | 'popFromAuthZone'
  | 'pushToAuthZone'
  | 'createProofFromAuthZoneOfAmount'
  | 'createProofFromAuthZoneOfNonFungibles'
  | 'createProofFromAuthZoneOfAll'
  | 'createProofFromBucketOfAmount'
  | 'createProofFromBucketOfNonFungibles'
  | 'createProofFromBucketOfAll'
  | 'cloneProof'
  | 'dropProof'
  | 'dropAllProofs'
  | 'dropAuthZoneProofs'
  | 'dropAuthZoneRegularProofs'
  | 'dropAuthZoneSignatureProofs'
  // Address
  | 'allocateGlobalAddress'
  // Metadata
  | 'setMetadata'
  // Escape
  | 'raw'
  // Snippets
  | 'snippetCreateFungible'
  | 'snippetCreateNonFungible';

export type BlockFieldKind =
  | 'account'
  | 'address'
  | 'resource'
  | 'decimal'
  | 'text'
  | 'bucket'
  | 'proofRef'
  | 'multiline';

export interface BlockField {
  key: string;
  kind: BlockFieldKind;
  optional?: boolean;
}

export type BlockIcon =
  | 'upload'
  | 'image'
  | 'package'
  | 'download'
  | 'badge'
  | 'tags'
  | 'braces'
  | 'code'
  | 'comment'
  | 'shield'
  | 'flame'
  | 'coins'
  | 'key'
  | 'globe'
  | 'sparkles';

export interface BlockDef {
  type: BlockType;
  icon: BlockIcon;
  gradient: string;
  accentRgb: string;
  fields: BlockField[];
  /** The block creates a worktop bucket consumable by later blocks */
  producesBucket?: boolean;
  /** The block creates a named proof consumable by later blocks */
  producesProof?: boolean;
  /** The block creates a named address reservation (reservation1, address1, …) */
  producesAddress?: boolean;
}

const GRADIENT = 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]';

/** Accent per palette category (kept as raw rgb for translucent backgrounds). */
const ACCENTS = {
  account: '59,130,246',
  annotation: '100,116,139',
  invoke: '139,92,246',
  bucket: '99,102,241',
  asserts: '14,165,233',
  resource: '245,158,11',
  proof: '217,70,239',
  address: '20,184,166',
  metadata: '16,185,129',
  escape: '244,63,94',
  snippets: '234,88,12',
};

export const BLOCK_DEFS: Record<BlockType, BlockDef> = {
  /* ── Account ─────────────────────────────────────────────────────────── */
  withdraw: {
    type: 'withdraw',
    icon: 'upload',
    gradient: GRADIENT,
    accentRgb: ACCENTS.account,
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  withdrawNfts: {
    type: 'withdrawNfts',
    icon: 'image',
    gradient: GRADIENT,
    accentRgb: ACCENTS.account,
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'nftIds', kind: 'text' },
    ],
  },
  depositBucket: {
    type: 'depositBucket',
    icon: 'download',
    gradient: GRADIENT,
    accentRgb: ACCENTS.account,
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'bucket', kind: 'bucket' },
    ],
  },
  depositAll: {
    type: 'depositAll',
    icon: 'download',
    gradient: GRADIENT,
    accentRgb: ACCENTS.account,
    fields: [{ key: 'account', kind: 'account' }],
  },
  proof: {
    type: 'proof',
    icon: 'badge',
    gradient: GRADIENT,
    accentRgb: ACCENTS.account,
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'nftId', kind: 'text', optional: true },
    ],
  },

  /* ── Annotation ──────────────────────────────────────────────────────── */
  comment: {
    type: 'comment',
    icon: 'comment',
    gradient: GRADIENT,
    accentRgb: ACCENTS.annotation,
    fields: [{ key: 'text', kind: 'text', optional: true }],
  },

  /* ── Invoke ──────────────────────────────────────────────────────────── */
  callMethod: {
    type: 'callMethod',
    icon: 'braces',
    gradient: GRADIENT,
    accentRgb: ACCENTS.invoke,
    fields: [
      { key: 'component', kind: 'address' },
      { key: 'method', kind: 'text' },
      { key: 'args', kind: 'multiline', optional: true },
    ],
  },

  /* ── Bucket ──────────────────────────────────────────────────────────── */
  takeFromWorktop: {
    type: 'takeFromWorktop',
    icon: 'package',
    gradient: GRADIENT,
    accentRgb: ACCENTS.bucket,
    producesBucket: true,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  takeAllFromWorktop: {
    type: 'takeAllFromWorktop',
    icon: 'package',
    gradient: GRADIENT,
    accentRgb: ACCENTS.bucket,
    producesBucket: true,
    fields: [{ key: 'resource', kind: 'resource' }],
  },
  takeNonFungiblesFromWorktop: {
    type: 'takeNonFungiblesFromWorktop',
    icon: 'package',
    gradient: GRADIENT,
    accentRgb: ACCENTS.bucket,
    producesBucket: true,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'nftIds', kind: 'text' },
    ],
  },
  returnToWorktop: {
    type: 'returnToWorktop',
    icon: 'package',
    gradient: GRADIENT,
    accentRgb: ACCENTS.bucket,
    fields: [{ key: 'bucket', kind: 'bucket' }],
  },

  /* ── Asserts ─────────────────────────────────────────────────────────── */
  assertWorktopContains: {
    type: 'assertWorktopContains',
    icon: 'shield',
    gradient: GRADIENT,
    accentRgb: ACCENTS.asserts,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  assertWorktopContainsAny: {
    type: 'assertWorktopContainsAny',
    icon: 'shield',
    gradient: GRADIENT,
    accentRgb: ACCENTS.asserts,
    fields: [{ key: 'resource', kind: 'resource' }],
  },
  assertWorktopContainsNonFungibles: {
    type: 'assertWorktopContainsNonFungibles',
    icon: 'shield',
    gradient: GRADIENT,
    accentRgb: ACCENTS.asserts,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'nftIds', kind: 'text' },
    ],
  },
  assertWorktopIsEmpty: {
    type: 'assertWorktopIsEmpty',
    icon: 'shield',
    gradient: GRADIENT,
    accentRgb: ACCENTS.asserts,
    fields: [],
  },

  /* ── Resource ────────────────────────────────────────────────────────── */
  burnResource: {
    type: 'burnResource',
    icon: 'flame',
    gradient: GRADIENT,
    accentRgb: ACCENTS.resource,
    fields: [{ key: 'bucket', kind: 'bucket' }],
  },
  mintFungible: {
    type: 'mintFungible',
    icon: 'coins',
    gradient: GRADIENT,
    accentRgb: ACCENTS.resource,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  mintNonFungible: {
    type: 'mintNonFungible',
    icon: 'coins',
    gradient: GRADIENT,
    accentRgb: ACCENTS.resource,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'nftId', kind: 'text' },
      { key: 'name', kind: 'text' },
      { key: 'description', kind: 'text', optional: true },
      { key: 'imageUrl', kind: 'text', optional: true },
    ],
  },

  /* ── Proof ───────────────────────────────────────────────────────────── */
  popFromAuthZone: {
    type: 'popFromAuthZone',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [],
  },
  pushToAuthZone: {
    type: 'pushToAuthZone',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    fields: [{ key: 'proof', kind: 'proofRef' }],
  },
  createProofFromAuthZoneOfAmount: {
    type: 'createProofFromAuthZoneOfAmount',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  createProofFromAuthZoneOfNonFungibles: {
    type: 'createProofFromAuthZoneOfNonFungibles',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'nftIds', kind: 'text' },
    ],
  },
  createProofFromAuthZoneOfAll: {
    type: 'createProofFromAuthZoneOfAll',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [{ key: 'resource', kind: 'resource' }],
  },
  createProofFromBucketOfAmount: {
    type: 'createProofFromBucketOfAmount',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [
      { key: 'bucket', kind: 'bucket' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  createProofFromBucketOfNonFungibles: {
    type: 'createProofFromBucketOfNonFungibles',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [
      { key: 'bucket', kind: 'bucket' },
      { key: 'nftIds', kind: 'text' },
    ],
  },
  createProofFromBucketOfAll: {
    type: 'createProofFromBucketOfAll',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [{ key: 'bucket', kind: 'bucket' }],
  },
  cloneProof: {
    type: 'cloneProof',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    producesProof: true,
    fields: [{ key: 'proof', kind: 'proofRef' }],
  },
  dropProof: {
    type: 'dropProof',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    fields: [{ key: 'proof', kind: 'proofRef' }],
  },
  dropAllProofs: {
    type: 'dropAllProofs',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    fields: [],
  },
  dropAuthZoneProofs: {
    type: 'dropAuthZoneProofs',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    fields: [],
  },
  dropAuthZoneRegularProofs: {
    type: 'dropAuthZoneRegularProofs',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    fields: [],
  },
  dropAuthZoneSignatureProofs: {
    type: 'dropAuthZoneSignatureProofs',
    icon: 'key',
    gradient: GRADIENT,
    accentRgb: ACCENTS.proof,
    fields: [],
  },

  /* ── Address ─────────────────────────────────────────────────────────── */
  allocateGlobalAddress: {
    type: 'allocateGlobalAddress',
    icon: 'globe',
    gradient: GRADIENT,
    accentRgb: ACCENTS.address,
    producesAddress: true,
    fields: [
      { key: 'packageAddress', kind: 'address' },
      { key: 'blueprint', kind: 'text' },
    ],
  },

  /* ── Metadata ────────────────────────────────────────────────────────── */
  setMetadata: {
    type: 'setMetadata',
    icon: 'tags',
    gradient: GRADIENT,
    accentRgb: ACCENTS.metadata,
    fields: [
      { key: 'entity', kind: 'address' },
      { key: 'metadataKey', kind: 'text' },
      { key: 'value', kind: 'text' },
    ],
  },

  /* ── Escape ──────────────────────────────────────────────────────────── */
  raw: {
    type: 'raw',
    icon: 'code',
    gradient: GRADIENT,
    accentRgb: ACCENTS.escape,
    fields: [{ key: 'instructions', kind: 'multiline' }],
  },

  /* ── Snippets ────────────────────────────────────────────────────────── */
  snippetCreateFungible: {
    type: 'snippetCreateFungible',
    icon: 'sparkles',
    gradient: GRADIENT,
    accentRgb: ACCENTS.snippets,
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'name', kind: 'text' },
      { key: 'symbol', kind: 'text' },
      { key: 'initialSupply', kind: 'decimal' },
      { key: 'divisibility', kind: 'decimal', optional: true },
    ],
  },
  snippetCreateNonFungible: {
    type: 'snippetCreateNonFungible',
    icon: 'sparkles',
    gradient: GRADIENT,
    accentRgb: ACCENTS.snippets,
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'name', kind: 'text' },
      { key: 'nftName', kind: 'text' },
      { key: 'nftDescription', kind: 'text', optional: true },
      { key: 'nftImageUrl', kind: 'text', optional: true },
    ],
  },
};

/** Palette categories shown in the builder UI (labels in the locales). */
export interface BlockCategory {
  id: string;
  blocks: BlockType[];
}

export const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    id: 'account',
    blocks: ['withdraw', 'withdrawNfts', 'depositBucket', 'depositAll', 'proof'],
  },
  { id: 'annotation', blocks: ['comment'] },
  { id: 'invoke', blocks: ['callMethod'] },
  {
    id: 'bucket',
    blocks: ['takeFromWorktop', 'takeAllFromWorktop', 'takeNonFungiblesFromWorktop', 'returnToWorktop'],
  },
  {
    id: 'asserts',
    blocks: [
      'assertWorktopContains',
      'assertWorktopContainsAny',
      'assertWorktopContainsNonFungibles',
      'assertWorktopIsEmpty',
    ],
  },
  { id: 'resource', blocks: ['burnResource', 'mintFungible', 'mintNonFungible'] },
  {
    id: 'proofs',
    blocks: [
      'popFromAuthZone',
      'pushToAuthZone',
      'createProofFromAuthZoneOfAmount',
      'createProofFromAuthZoneOfNonFungibles',
      'createProofFromAuthZoneOfAll',
      'createProofFromBucketOfAmount',
      'createProofFromBucketOfNonFungibles',
      'createProofFromBucketOfAll',
      'cloneProof',
      'dropProof',
      'dropAllProofs',
      'dropAuthZoneProofs',
      'dropAuthZoneRegularProofs',
      'dropAuthZoneSignatureProofs',
    ],
  },
  { id: 'address', blocks: ['allocateGlobalAddress'] },
  { id: 'metadata', blocks: ['setMetadata'] },
  { id: 'escape', blocks: ['raw'] },
  { id: 'snippets', blocks: ['snippetCreateFungible', 'snippetCreateNonFungible'] },
];

/** Flat palette order (kept for compatibility with existing callers/tests). */
export const BLOCK_PALETTE: BlockType[] = BLOCK_CATEGORIES.flatMap((category) => category.blocks);

export interface BlockInstance {
  id: string;
  type: BlockType;
  values: Record<string, string>;
}

export const createBlock = (type: BlockType): BlockInstance => ({
  id: crypto.randomUUID(),
  type,
  values: {},
});

const value = (block: BlockInstance, key: string) => (block.values[key] ?? '').trim();

export const isBlockComplete = (block: BlockInstance): boolean =>
  BLOCK_DEFS[block.type].fields.every((field) => field.optional || value(block, field.key).length > 0);

export interface BlockNames {
  /** blockId → bucket name (only for bucket-producing blocks) */
  buckets: Map<string, string>;
  /** blockId → proof name (only for proof-producing blocks) */
  proofs: Map<string, string>;
  /** blockId → { reservation, address } (only for address-allocating blocks) */
  addresses: Map<string, { reservation: string; address: string }>;
}

/** Names the buckets/proofs/addresses each block of the list would produce, in order. */
export function assignBlockNames(blocks: BlockInstance[]): BlockNames {
  const buckets = new Map<string, string>();
  const proofs = new Map<string, string>();
  const addresses = new Map<string, { reservation: string; address: string }>();
  let bucketCount = 0;
  let proofCount = 0;
  let addressCount = 0;
  for (const block of blocks) {
    const def = BLOCK_DEFS[block.type];
    if (def.producesBucket) {
      bucketCount += 1;
      buckets.set(block.id, `bucket${bucketCount}`);
    }
    if (def.producesProof) {
      proofCount += 1;
      proofs.set(block.id, `proof${proofCount}`);
    }
    if (def.producesAddress) {
      addressCount += 1;
      addresses.set(block.id, {
        reservation: `reservation${addressCount}`,
        address: `address${addressCount}`,
      });
    }
  }
  return { buckets, proofs, addresses };
}

/** blockId → bucket name (only for producing blocks). */
export function assignBucketNames(blocks: BlockInstance[]): Map<string, string> {
  return assignBlockNames(blocks).buckets;
}

/** Buckets available to a block: those produced by earlier complete blocks. */
export function availableBuckets(blocks: BlockInstance[], blockId: string): string[] {
  return collectEarlierNames(blocks, blockId, assignBlockNames(blocks).buckets);
}

/** Proofs available to a block: those produced by earlier complete blocks. */
export function availableProofs(blocks: BlockInstance[], blockId: string): string[] {
  return collectEarlierNames(blocks, blockId, assignBlockNames(blocks).proofs);
}

function collectEarlierNames(
  blocks: BlockInstance[],
  blockId: string,
  names: Map<string, string>,
): string[] {
  const found: string[] = [];
  for (const block of blocks) {
    if (block.id === blockId) break;
    const name = names.get(block.id);
    if (name && isBlockComplete(block)) found.push(name);
  }
  return found;
}

const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Comma-separated ids → `NonFungibleLocalId("…"), …` list. */
const nftIdList = (raw: string) =>
  raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `NonFungibleLocalId("${escape(id)}")`)
    .join(', ');

function blockToManifest(block: BlockInstance, names: BlockNames): string {
  const bucketName = names.buckets.get(block.id);
  const proofName = names.proofs.get(block.id);
  const addressNames = names.addresses.get(block.id);

  switch (block.type) {
    case 'withdraw':
      return `
CALL_METHOD
    Address("${value(block, 'account')}")
    "withdraw"
    Address("${value(block, 'resource')}")
    Decimal("${value(block, 'amount')}")
;
`;
    case 'withdrawNfts':
      return `
CALL_METHOD
    Address("${value(block, 'account')}")
    "withdraw_non_fungibles"
    Address("${value(block, 'resource')}")
    Array<NonFungibleLocalId>(${nftIdList(value(block, 'nftIds'))})
;
`;
    case 'depositBucket':
      return `
CALL_METHOD
    Address("${value(block, 'account')}")
    "try_deposit_or_abort"
    Bucket("${value(block, 'bucket')}")
    Enum<0u8>()
;
`;
    case 'depositAll':
      return `
CALL_METHOD
    Address("${value(block, 'account')}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
    case 'proof': {
      const nftId = value(block, 'nftId');
      return nftId
        ? `
CALL_METHOD
    Address("${value(block, 'account')}")
    "create_proof_of_non_fungibles"
    Address("${value(block, 'resource')}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${nftId}"))
;
`
        : `
CALL_METHOD
    Address("${value(block, 'account')}")
    "create_proof_of_amount"
    Address("${value(block, 'resource')}")
    Decimal("1")
;
`;
    }

    case 'comment': {
      const lines = value(block, 'text').split('\n');
      return `\n${lines.map((line) => `# ${line}`.trimEnd()).join('\n')}\n`;
    }

    case 'callMethod': {
      const args = value(block, 'args');
      return `
CALL_METHOD
    Address("${value(block, 'component')}")
    "${escape(value(block, 'method'))}"${args ? `\n    ${args}` : ''}
;
`;
    }

    case 'takeFromWorktop':
      return `
TAKE_FROM_WORKTOP
    Address("${value(block, 'resource')}")
    Decimal("${value(block, 'amount')}")
    Bucket("${bucketName}")
;
`;
    case 'takeAllFromWorktop':
      return `
TAKE_ALL_FROM_WORKTOP
    Address("${value(block, 'resource')}")
    Bucket("${bucketName}")
;
`;
    case 'takeNonFungiblesFromWorktop':
      return `
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${value(block, 'resource')}")
    Array<NonFungibleLocalId>(${nftIdList(value(block, 'nftIds'))})
    Bucket("${bucketName}")
;
`;
    case 'returnToWorktop':
      return `
RETURN_TO_WORKTOP
    Bucket("${value(block, 'bucket')}")
;
`;

    case 'assertWorktopContains':
      return `
ASSERT_WORKTOP_CONTAINS
    Address("${value(block, 'resource')}")
    Decimal("${value(block, 'amount')}")
;
`;
    case 'assertWorktopContainsAny':
      return `
ASSERT_WORKTOP_CONTAINS_ANY
    Address("${value(block, 'resource')}")
;
`;
    case 'assertWorktopContainsNonFungibles':
      return `
ASSERT_WORKTOP_CONTAINS_NON_FUNGIBLES
    Address("${value(block, 'resource')}")
    Array<NonFungibleLocalId>(${nftIdList(value(block, 'nftIds'))})
;
`;
    case 'assertWorktopIsEmpty':
      return `
ASSERT_WORKTOP_IS_EMPTY;
`;

    case 'burnResource':
      return `
BURN_RESOURCE
    Bucket("${value(block, 'bucket')}")
;
`;
    case 'mintFungible':
      return `
MINT_FUNGIBLE
    Address("${value(block, 'resource')}")
    Decimal("${value(block, 'amount')}")
;
`;
    case 'mintNonFungible':
      return `
MINT_NON_FUNGIBLE
    Address("${value(block, 'resource')}")
    Map<NonFungibleLocalId, Tuple>(
        NonFungibleLocalId("${escape(value(block, 'nftId'))}") => Tuple(
            Tuple(
                "${escape(value(block, 'name'))}",
                "${escape(value(block, 'description'))}",
                "${escape(value(block, 'imageUrl'))}"
            )
        )
    )
;
`;

    case 'popFromAuthZone':
      return `
POP_FROM_AUTH_ZONE
    Proof("${proofName}")
;
`;
    case 'pushToAuthZone':
      return `
PUSH_TO_AUTH_ZONE
    Proof("${value(block, 'proof')}")
;
`;
    case 'createProofFromAuthZoneOfAmount':
      return `
CREATE_PROOF_FROM_AUTH_ZONE_OF_AMOUNT
    Address("${value(block, 'resource')}")
    Decimal("${value(block, 'amount')}")
    Proof("${proofName}")
;
`;
    case 'createProofFromAuthZoneOfNonFungibles':
      return `
CREATE_PROOF_FROM_AUTH_ZONE_OF_NON_FUNGIBLES
    Address("${value(block, 'resource')}")
    Array<NonFungibleLocalId>(${nftIdList(value(block, 'nftIds'))})
    Proof("${proofName}")
;
`;
    case 'createProofFromAuthZoneOfAll':
      return `
CREATE_PROOF_FROM_AUTH_ZONE_OF_ALL
    Address("${value(block, 'resource')}")
    Proof("${proofName}")
;
`;
    case 'createProofFromBucketOfAmount':
      return `
CREATE_PROOF_FROM_BUCKET_OF_AMOUNT
    Bucket("${value(block, 'bucket')}")
    Decimal("${value(block, 'amount')}")
    Proof("${proofName}")
;
`;
    case 'createProofFromBucketOfNonFungibles':
      return `
CREATE_PROOF_FROM_BUCKET_OF_NON_FUNGIBLES
    Bucket("${value(block, 'bucket')}")
    Array<NonFungibleLocalId>(${nftIdList(value(block, 'nftIds'))})
    Proof("${proofName}")
;
`;
    case 'createProofFromBucketOfAll':
      return `
CREATE_PROOF_FROM_BUCKET_OF_ALL
    Bucket("${value(block, 'bucket')}")
    Proof("${proofName}")
;
`;
    case 'cloneProof':
      return `
CLONE_PROOF
    Proof("${value(block, 'proof')}")
    Proof("${proofName}")
;
`;
    case 'dropProof':
      return `
DROP_PROOF
    Proof("${value(block, 'proof')}")
;
`;
    case 'dropAllProofs':
      return `
DROP_ALL_PROOFS;
`;
    case 'dropAuthZoneProofs':
      return `
DROP_AUTH_ZONE_PROOFS;
`;
    case 'dropAuthZoneRegularProofs':
      return `
DROP_AUTH_ZONE_REGULAR_PROOFS;
`;
    case 'dropAuthZoneSignatureProofs':
      return `
DROP_AUTH_ZONE_SIGNATURE_PROOFS;
`;

    case 'allocateGlobalAddress':
      return `
ALLOCATE_GLOBAL_ADDRESS
    Address("${value(block, 'packageAddress')}")
    "${escape(value(block, 'blueprint'))}"
    AddressReservation("${addressNames?.reservation}")
    NamedAddress("${addressNames?.address}")
;
`;

    case 'setMetadata':
      return `
SET_METADATA
    Address("${value(block, 'entity')}")
    "${escape(value(block, 'metadataKey'))}"
    Enum<Metadata::String>("${escape(value(block, 'value'))}")
;
`;

    case 'raw': {
      const raw = value(block, 'instructions');
      return raw.endsWith(';') ? `\n${raw}\n` : `\n${raw}\n;\n`;
    }

    case 'snippetCreateFungible': {
      const divisibility = value(block, 'divisibility') || '18';
      return `
CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    Enum<OwnerRole::None>()
    true
    ${divisibility}u8
    Decimal("${value(block, 'initialSupply')}")
    Tuple(
        None,
        None,
        None,
        None,
        None,
        None
    )
    Tuple(
        Map<String, Tuple>(
            "name" => Tuple(Some(Enum<Metadata::String>("${escape(value(block, 'name'))}")), true),
            "symbol" => Tuple(Some(Enum<Metadata::String>("${escape(value(block, 'symbol'))}")), true)
        ),
        Map<String, Enum>()
    )
    None
;
CALL_METHOD
    Address("${value(block, 'account')}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
    }
    case 'snippetCreateNonFungible':
      return `
CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    Enum<OwnerRole::None>()
    Enum<1u8>()
    true
    Enum<0u8>(
      Enum<0u8>(
          Tuple(
              Array<Enum>(
                  Enum<14u8>(
                      Array<Enum>(
                          Enum<0u8>(12u8),
                          Enum<0u8>(12u8),
                          Enum<0u8>(12u8)
                      )
                  )
              ),
              Array<Tuple>(
                  Tuple(
                      Enum<1u8>("DataSchema"),
                      Enum<1u8>(
                          Enum<0u8>(
                              Array<String>(
                                  "name",
                                  "description",
                                  "key_image_url"
                              )
                          )
                      )
                  )
              ),
              Array<Enum>(
                  Enum<0u8>()
              )
          )
      ),
      Enum<1u8>(0u64),
      Array<String>()
    )
    Map<NonFungibleLocalId, Tuple>(
      NonFungibleLocalId("#0#") => Tuple(
        Tuple(
          "${escape(value(block, 'nftName'))}",
          "${escape(value(block, 'nftDescription'))}",
          "${escape(value(block, 'nftImageUrl'))}"
        )
      )
    )
    Tuple(
      None,
      None,
      None,
      None,
      None,
      None,
      None
    )
    Tuple(
      Map<String, Tuple>(
          "name" => Tuple(Some(Enum<Metadata::String>("${escape(value(block, 'name'))}")), true)
      ),
      Map<String, Enum>()
    )
    Enum<0u8>()
;
CALL_METHOD
    Address("${value(block, 'account')}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
  }
}

export interface BlocksManifestResult {
  manifest: string;
  /** Ids of blocks skipped because required fields are missing */
  incompleteIds: string[];
}

export function buildManifestFromBlocks(blocks: BlockInstance[]): BlocksManifestResult {
  const names = assignBlockNames(blocks);
  const incompleteIds: string[] = [];
  const parts: string[] = [];

  for (const block of blocks) {
    if (!isBlockComplete(block)) {
      incompleteIds.push(block.id);
    }
    parts.push(blockToManifest(block, names));
  }

  return { manifest: parts.join('').trim() ? parts.join('') : '', incompleteIds };
}
