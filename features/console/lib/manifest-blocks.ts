/**
 * Block-based manifest building for the build-manifest tool.
 *
 * A manifest is composed as an ordered list of blocks; each block maps to one
 * or two manifest instructions. Buckets created by "take" blocks are
 * auto-named (bucket1, bucket2, …) and offered to later "deposit" blocks.
 * All user-facing labels live in the locales under console.buildManifest.
 */

export type BlockType =
  | 'withdraw'
  | 'withdrawNfts'
  | 'takeFromWorktop'
  | 'takeAllFromWorktop'
  | 'depositBucket'
  | 'depositAll'
  | 'proof'
  | 'setMetadata'
  | 'callMethod'
  | 'raw';

export type BlockFieldKind =
  | 'account'
  | 'address'
  | 'resource'
  | 'decimal'
  | 'text'
  | 'bucket'
  | 'multiline';

export interface BlockField {
  key: string;
  kind: BlockFieldKind;
  optional?: boolean;
}

export interface BlockDef {
  type: BlockType;
  icon: 'upload' | 'image' | 'package' | 'download' | 'badge' | 'tags' | 'braces' | 'code';
  gradient: string;
  accentRgb: string;
  fields: BlockField[];
  /** The block creates a worktop bucket consumable by later blocks */
  producesBucket?: boolean;
}

export const BLOCK_DEFS: Record<BlockType, BlockDef> = {
  withdraw: {
    type: 'withdraw',
    icon: 'upload',
    gradient: 'from-blue-500 to-cyan-400',
    accentRgb: '59,130,246',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  withdrawNfts: {
    type: 'withdrawNfts',
    icon: 'image',
    gradient: 'from-fuchsia-500 to-pink-500',
    accentRgb: '217,70,239',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'nftIds', kind: 'text' },
    ],
  },
  takeFromWorktop: {
    type: 'takeFromWorktop',
    icon: 'package',
    gradient: 'from-indigo-500 to-violet-500',
    accentRgb: '99,102,241',
    producesBucket: true,
    fields: [
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
  },
  takeAllFromWorktop: {
    type: 'takeAllFromWorktop',
    icon: 'package',
    gradient: 'from-indigo-500 to-violet-500',
    accentRgb: '99,102,241',
    producesBucket: true,
    fields: [{ key: 'resource', kind: 'resource' }],
  },
  depositBucket: {
    type: 'depositBucket',
    icon: 'download',
    gradient: 'from-emerald-500 to-teal-400',
    accentRgb: '16,185,129',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'bucket', kind: 'bucket' },
    ],
  },
  depositAll: {
    type: 'depositAll',
    icon: 'download',
    gradient: 'from-emerald-500 to-teal-400',
    accentRgb: '16,185,129',
    fields: [{ key: 'account', kind: 'account' }],
  },
  proof: {
    type: 'proof',
    icon: 'badge',
    gradient: 'from-amber-400 to-orange-500',
    accentRgb: '245,158,11',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'nftId', kind: 'text', optional: true },
    ],
  },
  setMetadata: {
    type: 'setMetadata',
    icon: 'tags',
    gradient: 'from-sky-500 to-indigo-500',
    accentRgb: '14,165,233',
    fields: [
      { key: 'entity', kind: 'address' },
      { key: 'metadataKey', kind: 'text' },
      { key: 'value', kind: 'text' },
    ],
  },
  callMethod: {
    type: 'callMethod',
    icon: 'braces',
    gradient: 'from-slate-500 to-slate-400',
    accentRgb: '100,116,139',
    fields: [
      { key: 'component', kind: 'address' },
      { key: 'method', kind: 'text' },
      { key: 'args', kind: 'multiline', optional: true },
    ],
  },
  raw: {
    type: 'raw',
    icon: 'code',
    gradient: 'from-rose-500 to-orange-400',
    accentRgb: '244,63,94',
    fields: [{ key: 'instructions', kind: 'multiline' }],
  },
};

/** Palette order shown in the builder UI. */
export const BLOCK_PALETTE: BlockType[] = [
  'withdraw',
  'withdrawNfts',
  'takeFromWorktop',
  'takeAllFromWorktop',
  'depositBucket',
  'depositAll',
  'proof',
  'setMetadata',
  'callMethod',
  'raw',
];

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

/**
 * Names the buckets each block of the list would produce, in order.
 * Returns a map blockId → bucket name (only for producing blocks).
 */
export function assignBucketNames(blocks: BlockInstance[]): Map<string, string> {
  const names = new Map<string, string>();
  let counter = 0;
  for (const block of blocks) {
    if (BLOCK_DEFS[block.type].producesBucket) {
      counter += 1;
      names.set(block.id, `bucket${counter}`);
    }
  }
  return names;
}

/** Buckets available to a block: those produced by earlier complete blocks. */
export function availableBuckets(blocks: BlockInstance[], blockId: string): string[] {
  const names = assignBucketNames(blocks);
  const buckets: string[] = [];
  for (const block of blocks) {
    if (block.id === blockId) break;
    const name = names.get(block.id);
    if (name && isBlockComplete(block)) buckets.push(name);
  }
  return buckets;
}

const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function blockToManifest(block: BlockInstance, bucketName: string | undefined): string {
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
    case 'withdrawNfts': {
      const ids = value(block, 'nftIds').split(',').map((id) => id.trim()).filter(Boolean);
      return `
CALL_METHOD
    Address("${value(block, 'account')}")
    "withdraw_non_fungibles"
    Address("${value(block, 'resource')}")
    Array<NonFungibleLocalId>(${ids.map((id) => `NonFungibleLocalId("${id}")`).join(', ')})
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
    case 'setMetadata':
      return `
SET_METADATA
    Address("${value(block, 'entity')}")
    "${escape(value(block, 'metadataKey'))}"
    Enum<Metadata::String>("${escape(value(block, 'value'))}")
;
`;
    case 'callMethod': {
      const args = value(block, 'args');
      return `
CALL_METHOD
    Address("${value(block, 'component')}")
    "${escape(value(block, 'method'))}"${args ? `\n    ${args}` : ''}
;
`;
    }
    case 'raw': {
      const raw = value(block, 'instructions');
      return raw.endsWith(';') ? `\n${raw}\n` : `\n${raw}\n;\n`;
    }
  }
}

export interface BlocksManifestResult {
  manifest: string;
  /** Ids of blocks skipped because required fields are missing */
  incompleteIds: string[];
}

export function buildManifestFromBlocks(blocks: BlockInstance[]): BlocksManifestResult {
  const bucketNames = assignBucketNames(blocks);
  const incompleteIds: string[] = [];
  const parts: string[] = [];

  for (const block of blocks) {
    if (!isBlockComplete(block)) {
      incompleteIds.push(block.id);
    }
    parts.push(blockToManifest(block, bucketNames.get(block.id)));
  }

  return { manifest: parts.join('').trim() ? parts.join('') : '', incompleteIds };
}
