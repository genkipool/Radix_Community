/**
 * One-time deploy of the global "Radix Seal" brand resource (v2) + each
 * user's self-mint of their own seal NFT.
 *
 * v2 design: the brand is an OPEN-MINT, soulbound, RUID-id collection.
 * Anyone mints exactly one seal for themselves; that seal NFT is their
 * insignia and the owner badge of their personal signing collection. RUID
 * ids make concurrent public mints race-free. Withdraw/burn/recall are
 * denied forever, so a seal can never move to another account — which is
 * what lets verifiers treat "collection gated by seal X, and seal X lives
 * in account S" as proof that the collection belongs to S.
 *
 * Run the deploy ONCE per network; the resulting resource address is then
 * hardcoded in `features/sign/constants/seal.ts`.
 */
import {
  accessRuleToManifestSyntax,
  authRolePairSyntax,
} from '@/features/console/lib/access-rules';
import {
  escapeManifestString,
  initialMetadataArrayEntry,
  initialMetadataEntry,
  lockedMetadataRoles,
  ownerEditableMetadataRoles,
  MetadataType,
  nfSchema,
  sealBrandRoles,
} from './nf-manifest-helpers';
import { RADIX_SEAL_NAME, SEAL_INFO_URL } from '../constants/seal';

export interface RadixSealDeployInput {
  /** Absolute URL of the hosted seal image (icon_url). */
  imageUrl: string;
  /** App origin (kept for compatibility; info_url now points to the docs). */
  origin: string;
  /** Optional dApp definition account for the verified two-way link. */
  dAppDefinition?: string;
  /**
   * Fungible admin badge resource. When provided, the resource's OWNER role
   * requires this badge and the brand metadata (name, description, icon_url,
   * info_url, tags) is left EDITABLE by that owner. Holding the badge is the
   * ONLY way to edit the brand later; the rule itself is locked forever. When
   * omitted the metadata stays fully locked (legacy, immutable behaviour).
   */
  adminBadge?: string;
}

/**
 * Creates the open-mint soulbound brand resource. Nothing is minted here —
 * the deployer gets their own seal through the normal self-mint like
 * everyone else. With `adminBadge`, brand metadata stays editable by that
 * badge; without it, metadata is immutable.
 */
export function buildRadixSealDeployManifest({
  imageUrl,
  dAppDefinition,
  adminBadge,
}: RadixSealDeployInput): string {
  // Admin-editable deploy: unlock the brand metadata so the owner (admin badge)
  // can update it later. Immutable deploy: lock every entry.
  const brandLocked = !adminBadge;
  const metadata = [
    initialMetadataEntry('name', RADIX_SEAL_NAME, brandLocked),
    initialMetadataEntry(
      'description',
      'Radix Seal is the standard for self-custody document signatures on the ' +
        'Radix Network. Anyone mints their own soulbound seal; it marks them ' +
        'as a signer and owns their personal signing collection.',
      brandLocked,
    ),
    initialMetadataEntry('icon_url', imageUrl, brandLocked, MetadataType.Url),
    // Points to the full Radix Seal documentation on GitHub.
    initialMetadataEntry('info_url', SEAL_INFO_URL, brandLocked, MetadataType.Url),
    initialMetadataArrayEntry(
      'tags',
      ['radix-seal', 'attestation', 'certificate-authority'],
      brandLocked,
    ),
    ...(dAppDefinition
      ? [initialMetadataArrayEntry('dapp_definitions', [dAppDefinition], false)]
      : []),
  ].join(',\n          ');

  // Owner role: the admin badge when given (so metadata_setter = owner works),
  // otherwise no owner at all (fully immutable brand).
  const ownerRole = adminBadge
    ? accessRuleToManifestSyntax({ type: 'fungible', address: adminBadge }, 'Fixed')
    : 'None';
  const metadataRoles = adminBadge
    ? ownerEditableMetadataRoles()
    : lockedMetadataRoles();

  return `CREATE_NON_FUNGIBLE_RESOURCE
    ${ownerRole}
    Enum<3u8>()
    true
    ${nfSchema([])}
    Tuple(
        ${sealBrandRoles()}
    )
    Tuple(
      Map<String, Tuple>(
          ${metadata}
      ),
      Map<String, Enum>(
            ${metadataRoles}
      )
    )
    None
;
`;
}

export interface SealAdminBadgeInput {
  /** Account that receives the single admin badge. */
  account: string;
  imageUrl: string;
}

/**
 * Fixed-supply-1 fungible badge roles: minting is DENIED forever (the admin
 * authority can never be duplicated), burn/freeze/recall denied, but the badge
 * is transferable so it can be moved into an access controller / multisig.
 */
const adminBadgeRoles = () =>
  [
    authRolePairSyntax('denyAll', 'denyAll'), // minter: none, forever
    authRolePairSyntax('denyAll', 'denyAll'), // burner
    authRolePairSyntax('denyAll', 'denyAll'), // freezer
    authRolePairSyntax('denyAll', 'denyAll'), // recaller
    authRolePairSyntax('allowAll', 'denyAll'), // withdrawer: movable to a multisig
    authRolePairSyntax('allowAll', 'denyAll'), // depositer
  ].join(`,
        `);

/**
 * Mints a one-off fungible "Radix Seal Admin" badge (supply 1) into the
 * deployer's account. Its resource address is then passed as `adminBadge` to
 * the deploy so the brand metadata is editable only by whoever holds it. Keep
 * it safe (ideally move it into an access controller / multisig).
 */
export function buildSealAdminBadgeManifest({
  account,
  imageUrl,
}: SealAdminBadgeInput): string {
  const metadata = [
    initialMetadataEntry('name', 'Radix Seal Admin', true),
    initialMetadataEntry(
      'description',
      'Admin badge for the Radix Seal brand resource. Its holder can edit the ' +
        'brand metadata (name, image, description). Keep it safe.',
      true,
    ),
    initialMetadataEntry('icon_url', imageUrl, true, MetadataType.Url),
    initialMetadataArrayEntry('tags', ['radix-seal', 'admin-badge'], true),
  ].join(',\n          ');

  return `CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    None
    true
    0u8
    Decimal("1")
    Tuple(
        ${adminBadgeRoles()}
    )
    Tuple(
      Map<String, Tuple>(
          ${metadata}
      ),
      Map<String, Enum>(
            ${lockedMetadataRoles()}
      )
    )
    None
;

CALL_METHOD
    Address("${account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
}

export interface SealMintInput {
  /** Account that receives its own seal NFT. */
  account: string;
  /** Deployed seal brand resource. */
  sealResource: string;
  /** Image shown on the seal NFT. */
  imageUrl: string;
}

/** Self-mints one soulbound seal NFT (RUID id) into the user's account. */
export function buildSealMintManifest({
  account,
  sealResource,
  imageUrl,
}: SealMintInput): string {
  return `MINT_RUID_NON_FUNGIBLE
    Address("${sealResource}")
    Array<Tuple>(
        Tuple(
            Tuple(
                "${RADIX_SEAL_NAME}",
                "Personal Radix Seal insignia. Soulbound; owns this account's signing collection.",
                "${escapeManifestString(imageUrl)}"
            )
        )
    )
;

CALL_METHOD
    Address("${account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
}
