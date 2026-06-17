/**
 * Ready-made manifest templates for the build-manifest tool.
 * All user-facing labels live in the locales under console.buildManifest.
 */


import { buildBadgeProofManifest } from './badge-proof-manifest';
import { setStringMetadata } from './metadata-manifests';

export type TemplateFieldKind =
  | 'account'
  | 'address'
  | 'resource'
  | 'decimal'
  | 'text'
  | 'nonFungibleId'
  | 'choice';

export interface TemplateField {
  key: string;
  kind: TemplateFieldKind;
  optional?: boolean;
  /** Options for the 'choice' kind (labels come from the locales) */
  options?: string[];
}

export interface TemplateContext {
  /** XRD resource address of the active network (for staking templates) */
  xrdAddress: string;
  /** Native pool package address of the active network (for pool templates) */
  poolPackage: string;
}

export interface ManifestTemplate {
  id: string;
  icon:
    | 'send'
    | 'image'
    | 'landmark'
    | 'undo'
    | 'coins'
    | 'flame'
    | 'tags'
    | 'braces'
    | 'droplets'
    | 'crown';
  gradient: string;
  fields: TemplateField[];
  build: (values: Record<string, string>, ctx: TemplateContext) => string;
}

const v = (values: Record<string, string>, key: string) => (values[key] ?? '').trim();

const DEPOSIT_ALL = (account: string) => `
CALL_METHOD
    Address("${account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;

export const MANIFEST_TEMPLATES: ManifestTemplate[] = [
  {
    id: 'transfer-tokens',
    icon: 'send',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'from', kind: 'account' },
      { key: 'to', kind: 'address' },
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values) => `
CALL_METHOD
    Address("${v(values, 'from') || '{from}'}")
    "withdraw"
    Address("${v(values, 'resource') || '{resource}'}")
    Decimal("${v(values, 'amount') || '{amount}'}")
;
TAKE_FROM_WORKTOP
    Address("${v(values, 'resource') || '{resource}'}")
    Decimal("${v(values, 'amount') || '{amount}'}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'to') || '{to}'}")
    "try_deposit_or_abort"
    Bucket("bucket1")
    Enum<0u8>()
;
`.trim(),
  },
  {
    id: 'transfer-nft',
    icon: 'image',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'from', kind: 'account' },
      { key: 'to', kind: 'address' },
      { key: 'resource', kind: 'resource' },
      { key: 'nftId', kind: 'nonFungibleId' },
    ],
    build: (values) => {
      const ids = v(values, 'nftId');
      const formattedIds = ids
        ? ids.split(',').map((id) => `NonFungibleLocalId("${id.trim()}")`).join(', ')
        : 'NonFungibleLocalId("{nftId}")';
        
      return `
CALL_METHOD
    Address("${v(values, 'from') || '{from}'}")
    "withdraw_non_fungibles"
    Address("${v(values, 'resource') || '{resource}'}")
    Array<NonFungibleLocalId>(${formattedIds})
;
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${v(values, 'resource') || '{resource}'}")
    Array<NonFungibleLocalId>(${formattedIds})
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'to') || '{to}'}")
    "try_deposit_or_abort"
    Bucket("bucket1")
    Enum<0u8>()
;
`.trim();
    },
  },
  {
    id: 'stake',
    icon: 'landmark',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values, ctx) => `
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "withdraw"
    Address("${ctx.xrdAddress}")
    Decimal("${v(values, 'amount') || '{amount}'}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${ctx.xrdAddress}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'validator') || '{validator}'}")
    "stake"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`.trim(),
  },
  {
    id: 'unstake',
    icon: 'undo',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'lsuResource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values) => `
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "withdraw"
    Address("${v(values, 'lsuResource') || '{lsuResource}'}")
    Decimal("${v(values, 'amount') || '{amount}'}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${v(values, 'lsuResource') || '{lsuResource}'}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'validator') || '{validator}'}")
    "unstake"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`.trim(),
  },
  {
    id: 'mint-fungible',
    icon: 'coins',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
      { key: 'to', kind: 'address' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
      ]) +
      `
MINT_FUNGIBLE
    Address("${v(values, 'resource')}")
    Decimal("${v(values, 'amount')}")
;
CALL_METHOD
    Address("${v(values, 'to')}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`,
  },
  {
    id: 'burn',
    icon: 'flame',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values) => `
CALL_METHOD
    Address("${v(values, 'account')}")
    "withdraw"
    Address("${v(values, 'resource')}")
    Decimal("${v(values, 'amount')}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${v(values, 'resource')}")
    Bucket("bucket1")
;
BURN_RESOURCE
    Bucket("bucket1")
;
`,
  },
  {
    id: 'set-metadata',
    icon: 'tags',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'entity', kind: 'address' },
      { key: 'metadataKey', kind: 'text' },
      { key: 'value', kind: 'text' },
    ],
    build: (values) =>
      setStringMetadata(v(values, 'entity'), v(values, 'metadataKey'), v(values, 'value')),
  },
  {
    id: 'call-method',
    icon: 'braces',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'component', kind: 'address' },
      { key: 'method', kind: 'text' },
      { key: 'account', kind: 'account' },
    ],
    build: (values) => `
CALL_METHOD
    Address("${v(values, 'component')}")
    "${v(values, 'method')}"
;
CALL_METHOD
    Address("${v(values, 'account')}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`,
  },
  {
    id: 'create-pool',
    icon: 'droplets',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'poolType', kind: 'choice', options: ['OneResourcePool', 'TwoResourcePool', 'MultiResourcePool'] },
      { key: 'resources', kind: 'text' },
    ],
    build: (values, ctx) => {
      const poolType = v(values, 'poolType');
      const addresses = v(values, 'resources').split(',').map((a) => a.trim()).filter(Boolean);
      const resourcesArg =
        poolType === 'OneResourcePool'
          ? `Address("${addresses[0] ?? ''}")`
          : poolType === 'TwoResourcePool'
            ? `Tuple(${addresses.map((a) => `Address("${a}")`).join(', ')})`
            : `Array<Address>(${addresses.map((a) => `Address("${a}")`).join(', ')})`;
      return `
CALL_FUNCTION
    Address("${ctx.poolPackage}")
    "${poolType}"
    "instantiate"
    Enum<OwnerRole::Fixed>(Enum<AccessRule::AllowAll>())
    Enum<AccessRule::AllowAll>()
    ${resourcesArg}
    None
;
`;
    },
  },
  {
    id: 'contribute-pool',
    icon: 'droplets',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'pool', kind: 'address' },
      { key: 'resource1', kind: 'resource' },
      { key: 'amount1', kind: 'decimal' },
      { key: 'resource2', kind: 'resource', optional: true },
      { key: 'amount2', kind: 'decimal', optional: true },
    ],
    build: (values) => {
      const account = v(values, 'account');
      const contributions = [
        { resource: v(values, 'resource1'), amount: v(values, 'amount1') },
        { resource: v(values, 'resource2'), amount: v(values, 'amount2') },
      ].filter((c) => c.resource && c.amount);

      const buckets = contributions
        .map(
          (c, i) => `
CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${c.resource}")
    Decimal("${c.amount}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${c.resource}")
    Bucket("bucket${i + 1}")
;`,
        )
        .join('');
      const bucketRefs = contributions.map((_, i) => `Bucket("bucket${i + 1}")`);
      const contributionArg =
        bucketRefs.length === 1 ? bucketRefs[0] : `Tuple(${bucketRefs.join(', ')})`;

      return `${buckets}
CALL_METHOD
    Address("${v(values, 'pool')}")
    "contribute"
    ${contributionArg}
;
${DEPOSIT_ALL(account)}`;
    },
  },
  {
    id: 'redeem-pool',
    icon: 'droplets',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'pool', kind: 'address' },
      { key: 'poolUnit', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values) => `
CALL_METHOD
    Address("${v(values, 'account')}")
    "withdraw"
    Address("${v(values, 'poolUnit')}")
    Decimal("${v(values, 'amount')}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${v(values, 'poolUnit')}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'pool')}")
    "redeem"
    Bucket("bucket1")
;
${DEPOSIT_ALL(v(values, 'account'))}`,
  },
  {
    id: 'set-royalty',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'component', kind: 'address' },
      { key: 'method', kind: 'text' },
      { key: 'currency', kind: 'choice', options: ['Xrd', 'Usd', 'Free'] },
      { key: 'amount', kind: 'decimal', optional: true },
    ],
    build: (values) => {
      const currency = v(values, 'currency');
      const royaltyAmount =
        currency === 'Free'
          ? 'Enum<RoyaltyAmount::Free>()'
          : `Enum<RoyaltyAmount::${currency}>(Decimal("${v(values, 'amount') || '0'}"))`;
      return (
        buildBadgeProofManifest([
          { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
        ]) +
        `
SET_COMPONENT_ROYALTY
    Address("${v(values, 'component')}")
    "${v(values, 'method')}"
    ${royaltyAmount}
;
`
      );
    },
  },
  {
    id: 'claim-royalties',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'component', kind: 'address' },
      { key: 'account', kind: 'account' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
      ]) +
      `
CLAIM_COMPONENT_ROYALTIES
    Address("${v(values, 'component')}")
;
${DEPOSIT_ALL(v(values, 'account'))}`,
  },
];

export const isTemplateComplete = (template: ManifestTemplate, values: Record<string, string>) =>
  template.fields.every((field) => field.optional || v(values, field.key).length > 0);
