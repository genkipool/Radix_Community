/**
 * Single on-ledger multi-party signing flow ("Radix Seal signing").
 *
 * Every user owns ONE reusable signing collection whose owner/minter is
 * their own soulbound Seal NFT — so ONLY they can ever mint into it, and a
 * verifier can prove a collection belongs to account S by reading, from the
 * ledger alone: collection.owner → seal global id → seal located in S.
 *
 * A request = the initiator mints one INVITATION NFT per required signer
 * into their own collection (consecutive integer ids) and deposits each
 * into its signer's account. Invitations are informational + recallable by
 * the initiator; they are NOT signatures.
 *
 * A signature = the signer mints a SIGNATURE NFT into their OWN collection
 * (soulbound, locked data). Since nobody else can mint there, signatures
 * cannot be forged on someone else's behalf — closing the insider-forgery
 * hole the old badge mode had.
 *
 * The shareable request key is the first invitation's global id
 * (`<initiator collection>:#<firstId>#`).
 */
import {
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
  type NftItemData,
} from '@/features/console/lib/create-token-manifests';
import {
  escapeManifestString,
  initialMetadataArrayEntry,
  initialMetadataEntry,
  issuerMetadataEntries,
  MetadataType,
} from './nf-manifest-helpers';
import {
  RADIX_SEAL_STANDARD_KEY,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../constants/seal';
import type { IssuerMeta } from '../types/sign.types';

/* ─── Shared NF-data schema (invitations + signatures) ────────────────────── */

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

export const requestKey = (collection: string, firstId: number) =>
  `${collection}:#${firstId}#`;

interface SignNftInput {
  kind: 'invite' | 'signature' | 'cipher-invite' | 'cipher-receipt';
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

function signNft(input: SignNftInput): NftItemData {
  return {
    name: input.name,
    description: input.description,
    key_image_url: input.imageUrl,
    customData: {
      kind: input.kind,
      doc_hash: input.docHash,
      network: String(input.networkId),
      signer: input.signer,
      signer_index: input.signerIndex !== undefined ? String(input.signerIndex) : '',
      signer_count: input.signerCount !== undefined ? String(input.signerCount) : '',
      first_id: input.firstId !== undefined ? String(input.firstId) : '',
      request: input.request ?? '',
      issued_at: input.issuedAt,
    },
  };
}

function customValuesInSchemaOrder(nft: NftItemData): string[] {
  return SIGN_NFT_FIELDS.map((f) => nft.customData[f.id] ?? '');
}

const inviteNft = (args: {
  docHash: string;
  networkId: number;
  signer: string;
  index: number;
  count: number;
  firstId: number;
  collection: string;
  imageUrl: string;
  issuedAt: string;
}): NftItemData =>
  signNft({
    kind: 'invite',
    name: `Signing invitation ${args.index + 1}/${args.count}`,
    description:
      'Invitation to sign ONE specific document (see document_hash). ' +
      'Informational and recallable by the issuer — the signature itself is ' +
      'minted by the signer into their own collection.',
    imageUrl: args.imageUrl,
    docHash: args.docHash,
    networkId: args.networkId,
    signer: args.signer,
    signerIndex: args.index,
    signerCount: args.count,
    firstId: args.firstId,
    request: requestKey(args.collection, args.firstId),
    issuedAt: args.issuedAt,
  });

const signatureNft = (args: {
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

/* ─── Collection creation (once per user) ─────────────────────────────────── */

export interface SignCollectionCreateInput {
  account: string;
  /** The user's seal NFT global id (`<seal resource>:{ruid}`) — the owner. */
  sealGlobalId: string;
  /** Seal brand resource (referenced in metadata). */
  sealAddress: string;
  networkId: number;
  collectionName: string;
  imageUrl: string;
  issuer?: IssuerMeta;
  /**
   * Co-signers can bundle their first signature into the creation (initial
   * supply `#1#`) so first-time signing takes one less transaction.
   */
  firstSignature?: { docHash: string; request: string; signedAt: string };
}

/**
 * Creates the user's signing collection: owner = their seal NFT, so only
 * they can mint (and recall/burn invitations); everything inside is
 * soulbound and its data locked forever.
 */
export function buildSignCollectionCreateManifest(
  input: SignCollectionCreateInput,
): string {
  // Everything is locked EXCEPT display metadata — name, icon_url (image)
  // and org_url — which the owner (the seal holder) may update later.
  const iconUrl = input.issuer?.orgLogoUrl || input.imageUrl;
  const metadata = [
    initialMetadataEntry('name', input.collectionName, false),
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
          // Address metadata needs an Address() literal, not a string.
          `"${RADIX_SEAL_STANDARD_KEY}" => Tuple(
      Some(Enum<${MetadataType.Address}>(Address("${input.sealAddress}"))),
      true
  )`,
        ]
      : []),
    ...issuerMetadataEntries(input.issuer, input.account),
    initialMetadataArrayEntry('tags', ['radix-seal', 'signing'], true),
  ].join(',\n          ');

  return createNonFungibleTokenManifest({
    // Owner = the user's own soulbound seal NFT → only they can ever mint.
    ownerAccessRule: { type: 'nonFungible', address: input.sealGlobalId },
    ownerRoleUpdatable: 'Fixed',
    accountAddress: input.account,
    trackSupply: true,
    metadata,
    authRoles: {
      ...DEFAULT_AUTH_ROLES,
      minter: 'owner',
      minter_updater: 'denyAll',
      // Recall lets the issuer pull back a mis-sent invitation (its locked
      // data persists, so the required-signer set never shrinks). Burning is
      // DENIED for everyone: a burnable collection would let a signer destroy
      // their own signature NFT (repudiation) or an issuer burn an unsigned
      // invitation to shrink the quorum. Evidence must be permanent.
      recaller: 'owner',
      recaller_updater: 'denyAll',
      burner: 'denyAll',
      burner_updater: 'denyAll',
      withdrawer: 'denyAll',
      // The seal holder may re-point each NFT's key_image_url (cosmetic only,
      // just like the collection's icon_url). The evidence fields
      // (document_hash, signer, kind, request) stay locked in the schema, so
      // this can never rewrite what a signature proves. Rule locked forever.
      nft_data_setter: 'owner',
      nft_data_setter_updater: 'denyAll',
      // Unlocked display metadata (name, icon_url, org_url) is editable by
      // the seal holder ONLY — and that rule itself can never be changed.
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
    // key_image_url stays MUTABLE (owner-editable via nft_data_setter); name and
    // description remain locked. Evidence lives in the locked custom fields.
    nftBaseFieldsLocked: { name: true, description: true, key_image_url: false },
    nftCustomFields: [...SIGN_NFT_FIELDS],
    firstNftId: 1,
  });
}

/* ─── Request creation (mint + distribute invitations) ────────────────────── */

/** Splits a seal global id into resource address + local id. */
export function splitGlobalId(globalId: string): { resource: string; localId: string } {
  const idx = globalId.indexOf(':');
  return idx === -1
    ? { resource: globalId, localId: '' }
    : { resource: globalId.slice(0, idx), localId: globalId.slice(idx + 1) };
}

const sealProof = (account: string, sealGlobalId: string) => {
  const { resource, localId } = splitGlobalId(sealGlobalId);
  return `CALL_METHOD
    Address("${account}")
    "create_proof_of_non_fungibles"
    Address("${resource}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${escapeManifestString(localId)}"))
;`;
};

/** One MINT_NON_FUNGIBLE with several ids into an existing collection. */
function batchMint(
  collection: string,
  entries: Array<{ id: number; nft: NftItemData }>,
): string {
  const items = entries
    .map(({ id, nft }) => {
      const values = [
        nft.name,
        nft.description,
        nft.key_image_url,
        ...customValuesInSchemaOrder(nft),
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

export interface SignRequestInput {
  /** Initiator account (holds the seal, owns the collection). */
  account: string;
  sealGlobalId: string;
  /** The initiator's existing signing collection. */
  collection: string;
  /** Next free integer id (`totalSupply + 1`). */
  nextId: number;
  docHash: string;
  networkId: number;
  /** Accounts that must sign — one invitation each. */
  requiredSigners: string[];
  /**
   * When true the initiator's own signature is minted in the same
   * transaction (they need no invitation for that — add their account to
   * `requiredSigners` only if their signature must count for completion).
   */
  alsoSign: boolean;
  /** Image for the minted NFTs (issuer logo or ''). */
  imageUrl: string;
}

/**
 * Mints the invitation batch (ids `nextId … nextId+N-1`), deposits each
 * invitation into its signer's account, and — optionally — mints the
 * initiator's own signature (`nextId+N`) into their own account. Aborts
 * atomically if any signer's account rejects third-party deposits.
 */
export function buildSignRequestManifest(input: SignRequestInput): string {
  const issuedAt = new Date().toISOString();
  const firstId = input.nextId;
  const count = input.requiredSigners.length;
  if (count === 0) throw new Error('no required signers');

  const invites = input.requiredSigners.map((signer, i) => ({
    id: firstId + i,
    nft: inviteNft({
      docHash: input.docHash,
      networkId: input.networkId,
      signer,
      index: i,
      count,
      firstId,
      collection: input.collection,
      imageUrl: input.imageUrl,
      issuedAt,
    }),
  }));

  const ownSignature = input.alsoSign
    ? {
        id: firstId + count,
        nft: signatureNft({
          docHash: input.docHash,
          networkId: input.networkId,
          signer: input.account,
          request: requestKey(input.collection, firstId),
          imageUrl: input.imageUrl,
          signedAt: issuedAt,
        }),
      }
    : null;

  const deliveries = input.requiredSigners
    .map(
      (signer, i) => `TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${input.collection}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("#${firstId + i}#"))
    Bucket("invite_${i}")
;

CALL_METHOD
    Address("${signer}")
    "try_deposit_or_abort"
    Bucket("invite_${i}")
    Enum<0u8>()
;`,
    )
    .join('\n\n');

  return `${sealProof(input.account, input.sealGlobalId)}

${batchMint(input.collection, ownSignature ? [...invites, ownSignature] : invites)}

${deliveries}

CALL_METHOD
    Address("${input.account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
}

/* ─── Cipher invitations & receipts (ROLA + Ledger encryption) ────────────── */

const cipherInviteNft = (args: {
  headerHash: string;
  networkId: number;
  receiver: string;
  index: number;
  count: number;
  firstId: number;
  collection: string;
  imageUrl: string;
  issuedAt: string;
}): NftItemData =>
  signNft({
    kind: 'cipher-invite',
    name: `Encryption invitation ${args.index + 1}/${args.count}`,
    description:
      'Authorization to request the decryption key of ONE specific encrypted ' +
      'container (document_hash = its header hash). Only accounts holding ' +
      'this NFT can send the ROLA unlock challenge to the encryptor.',
    imageUrl: args.imageUrl,
    docHash: args.headerHash,
    networkId: args.networkId,
    signer: args.receiver,
    signerIndex: args.index,
    signerCount: args.count,
    firstId: args.firstId,
    request: requestKey(args.collection, args.firstId),
    issuedAt: args.issuedAt,
  });

export interface CipherInviteInput {
  /** Encryptor account (holds the seal, owns the collection). */
  account: string;
  sealGlobalId: string;
  /** The encryptor's signing collection (same one the sign flow uses). */
  collection: string;
  /** Next free integer id (`totalSupply + 1`). */
  nextId: number;
  /** blake2b-256 of the container's canonical header JSON. */
  headerHash: string;
  networkId: number;
  /** Accounts authorized to request the key — one invitation each. */
  receivers: string[];
  imageUrl: string;
}

/**
 * Mints one `cipher-invite` NFT per authorized receiver into the encryptor's
 * signing collection and deposits each into its receiver's account. Aborts
 * atomically if any receiver blocks third-party deposits.
 */
export function buildCipherInviteManifest(input: CipherInviteInput): string {
  const issuedAt = new Date().toISOString();
  const firstId = input.nextId;
  const count = input.receivers.length;
  if (count === 0) throw new Error('no receivers');

  const invites = input.receivers.map((receiver, i) => ({
    id: firstId + i,
    nft: cipherInviteNft({
      headerHash: input.headerHash,
      networkId: input.networkId,
      receiver,
      index: i,
      count,
      firstId,
      collection: input.collection,
      imageUrl: input.imageUrl,
      issuedAt,
    }),
  }));

  const deliveries = input.receivers
    .map(
      (receiver, i) => `TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${input.collection}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("#${firstId + i}#"))
    Bucket("invite_${i}")
;

CALL_METHOD
    Address("${receiver}")
    "try_deposit_or_abort"
    Bucket("invite_${i}")
    Enum<0u8>()
;`,
    )
    .join('\n\n');

  return `${sealProof(input.account, input.sealGlobalId)}

${batchMint(input.collection, invites)}

${deliveries}

CALL_METHOD
    Address("${input.account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
}

export interface CipherReceiptInput {
  /** Receiver account (holds their seal + their collection). */
  account: string;
  sealGlobalId: string;
  /** The receiver's OWN signing collection. */
  collection: string;
  nextId: number;
  /** Header hash of the container that was decrypted. */
  headerHash: string;
  networkId: number;
  /** The encryptor's collection (where the invite batch lives). */
  inviteCollection: string;
  imageUrl: string;
}

/**
 * Mints the receiver's soulbound decryption receipt into their own
 * collection: public, permanent evidence that this account obtained the key
 * for this container. Same chain of custody as a signature NFT.
 */
export function buildCipherReceiptManifest(input: CipherReceiptInput): string {
  return `${sealProof(input.account, input.sealGlobalId)}

${batchMint(input.collection, [
  {
    id: input.nextId,
    nft: signNft({
      kind: 'cipher-receipt',
      name: 'Decryption receipt',
      description:
        'On-ledger acknowledgment that this account obtained the decryption ' +
        'key of the container identified by document_hash. Soulbound; minted ' +
        'by the receiver into their own seal-owned collection.',
      imageUrl: input.imageUrl,
      docHash: input.headerHash,
      networkId: input.networkId,
      signer: input.account,
      request: input.inviteCollection,
      issuedAt: new Date().toISOString(),
    }),
  },
])}

CALL_METHOD
    Address("${input.account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
}

/* ─── Signing (each invited signer, into their OWN collection) ────────────── */

export interface SignatureMintInput {
  /** Signer account (holds their seal + their collection). */
  account: string;
  sealGlobalId: string;
  /** The signer's OWN signing collection. */
  collection: string;
  /** Next free integer id in their collection. */
  nextId: number;
  docHash: string;
  networkId: number;
  /** The request key (`<initiator collection>:#<firstId>#`). */
  request: string;
  imageUrl: string;
}

/** Mints the signer's soulbound signature into their own collection. */
export function buildSignatureMintManifest(input: SignatureMintInput): string {
  return `${sealProof(input.account, input.sealGlobalId)}

${batchMint(input.collection, [
  {
    id: input.nextId,
    nft: signatureNft({
      docHash: input.docHash,
      networkId: input.networkId,
      signer: input.account,
      request: input.request,
      imageUrl: input.imageUrl,
      signedAt: new Date().toISOString(),
    }),
  },
])}

CALL_METHOD
    Address("${input.account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;
`;
}
