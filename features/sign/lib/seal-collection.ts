/**
 * Radix Seal attestation collection — the on-ledger side of the self-custody
 * Certificate Authority.
 *
 * Each user owns ONE soulbound NFT resource (the collection); every signed
 * document mints a new integer id (#1, #2, #3…) into it — never a new
 * resource. The resource is owned by the user's own account (its virtual
 * signature badge), so only they can mint, and `withdrawer = denyAll` keeps
 * every attestation non-transferable. Resource metadata references the Radix
 * Seal brand and carries a discovery marker so the collection can be found
 * on-ledger without any server state.
 */
import {
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
  type NftItemData,
} from '@/features/console/lib/create-token-manifests';
import { mintNonFungibleManifest } from '@/features/console/lib/resource-actions';
import {
  initialMetadataEntry,
  initialMetadataArrayEntry,
  MetadataType,
} from '@/features/console/lib/metadata-manifests';
import { accountSignatureGlobalId } from '@/features/wallet/lib/virtual-signature';
import {
  COLLECTION_MARKER_KEY,
  COLLECTION_MARKER_VALUE,
  RADIX_SEAL_STANDARD_KEY,
} from '../constants/seal';

/**
 * NF-data custom fields carried by every attestation. Order MUST stay stable:
 * `mint` supplies values positionally to match the schema declared at create.
 */
export const ATTESTATION_FIELDS = [
  { id: 'doc_hash', key: 'document_hash', locked: true },
  { id: 'signed_at', key: 'signed_at', locked: true },
  { id: 'doc_name', key: 'document_name', locked: true },
  { id: 'signers', key: 'signers', locked: true },
  { id: 'network', key: 'network', locked: true },
  { id: 'seal', key: RADIX_SEAL_STANDARD_KEY, locked: true },
] as const;

export interface AttestationData {
  docHash: string;
  timestamp: string;
  docName: string;
  /** Comma-joined signer account addresses. */
  signers: string;
  network: string;
  /** Radix Seal brand address (empty until the brand is deployed). */
  sealAddress: string;
}

function attestationNft(data: AttestationData, imageUrl: string): NftItemData {
  return {
    name: 'Radix Seal attestation',
    description: `Attestation of "${data.docName}" signed on the Radix Network.`,
    key_image_url: imageUrl,
    customData: {
      doc_hash: data.docHash,
      signed_at: data.timestamp,
      doc_name: data.docName,
      signers: data.signers,
      network: data.network,
      seal: data.sealAddress,
    },
  };
}

function customValuesInSchemaOrder(data: AttestationData): string[] {
  const nft = attestationNft(data, '');
  return ATTESTATION_FIELDS.map((f) => nft.customData[f.id] ?? '');
}

export interface CollectionCreateInput {
  account: string;
  /** Curve of the signing account (selects the signature badge resource). */
  curve: string;
  networkId: number;
  collectionName: string;
  /** Image URL for the resource icon and each NFT (may be the seal default). */
  imageUrl: string;
  sealAddress: string;
  attestation: AttestationData;
}

/**
 * First anchor for a user: creates their collection with the first attestation
 * as `#1#`, owned by their account so only they can mint more.
 */
export async function buildCollectionCreateManifest(
  input: CollectionCreateInput,
): Promise<string> {
  const ownerGlobalId = await accountSignatureGlobalId(
    input.account,
    input.curve,
    input.networkId,
  );

  const metadata = [
    initialMetadataEntry('name', input.collectionName, true),
    initialMetadataEntry(
      'description',
      'Self-custody document attestations sealed with Radix Seal.',
      true,
    ),
    initialMetadataEntry('icon_url', input.imageUrl, false, MetadataType.Url),
    initialMetadataEntry(COLLECTION_MARKER_KEY, COLLECTION_MARKER_VALUE, true),
    ...(input.sealAddress
      ? [
          // Address metadata needs an Address() literal, not a string.
          `"${RADIX_SEAL_STANDARD_KEY}" => Tuple(
      Some(Enum<${MetadataType.Address}>(Address("${input.sealAddress}"))),
      true
  )`,
        ]
      : []),
    initialMetadataArrayEntry('tags', ['radix-seal', 'attestation'], true),
  ].join(',\n          ');

  return createNonFungibleTokenManifest({
    // Owner = this account's signature → only the user can mint into it.
    ownerAccessRule: { type: 'nonFungible', address: ownerGlobalId },
    ownerRoleUpdatable: 'Fixed',
    accountAddress: input.account,
    trackSupply: true,
    metadata,
    // Mintable by the owner (the user), soulbound (withdrawer denied).
    authRoles: {
      ...DEFAULT_AUTH_ROLES,
      minter: 'owner',
      minter_updater: 'owner',
      withdrawer: 'denyAll',
    },
    nfts: [attestationNft(input.attestation, input.imageUrl)],
    nftBaseFieldsLocked: { name: true, description: true, key_image_url: true },
    nftCustomFields: [...ATTESTATION_FIELDS],
    firstNftId: 1,
  });
}

export interface CollectionMintInput {
  account: string;
  resourceAddress: string;
  /** Integer id for the new attestation (previous total supply + 1). */
  nextId: number;
  imageUrl: string;
  attestation: AttestationData;
}

/**
 * Subsequent anchors: mint the next id into the user's existing collection.
 * The owner is the account's virtual signature badge, which the wallet places
 * in the auth zone automatically when it signs — no explicit proof needed.
 */
export function buildCollectionMintManifest(input: CollectionMintInput): string {
  const nft = attestationNft(input.attestation, input.imageUrl);
  const mint = mintNonFungibleManifest(input.resourceAddress, {
    id: `#${input.nextId}#`,
    name: nft.name,
    description: nft.description,
    keyImageUrl: input.imageUrl,
    customValues: customValuesInSchemaOrder(input.attestation),
  });
  // The freshly minted NFT lands on the worktop → deposit it back to the user.
  return `${mint}
CALL_METHOD
    Address("${input.account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
}
