/**
 * Cipher invitations, encryption signatures, and decryption receipts for the
 * ROLA + Ledger document encryption flow.
 */
import type { NftItemData } from '@/features/console/lib/create-token-manifests';
import {
  batchMint,
  depositInviteDeliveries,
  depositWorktopToAccount,
  requestKey,
  sealProof,
  signNft,
} from './shared';

const cipherSignatureNft = (args: {
  headerHash: string;
  networkId: number;
  signer: string;
  imageUrl: string;
  issuedAt: string;
}): NftItemData =>
  signNft({
    kind: 'cipher-signature',
    name: 'Encryption signature',
    description:
      'On-ledger record that this account encrypted the container identified ' +
      'by document_hash (its header hash). Soulbound; minted by the encryptor ' +
      'into their own seal-owned collection.',
    imageUrl: args.imageUrl,
    docHash: args.headerHash,
    networkId: args.networkId,
    signer: args.signer,
    issuedAt: args.issuedAt,
  });

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
  account: string;
  sealGlobalId: string;
  collection: string;
  nextId: number;
  headerHash: string;
  networkId: number;
  receivers: string[];
  imageUrl: string;
  issuedAt: string;
}

/**
 * Mints one `cipher-invite` NFT per authorized receiver plus the encryptor's
 * own `cipher-signature` NFT, delivering each invite to its receiver.
 */
export function buildCipherInviteManifest(input: CipherInviteInput): string {
  const { issuedAt } = input;
  const firstId = input.nextId;
  const count = input.receivers.length;

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

  const signatureItem = {
    id: firstId + count,
    nft: cipherSignatureNft({
      headerHash: input.headerHash,
      networkId: input.networkId,
      signer: input.account,
      imageUrl: input.imageUrl,
      issuedAt,
    }),
  };

  const deliveries = depositInviteDeliveries(
    input.collection,
    firstId,
    input.receivers,
  );

  return `${sealProof(input.account, input.sealGlobalId)}

${batchMint(input.collection, [...invites, signatureItem])}

${deliveries}

${depositWorktopToAccount(input.account)}
`;
}

export interface CipherReceiptInput {
  account: string;
  sealGlobalId: string;
  collection: string;
  nextId: number;
  headerHash: string;
  networkId: number;
  inviteCollection: string;
  imageUrl: string;
  issuedAt: string;
}

/** Mints the receiver's soulbound decryption receipt into their own collection. */
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
      issuedAt: input.issuedAt,
    }),
  },
])}

${depositWorktopToAccount(input.account)}
`;
}
