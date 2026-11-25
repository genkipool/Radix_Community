/**
 * Signing request (invitation batch) and signature mint manifest builders
 * for the on-ledger Radix Seal flow.
 */
import type { NftItemData } from '@/features/console/lib/create-token-manifests';
import type { IssuerMeta } from '../../types/sign.types';
import { buildSignCollectionCreateManifest } from './collection-manifests';
import {
  batchMint,
  depositInviteDeliveries,
  depositWorktopToAccount,
  requestKey,
  sealProof,
  signatureNft,
  signNft,
  type CollectionMetaField,
} from './shared';

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
  /** When true the initiator's own signature is minted in the same tx. */
  alsoSign: boolean;
  /** Image for the minted NFTs (issuer logo or ''). */
  imageUrl: string;
  /** Ledger time to record as `issued_at`. */
  issuedAt: string;
}

/**
 * Single source of truth for resolving the required-signer list of an on-ledger
 * signing request across Web UI and MCP.
 */
export function resolveRequestSigners(
  account: string | null | undefined,
  signers: string[],
  alsoSign: boolean,
): string[] {
  const clean = signers.map((s) => s.trim()).filter(Boolean);
  const combined =
    alsoSign && account?.trim() ? [account.trim(), ...clean] : clean;
  return [...new Set(combined)];
}

/**
 * Mints the invitation batch (ids `nextId … nextId+N-1`), deposits each into
 * its signer's account, and optionally mints the initiator's own signature.
 */
export function buildSignRequestManifest(input: SignRequestInput): string {
  const { issuedAt } = input;
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

  const deliveries = depositInviteDeliveries(
    input.collection,
    firstId,
    input.requiredSigners,
  );

  return `${sealProof(input.account, input.sealGlobalId)}

${batchMint(input.collection, ownSignature ? [...invites, ownSignature] : invites)}

${deliveries}

${depositWorktopToAccount(input.account)}
`;
}

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
  /** Ledger time to record as `issued_at`. */
  issuedAt: string;
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
      signedAt: input.issuedAt,
    }),
  },
])}

${depositWorktopToAccount(input.account)}
`;
}

export interface SignatureOrFirstCollectionInput {
  account: string;
  sealGlobalId: string;
  /** Official Radix Seal brand address (used when creating the collection inline). */
  sealAddress: string;
  /** Existing signing collection address, or null/undefined to create it inline with `#1#`. */
  collection?: string | null;
  /** Next free integer id when minting into an existing collection. */
  nextId?: number;
  docHash: string;
  networkId: number;
  /** Request key being answered (`''` for a solo signature). */
  request: string;
  imageUrl: string;
  issuedAt: string;
  collectionName?: string;
  symbol?: string;
  issuer?: IssuerMeta;
  extraMetadata?: CollectionMetaField[];
}

/**
 * Single source of truth for on-ledger document signing across Web UI and MCP:
 * mints into an existing collection or atomically creates the collection with `#1#`.
 */
export function buildSignatureOrFirstCollectionManifest(
  input: SignatureOrFirstCollectionInput,
): string {
  if (input.collection) {
    return buildSignatureMintManifest({
      account: input.account,
      sealGlobalId: input.sealGlobalId,
      collection: input.collection,
      nextId: input.nextId ?? 1,
      docHash: input.docHash,
      networkId: input.networkId,
      request: input.request,
      imageUrl: input.imageUrl,
      issuedAt: input.issuedAt,
    });
  }
  return buildSignCollectionCreateManifest({
    account: input.account,
    sealGlobalId: input.sealGlobalId,
    sealAddress: input.sealAddress,
    networkId: input.networkId,
    collectionName: input.collectionName ?? '',
    symbol: input.symbol,
    imageUrl: input.imageUrl,
    issuer: input.issuer,
    extraMetadata: input.extraMetadata,
    firstSignature: {
      docHash: input.docHash,
      request: input.request,
      signedAt: input.issuedAt,
    },
  });
}
