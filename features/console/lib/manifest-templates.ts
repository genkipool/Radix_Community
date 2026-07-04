/**
 * Ready-made manifest templates for the build-manifest tool.
 * All user-facing labels live in the locales under console.buildManifest.
 */


import { buildBadgeProofManifest } from './badge-proof-manifest';
import { setStringMetadata } from './metadata-manifests';
import { freezeVaultManifest, lockMetadataManifest, type FreezeFlag } from './resource-actions';

const escapeStr = (text: string) => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

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
  /** Validator owner badge resource of the active network (owner/vote templates) */
  validatorOwnerBadge: string;
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
    id: 'stake-owner',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'ownerBadge', kind: 'resource' },
      { key: 'ownerBadgeId', kind: 'nonFungibleId' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values, ctx) =>
      buildBadgeProofManifest([
        {
          accountAddress: v(values, 'account'),
          resourceAddress: v(values, 'ownerBadge'),
          nonFungibleId: v(values, 'ownerBadgeId'),
        },
      ]) +
      `
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
    "stake_as_owner"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`,
  },
  {
    id: 'unstake-owner',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'ownerBadge', kind: 'resource' },
      { key: 'ownerBadgeId', kind: 'nonFungibleId' },
      { key: 'lsuResource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        {
          accountAddress: v(values, 'account'),
          resourceAddress: v(values, 'ownerBadge'),
          nonFungibleId: v(values, 'ownerBadgeId'),
        },
      ]) +
      `
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
`,
  },
  {
    id: 'claim-stake',
    icon: 'landmark',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'claimNft', kind: 'resource' },
      { key: 'claimNftId', kind: 'nonFungibleId' },
    ],
    build: (values) => `
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "withdraw_non_fungibles"
    Address("${v(values, 'claimNft') || '{claimNft}'}")
    Array<NonFungibleLocalId>(${(v(values, 'claimNftId') || '{claimNftId}')
      .split(',')
      .map((id) => `NonFungibleLocalId("${id.trim()}")`)
      .join(', ')})
;
TAKE_ALL_FROM_WORKTOP
    Address("${v(values, 'claimNft') || '{claimNft}'}")
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'validator') || '{validator}'}")
    "claim_xrd"
    Bucket("bucket1")
;
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`,
  },
  {
    id: 'lock-owner-stake',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'ownerBadge', kind: 'resource' },
      { key: 'ownerBadgeId', kind: 'nonFungibleId' },
      { key: 'lsuResource', kind: 'resource' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        {
          accountAddress: v(values, 'account'),
          resourceAddress: v(values, 'ownerBadge'),
          nonFungibleId: v(values, 'ownerBadgeId'),
        },
      ]) +
      `
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
    "lock_owner_stake_units"
    Bucket("bucket1")
;
`,
  },
  {
    id: 'start-unlock-owner-stake',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'ownerBadge', kind: 'resource' },
      { key: 'ownerBadgeId', kind: 'nonFungibleId' },
      { key: 'amount', kind: 'decimal' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        {
          accountAddress: v(values, 'account'),
          resourceAddress: v(values, 'ownerBadge'),
          nonFungibleId: v(values, 'ownerBadgeId'),
        },
      ]) +
      `
CALL_METHOD
    Address("${v(values, 'validator') || '{validator}'}")
    "start_unlock_owner_stake_units"
    Decimal("${v(values, 'amount') || '{amount}'}")
;
`,
  },
  {
    id: 'finish-unlock-owner-stake',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'ownerBadge', kind: 'resource' },
      { key: 'ownerBadgeId', kind: 'nonFungibleId' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        {
          accountAddress: v(values, 'account'),
          resourceAddress: v(values, 'ownerBadge'),
          nonFungibleId: v(values, 'ownerBadgeId'),
        },
      ]) +
      `
CALL_METHOD
    Address("${v(values, 'validator') || '{validator}'}")
    "finish_unlock_owner_stake_units"
;
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`,
  },
  {
    id: 'signal-protocol-update',
    icon: 'crown',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'validator', kind: 'address' },
      { key: 'ownerBadgeId', kind: 'nonFungibleId' },
      { key: 'version', kind: 'text' },
    ],
    build: (values, ctx) =>
      buildBadgeProofManifest([
        {
          accountAddress: v(values, 'account'),
          resourceAddress: ctx.validatorOwnerBadge,
          nonFungibleId: v(values, 'ownerBadgeId'),
        },
      ]) +
      `
CALL_METHOD
    Address("${v(values, 'validator') || '{validator}'}")
    "signal_protocol_update_readiness"
    "${escapeStr(v(values, 'version'))}"
;
`,
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
    id: 'mint-nft',
    icon: 'image',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'resource', kind: 'resource' },
      { key: 'nftId', kind: 'nonFungibleId' },
      { key: 'name', kind: 'text' },
      { key: 'description', kind: 'text', optional: true },
      { key: 'imageUrl', kind: 'text', optional: true },
      { key: 'to', kind: 'address' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
      ]) +
      `
MINT_NON_FUNGIBLE
    Address("${v(values, 'resource')}")
    Map<NonFungibleLocalId, Tuple>(
        NonFungibleLocalId("${v(values, 'nftId')}") => Tuple(
            Tuple(
                "${escapeStr(v(values, 'name'))}",
                "${escapeStr(v(values, 'description'))}",
                "${escapeStr(v(values, 'imageUrl'))}"
            )
        )
    )
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
    id: 'burn-nft',
    icon: 'flame',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'account', kind: 'account' },
      { key: 'resource', kind: 'resource' },
      { key: 'nftIds', kind: 'nonFungibleId' },
    ],
    build: (values) => {
      const ids = (v(values, 'nftIds') || '{nftIds}')
        .split(',')
        .map((id) => `NonFungibleLocalId("${id.trim()}")`)
        .join(', ');
      return `
CALL_METHOD
    Address("${v(values, 'account') || '{account}'}")
    "withdraw_non_fungibles"
    Address("${v(values, 'resource') || '{resource}'}")
    Array<NonFungibleLocalId>(${ids})
;
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${v(values, 'resource') || '{resource}'}")
    Array<NonFungibleLocalId>(${ids})
    Bucket("bucket1")
;
BURN_RESOURCE
    Bucket("bucket1")
;
`;
    },
  },
  {
    id: 'update-nft-data',
    icon: 'tags',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'resource', kind: 'address' },
      { key: 'nftId', kind: 'nonFungibleId' },
      { key: 'field', kind: 'text' },
      { key: 'value', kind: 'text' },
    ],
    build: (values) => `
CALL_METHOD
    Address("${v(values, 'resource') || '{resource}'}")
    "update_non_fungible_data"
    NonFungibleLocalId("${v(values, 'nftId') || '{nftId}'}")
    "${escapeStr(v(values, 'field'))}"
    "${escapeStr(v(values, 'value'))}"
;
`,
  },
  {
    id: 'update-nft-data-badge',
    icon: 'tags',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'badgeNftId', kind: 'nonFungibleId', optional: true },
      { key: 'resource', kind: 'address' },
      { key: 'nftId', kind: 'nonFungibleId' },
      { key: 'field', kind: 'text' },
      { key: 'value', kind: 'text' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        {
          accountAddress: v(values, 'badgeAccount'),
          resourceAddress: v(values, 'badgeResource'),
          nonFungibleId: v(values, 'badgeNftId') || undefined,
        },
      ]) +
      `
CALL_METHOD
    Address("${v(values, 'resource') || '{resource}'}")
    "update_non_fungible_data"
    NonFungibleLocalId("${v(values, 'nftId') || '{nftId}'}")
    "${escapeStr(v(values, 'field'))}"
    "${escapeStr(v(values, 'value'))}"
;
`,
  },
  {
    id: 'recall-token',
    icon: 'undo',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'vault', kind: 'address' },
      { key: 'amount', kind: 'decimal' },
      { key: 'to', kind: 'address' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
      ]) +
      `
RECALL_FROM_VAULT
    Address("${v(values, 'vault') || '{vault}'}")
    Decimal("${v(values, 'amount') || '{amount}'}")
;
CALL_METHOD
    Address("${v(values, 'to') || '{to}'}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`,
  },
  {
    id: 'recall-nft',
    icon: 'undo',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'vault', kind: 'address' },
      { key: 'nftIds', kind: 'nonFungibleId' },
      { key: 'to', kind: 'address' },
    ],
    build: (values) => {
      const ids = (v(values, 'nftIds') || '{nftIds}')
        .split(',')
        .map((id) => `NonFungibleLocalId("${id.trim()}")`)
        .join(', ');
      return (
        buildBadgeProofManifest([
          { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
        ]) +
        `
RECALL_NON_FUNGIBLES_FROM_VAULT
    Address("${v(values, 'vault') || '{vault}'}")
    Array<NonFungibleLocalId>(${ids})
;
CALL_METHOD
    Address("${v(values, 'to') || '{to}'}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`
      );
    },
  },
  {
    id: 'freeze-vault',
    icon: 'undo',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'vault', kind: 'address' },
      { key: 'flag', kind: 'choice', options: ['withdraw', 'deposit', 'burn', 'all'] },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
      ]) + freezeVaultManifest(v(values, 'vault'), (v(values, 'flag') || 'all') as FreezeFlag, true),
  },
  {
    id: 'unfreeze-vault',
    icon: 'undo',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'vault', kind: 'address' },
      { key: 'flag', kind: 'choice', options: ['withdraw', 'deposit', 'burn', 'all'] },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
      ]) + freezeVaultManifest(v(values, 'vault'), (v(values, 'flag') || 'all') as FreezeFlag, false),
  },
  {
    id: 'lock-metadata',
    icon: 'tags',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    fields: [
      { key: 'badgeAccount', kind: 'account' },
      { key: 'badgeResource', kind: 'resource' },
      { key: 'entity', kind: 'address' },
      { key: 'metadataKey', kind: 'text' },
    ],
    build: (values) =>
      buildBadgeProofManifest([
        { accountAddress: v(values, 'badgeAccount'), resourceAddress: v(values, 'badgeResource') },
      ]) + lockMetadataManifest(v(values, 'entity'), v(values, 'metadataKey')),
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
