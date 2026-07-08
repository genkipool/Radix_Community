/**
 * Builds the transaction manifest that anchors a signed document on-ledger.
 *
 * Custody model: the signer self-issues the attestation. The manifest creates a
 * fresh, ownerless, immutable, non-transferable ("soulbound") NFT resource with
 * a single NFT holding the document hash, and deposits it into the signer's own
 * account. The user's wallet signs and pays the fee — no app account or minter
 * badge is involved.
 *
 * Privacy: ONLY the document hash + timestamp go on-ledger (public forever).
 * The file name, message and identity stay off-chain in the certificate.
 */
import {
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
  type NftItemData,
} from '@/features/console/lib/create-token-manifests';
import {
  initialMetadataEntry,
  MetadataType,
} from '@/features/console/lib/metadata-manifests';
import { ATTESTATION_RESOURCE_NAME } from '../constants/limits';

export interface AttestationMintInput {
  /** Account that signs, pays and receives the NFT. */
  accountAddress: string;
  /** Blake2b-256 hex of the document. */
  docHash: string;
  /** ISO timestamp recorded on-ledger. */
  timestamp: string;
}

/** NFT-data custom fields (schema) held by every attestation NFT. */
const CUSTOM_FIELDS = [
  { id: 'doc_hash', key: 'document_hash', locked: true },
  { id: 'signed_at', key: 'signed_at', locked: true },
];


export function buildAttestationMintManifest({
  accountAddress,
  docHash,
  timestamp,
}: AttestationMintInput): string {
  const metadata = [
    initialMetadataEntry('name', ATTESTATION_RESOURCE_NAME, true),
    initialMetadataEntry(
      'description',
      'Off-ledger document attestation anchored on the Radix Network.',
      true,
    ),
    initialMetadataEntry('document_hash', docHash, true),
  ].join(',\n          ');

  const nft: NftItemData = {
    name: 'Signed document',
    description: 'Radix document attestation',
    key_image_url: '',
    customData: { doc_hash: docHash, signed_at: timestamp },
  };

  return createNonFungibleTokenManifest({
    // Ownerless + immutable: nobody can ever mutate this attestation.
    ownerAccessRule: { type: 'none' },
    ownerRoleUpdatable: 'None',
    accountAddress,
    trackSupply: true,
    metadata,
    // Soulbound: withdrawer denied → the NFT can never leave the account.
    authRoles: { ...DEFAULT_AUTH_ROLES, withdrawer: 'denyAll' },
    nfts: [nft],
    nftBaseFieldsLocked: { name: true, description: true, key_image_url: true },
    nftCustomFields: CUSTOM_FIELDS,
  });
}

/* ─── On-ledger "by reference" multi-party signing ────────────────────────── */

export interface SigningRequestInput {
  /** Initiator account that holds the request NFT. */
  accountAddress: string;
  docHash: string;
  networkId: number;
  /** Signing policy ("instruction") every signer must follow. */
  disclosure: string;
  /** Accounts that must sign (stored in plain so status can be queried). */
  requiredSigners: string[];
  /** Optional clickable verification URL (bound to the doc hash) for explorers. */
  verifyUrl?: string;
  /** True when the initiator also signs in the same transaction. */
  initiatorSigned: boolean;
}

const REQUEST_FIELDS = [
  { id: 'doc_hash', key: 'document_hash', locked: true },
  { id: 'network', key: 'network', locked: true },
  { id: 'disclosure', key: 'disclosure', locked: true },
  { id: 'signers', key: 'required_signers', locked: true },
  { id: 'signer_count', key: 'signer_count', locked: true },
  // "true" when the initiator also signed in the same transaction.
  { id: 'initiator_signed', key: 'initiator_signed', locked: true },
];

/**
 * Mints the "signing request" NFT (held by the initiator). It carries ONLY
 * non-sensitive data: the document hash, network, the signing policy and the
 * required signer accounts (public addresses). Its global id is the shareable
 * key; the URL autofills + locks the signing options from this data.
 */
export function buildSigningRequestManifest({
  accountAddress,
  docHash,
  networkId,
  disclosure,
  requiredSigners,
  verifyUrl,
  initiatorSigned,
}: SigningRequestInput): string {
  const metadata = [
    initialMetadataEntry('name', 'Radix Signing Request', true),
    initialMetadataEntry(
      'description',
      'Multi-party document signing request. Only the document hash and the required signer accounts are stored.',
      true,
    ),
    initialMetadataEntry('document_hash', docHash, true),
    ...(verifyUrl
      ? [initialMetadataEntry('info_url', verifyUrl, true, MetadataType.Url)]
      : []),
  ].join(',\n          ');

  const nft: NftItemData = {
    name: 'Signing request',
    description: 'Radix document signing request',
    key_image_url: '',
    customData: {
      doc_hash: docHash,
      network: String(networkId),
      disclosure,
      signers: requiredSigners.join(','),
      signer_count: String(requiredSigners.length),
      initiator_signed: String(initiatorSigned),
    },
  };

  return createNonFungibleTokenManifest({
    ownerAccessRule: { type: 'none' },
    ownerRoleUpdatable: 'None',
    accountAddress,
    trackSupply: true,
    metadata,
    authRoles: { ...DEFAULT_AUTH_ROLES, withdrawer: 'denyAll' },
    nfts: [nft],
    nftBaseFieldsLocked: { name: true, description: true, key_image_url: true },
    nftCustomFields: REQUEST_FIELDS,
  });
}

export interface SignatureMintInput {
  /** Signer account (holds the signature NFT). */
  accountAddress: string;
  docHash: string;
  networkId: number;
  /** Global id of the request NFT this signature belongs to. */
  requestId: string;
}

const SIGNATURE_FIELDS = [
  { id: 'doc_hash', key: 'document_hash', locked: true },
  { id: 'network', key: 'network', locked: true },
  { id: 'request', key: 'request_id', locked: true },
];

/**
 * Mints a signer's own soulbound signature NFT. Non-sensitive: document hash,
 * network, and a pointer back to the request. Found later by enumerating the
 * signer's own account (no ledger-wide search needed).
 */
export function buildSignatureManifest({
  accountAddress,
  docHash,
  networkId,
  requestId,
}: SignatureMintInput): string {
  const metadata = [
    initialMetadataEntry('name', 'Radix Document Signature', true),
    initialMetadataEntry(
      'description',
      'On-ledger signature for a Radix document signing request.',
      true,
    ),
    initialMetadataEntry('document_hash', docHash, true),
  ].join(',\n          ');

  const nft: NftItemData = {
    name: 'Signature',
    description: 'Radix document signature',
    key_image_url: '',
    customData: {
      doc_hash: docHash,
      network: String(networkId),
      request: requestId,
    },
  };

  return createNonFungibleTokenManifest({
    ownerAccessRule: { type: 'none' },
    ownerRoleUpdatable: 'None',
    accountAddress,
    trackSupply: true,
    metadata,
    authRoles: { ...DEFAULT_AUTH_ROLES, withdrawer: 'denyAll' },
    nfts: [nft],
    nftBaseFieldsLocked: { name: true, description: true, key_image_url: true },
    nftCustomFields: SIGNATURE_FIELDS,
  });
}

export interface MultiAttestationMintInput {
  /** Signer accounts; each gets its own independent resource + NFT. */
  signers: string[];
  docHash: string;
  timestamp: string;
}

/**
 * ONE atomic transaction that mints N independent soulbound NFTs — a separate
 * resource per signer, each deposited into that signer's account. Atomic:
 * either all N NFTs are minted or the whole transaction fails.
 *
 * Each `CREATE … WITH_INITIAL_SUPPLY` puts its NFT on the worktop and the
 * following `try_deposit_batch_or_abort ENTIRE_WORKTOP` immediately routes it to
 * that signer, clearing the worktop before the next create — so no worktop
 * mixing and no need to reference the just-created address.
 */
export function buildMultiAttestationMintManifest({
  signers,
  docHash,
  timestamp,
}: MultiAttestationMintInput): string {
  return signers
    .map((accountAddress) =>
      buildAttestationMintManifest({ accountAddress, docHash, timestamp }),
    )
    .join('\n');
}
