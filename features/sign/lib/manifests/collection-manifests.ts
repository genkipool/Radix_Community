/**
 * Collection creation, display metadata updates, and provisioning previews
 * for Radix Seal signing collections.
 */
import {
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
} from '@/features/console/lib/create-token-manifests';
import {
  setStringMetadata,
  setUrlMetadata,
} from '@/features/console/lib/metadata-manifests';
import {
  DEFAULT_COLLECTION_NAME,
  DEFAULT_COLLECTION_SYMBOL,
  ICON_URL_KEY,
  ORG_NAME_KEY,
  ORG_URL_KEY,
  RADIX_SEAL_STANDARD_KEY,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../../constants/seal';
import type { IssuerMeta } from '../../types/sign.types';
import {
  initialMetadataArrayEntry,
  initialMetadataEntry,
  issuerMetadataEntries,
  MetadataType,
  sanitizeSymbol,
} from '../nf-manifest-helpers';
import { buildSealMintManifest } from '../radix-seal-manifest';
import {
  customMetadataEntries,
  sealProof,
  SIGN_NFT_FIELDS,
  signatureNft,
  type CollectionMetaField,
} from './shared';

export interface SignCollectionCreateInput {
  account: string;
  /** The user's seal NFT global id (`<seal resource>:{ruid}`) — the owner. */
  sealGlobalId: string;
  /** Seal brand resource (referenced in metadata). */
  sealAddress: string;
  networkId: number;
  collectionName: string;
  imageUrl: string;
  /** Optional resource symbol (uppercase, capped at 5 chars by the builder). */
  symbol?: string;
  issuer?: IssuerMeta;
  /** Free-form metadata the creator wants on their own collection. */
  extraMetadata?: CollectionMetaField[];
  /** Co-signers can bundle their first signature into the creation (`#1#`). */
  firstSignature?: { docHash: string; request: string; signedAt: string };
}

/**
 * Creates the user's signing collection: owner = their seal NFT, so only
 * they can mint (and recall invitations); burning and NFT data mutation are
 * permanently denied.
 */
export function buildSignCollectionCreateManifest(
  input: SignCollectionCreateInput,
): string {
  const iconUrl = input.issuer?.orgLogoUrl || input.imageUrl;
  const collectionName = input.collectionName?.trim() || DEFAULT_COLLECTION_NAME;
  const symbol = sanitizeSymbol(input.symbol) || DEFAULT_COLLECTION_SYMBOL;
  const metadata = [
    initialMetadataEntry('name', collectionName, false),
    initialMetadataEntry('symbol', symbol, false),
    initialMetadataEntry(
      'description',
      'Personal Radix Seal signing collection: signing invitations issued by ' +
        'this account and its own soulbound document signatures.',
      true,
    ),
    ...(iconUrl
      ? [initialMetadataEntry('icon_url', iconUrl, false, MetadataType.Url)]
      : []),
    initialMetadataEntry(
      SIGN_COLLECTION_MARKER_KEY,
      SIGN_COLLECTION_MARKER_VALUE,
      true,
    ),
    ...(input.sealAddress
      ? [
          `"${RADIX_SEAL_STANDARD_KEY}" => Tuple(
      Some(Enum<${MetadataType.Address}>(Address("${input.sealAddress}"))),
      true
  )`,
        ]
      : []),
    ...issuerMetadataEntries(input.issuer, input.account),
    initialMetadataArrayEntry('tags', ['radix-seal', 'signing'], true),
    ...customMetadataEntries(input.extraMetadata),
  ].join(',\n          ');

  return createNonFungibleTokenManifest({
    ownerAccessRule: { type: 'nonFungible', address: input.sealGlobalId },
    ownerRoleUpdatable: 'Fixed',
    accountAddress: input.account,
    trackSupply: true,
    metadata,
    authRoles: {
      ...DEFAULT_AUTH_ROLES,
      minter: 'owner',
      minter_updater: 'denyAll',
      recaller: 'owner',
      recaller_updater: 'denyAll',
      burner: 'denyAll',
      burner_updater: 'denyAll',
      withdrawer: 'denyAll',
      nft_data_setter: 'denyAll',
      nft_data_setter_updater: 'denyAll',
      metadata_setter: 'owner',
      metadata_setter_updater: 'denyAll',
      metadata_locker: 'owner',
      metadata_locker_updater: 'denyAll',
    },
    nfts: input.firstSignature
      ? [
          signatureNft({
            docHash: input.firstSignature.docHash,
            networkId: input.networkId,
            signer: input.account,
            request: input.firstSignature.request,
            imageUrl: input.imageUrl,
            signedAt: input.firstSignature.signedAt,
          }),
        ]
      : [],
    nftBaseFieldsLocked: { name: true, description: true, key_image_url: true },
    nftCustomFields: [...SIGN_NFT_FIELDS],
    firstNftId: 1,
  });
}

export interface CollectionMetadataInput {
  /** Account holding the seal that owns the collection (it signs and proves). */
  account: string;
  sealGlobalId: string;
  collection: string;
  /** Only keys present are written; undefined leaves the ledger value alone. */
  name?: string;
  symbol?: string;
  /** The collection's `icon_url`: the issuer's logo. */
  iconUrl?: string;
  orgName?: string;
  orgUrl?: string;
}

/** Updates the unlocked DISPLAY metadata of a signing collection. */
export function buildCollectionMetadataManifest(
  input: CollectionMetadataInput,
): string {
  const updates = [
    input.name !== undefined
      ? setStringMetadata(input.collection, 'name', input.name)
      : '',
    input.symbol !== undefined
      ? setStringMetadata(input.collection, 'symbol', sanitizeSymbol(input.symbol))
      : '',
    input.iconUrl !== undefined
      ? setUrlMetadata(input.collection, ICON_URL_KEY, input.iconUrl)
      : '',
    input.orgName !== undefined
      ? setStringMetadata(input.collection, ORG_NAME_KEY, input.orgName)
      : '',
    input.orgUrl !== undefined
      ? setUrlMetadata(input.collection, ORG_URL_KEY, input.orgUrl)
      : '',
  ].join('');
  if (!updates.trim()) return '';
  return `${sealProof(input.account, input.sealGlobalId)}
${updates}`;
}

export interface ProvisionPreviewInput {
  account: string;
  networkId: number;
  /** Official Radix Seal brand resource address. */
  sealResource: string;
  /** Existing Seal global id to reuse, or null when a new Seal must be minted first. */
  sealGlobalId: string | null;
  collectionName: string;
  symbol?: string;
  imageUrl: string;
  issuer?: IssuerMeta;
  extraMetadata?: CollectionMetaField[];
}

/**
 * Single source of truth for dry-running the next provisioning transaction
 * (shared by `SealOnboarding` and `CollectionCreateTab`).
 */
export function buildProvisionPreviewManifest(
  input: ProvisionPreviewInput,
): string | null {
  if (!input.sealGlobalId) {
    if (!input.sealResource) return null;
    return buildSealMintManifest({
      account: input.account,
      sealResource: input.sealResource,
      imageUrl: input.imageUrl,
    });
  }
  return buildSignCollectionCreateManifest({
    account: input.account,
    sealGlobalId: input.sealGlobalId,
    sealAddress: input.sealResource,
    networkId: input.networkId,
    collectionName: input.collectionName,
    symbol: input.symbol,
    imageUrl: input.imageUrl,
    issuer: input.issuer,
    extraMetadata: input.extraMetadata,
  });
}
