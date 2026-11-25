/**
 * Shared NF-data schema, metadata guards, and manifest primitives for Radix
 * Seal collection, signing, and cipher manifest builders.
 */
import type { NftItemData } from '@/features/console/lib/create-token-manifests';
import {
  ICON_URL_KEY,
  ORG_NAME_KEY,
  ORG_URL_KEY,
  RADIX_SEAL_STANDARD_KEY,
  SIGN_COLLECTION_MARKER_KEY,
} from '../../constants/seal';
import { splitNftGlobalId } from '../network';
import {
  escapeManifestString,
  initialMetadataEntry,
} from '../nf-manifest-helpers';

/**
 * Custom fields carried by every NFT in a signing collection. Order MUST
 * stay stable: mints supply values positionally. Unused fields are ''.
 */
export const SIGN_NFT_FIELDS = [
  { id: 'kind', key: 'kind', locked: true },
  { id: 'doc_hash', key: 'document_hash', locked: true },
  { id: 'network', key: 'network', locked: true },
  { id: 'signer', key: 'signer', locked: true },
  { id: 'signer_index', key: 'signer_index', locked: true },
  { id: 'signer_count', key: 'signer_count', locked: true },
  { id: 'first_id', key: 'first_id', locked: true },
  { id: 'request', key: 'request', locked: true },
  { id: 'issued_at', key: 'issued_at', locked: true },
] as const;

/** One NFT's address: `<collection resource>:#<id>#`. */
export const nftGlobalId = (collection: string, id: number) =>
  `${collection}:#${id}#`;

export const requestKey = (collection: string, firstId: number) =>
  nftGlobalId(collection, firstId);

/**
 * Where the initiator's OWN signature lands in a request batch: invitations
 * occupy `nextId … nextId + signers - 1` and the signature is minted right
 * after them.
 */
export const requestOwnSignatureId = (nextId: number, signerCount: number) =>
  nextId + signerCount;

/** One free-form metadata entry the creator adds to their own collection. */
export interface CollectionMetaField {
  key: string;
  value: string;
  /** Locked entries can never be changed again, by anyone, including the owner. */
  locked: boolean;
}

/**
 * Keys the builder writes itself and will not let a custom field touch.
 */
export const RESERVED_COLLECTION_METADATA_KEYS = new Set([
  'name',
  'symbol',
  'description',
  'icon_url',
  'tags',
  'issuer',
  ORG_NAME_KEY,
  ORG_URL_KEY,
  SIGN_COLLECTION_MARKER_KEY,
  RADIX_SEAL_STANDARD_KEY,
]);

/** How many custom entries one collection may declare at creation. */
export const MAX_COLLECTION_META_FIELDS = 10;

/** Whether a key may be used as a custom metadata entry. */
export const isReservedCollectionMetadataKey = (key: string): boolean =>
  RESERVED_COLLECTION_METADATA_KEYS.has(key.trim().toLowerCase());

/**
 * The custom entries as manifest syntax. Reserved keys and blanks are dropped
 * HERE, in the shared builder, rather than only in the form.
 */
export function customMetadataEntries(
  fields: CollectionMetaField[] | undefined,
): string[] {
  if (!fields?.length) return [];
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const field of fields) {
    const key = field.key.trim();
    const value = field.value.trim();
    if (!key || !value) continue;
    const normalized = key.toLowerCase();
    if (isReservedCollectionMetadataKey(key) || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push(initialMetadataEntry(key, value, field.locked));
    if (entries.length >= MAX_COLLECTION_META_FIELDS) break;
  }
  return entries;
}

export interface SignNftInput {
  kind:
    | 'invite'
    | 'signature'
    | 'cipher-invite'
    | 'cipher-receipt'
    | 'cipher-signature';
  name: string;
  description: string;
  imageUrl: string;
  docHash: string;
  networkId: number;
  signer: string;
  signerIndex?: number;
  signerCount?: number;
  firstId?: number;
  request?: string;
  issuedAt: string;
}

export function signNft(input: SignNftInput): NftItemData {
  return {
    name: input.name,
    description: input.description,
    key_image_url: input.imageUrl,
    customData: {
      kind: input.kind,
      doc_hash: input.docHash,
      network: String(input.networkId),
      signer: input.signer,
      signer_index:
        input.signerIndex !== undefined ? String(input.signerIndex) : '',
      signer_count:
        input.signerCount !== undefined ? String(input.signerCount) : '',
      first_id: input.firstId !== undefined ? String(input.firstId) : '',
      request: input.request ?? '',
      issued_at: input.issuedAt,
    },
  };
}

export const signatureNft = (args: {
  docHash: string;
  networkId: number;
  signer: string;
  request: string;
  imageUrl: string;
  signedAt: string;
}): NftItemData =>
  signNft({
    kind: 'signature',
    name: 'Document signature',
    description:
      'On-ledger signature for the document identified by document_hash. ' +
      'Soulbound; minted by the signer into their own seal-owned collection.',
    imageUrl: args.imageUrl,
    docHash: args.docHash,
    networkId: args.networkId,
    signer: args.signer,
    request: args.request,
    issuedAt: args.signedAt,
  });

/** Splits a seal global id into resource address + local id. */
export function splitGlobalId(globalId: string): {
  resource: string;
  localId: string;
} {
  if (!globalId.includes(':')) return { resource: globalId, localId: '' };
  return splitNftGlobalId(globalId);
}

/** Creates an account proof of the user's owner Seal NFT. */
export function sealProof(account: string, sealGlobalId: string): string {
  const { resource, localId } = splitGlobalId(sealGlobalId);
  return `CALL_METHOD
    Address("${account}")
    "create_proof_of_non_fungibles"
    Address("${resource}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${escapeManifestString(localId)}"))
;`;
}

/** One MINT_NON_FUNGIBLE with several ids into an existing collection. */
export function batchMint(
  collection: string,
  entries: Array<{ id: number; nft: NftItemData }>,
): string {
  const items = entries
    .map(({ id, nft }) => {
      const values = [
        nft.name,
        nft.description,
        nft.key_image_url,
        ...SIGN_NFT_FIELDS.map((f) => nft.customData[f.id] ?? ''),
      ]
        .map((v) => `"${escapeManifestString(v)}"`)
        .join(',\n                ');
      return `NonFungibleLocalId("#${id}#") => Tuple(
            Tuple(
                ${values}
            )
        )`;
    })
    .join(',\n        ');
  return `MINT_NON_FUNGIBLE
    Address("${collection}")
    Map<NonFungibleLocalId, Tuple>(
        ${items}
    )
;`;
}

/** Takes consecutive invite NFTs from the worktop and deposits each to its recipient. */
export function depositInviteDeliveries(
  collection: string,
  firstId: number,
  recipients: string[],
): string {
  return recipients
    .map(
      (recipient, i) => `TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${collection}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("#${firstId + i}#"))
    Bucket("invite_${i}")
;

CALL_METHOD
    Address("${recipient}")
    "try_deposit_or_abort"
    Bucket("invite_${i}")
    Enum<0u8>()
;`,
    )
    .join('\n\n');
}

export const depositWorktopToAccount = (account: string): string => `CALL_METHOD
    Address("${account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;`;

export { ICON_URL_KEY };
