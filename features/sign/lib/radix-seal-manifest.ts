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
  escapeManifestString,
  initialMetadataArrayEntry,
  initialMetadataEntry,
  lockedMetadataRoles,
  MetadataType,
  nfSchema,
  sealBrandRoles,
} from './nf-manifest-helpers';
import { RADIX_SEAL_NAME } from '../constants/seal';

export interface RadixSealDeployInput {
  /** Absolute URL of the hosted seal image (icon_url). */
  imageUrl: string;
  /** App origin, used for info_url. */
  origin: string;
  /** Optional dApp definition account for the verified two-way link. */
  dAppDefinition?: string;
}

/**
 * Creates the open-mint soulbound brand resource. Nothing is minted here —
 * the deployer gets their own seal through the normal self-mint like
 * everyone else.
 */
export function buildRadixSealDeployManifest({
  imageUrl,
  origin,
  dAppDefinition,
}: RadixSealDeployInput): string {
  const metadata = [
    initialMetadataEntry('name', RADIX_SEAL_NAME, true),
    initialMetadataEntry(
      'description',
      'Radix Seal is the standard for self-custody document signatures on the ' +
        'Radix Network. Anyone mints their own soulbound seal; it marks them ' +
        'as a signer and owns their personal signing collection.',
      true,
    ),
    initialMetadataEntry('icon_url', imageUrl, true, MetadataType.Url),
    initialMetadataEntry('info_url', origin, true, MetadataType.Url),
    initialMetadataArrayEntry(
      'tags',
      ['radix-seal', 'attestation', 'certificate-authority'],
      true,
    ),
    ...(dAppDefinition
      ? [initialMetadataArrayEntry('dapp_definitions', [dAppDefinition], false)]
      : []),
  ].join(',\n          ');

  return `CREATE_NON_FUNGIBLE_RESOURCE
    None
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
            ${lockedMetadataRoles()}
      )
    )
    None
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
