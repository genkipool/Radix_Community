'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import { radixSealAddress } from '../constants/seal';
import { buildSealMintManifest } from '../lib/radix-seal-manifest';
import {
  buildCipherInviteManifest,
  buildCipherReceiptManifest,
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureMintManifest,
  requestKey,
} from '../lib/sign-request';
import {
  findSignCollection,
  findUserSeal,
  rememberSignCollection,
  type UserSeal,
  type UserSignCollection,
} from '../services/sealDiscovery';
import type { IssuerMeta } from '../types/sign.types';

/**
 * On-ledger prerequisites of the signing flow for one account: their seal
 * NFT (insignia) and their signing collection. Read from the ledger, cached
 * by react-query; refetch after minting either.
 */
export function useSealSetup(account: string | null) {
  const { activeNetworkId } = useRadixWallet();
  const query = useQuery({
    queryKey: ['seal-setup', activeNetworkId, account],
    enabled: !!account && !!activeNetworkId,
    queryFn: async (): Promise<{
      seal: UserSeal | null;
      collection: UserSignCollection | null;
    }> => {
      const [seal, collection] = await Promise.all([
        findUserSeal(activeNetworkId!, account!),
        findSignCollection(activeNetworkId!, account!),
      ]);
      return { seal, collection };
    },
  });
  return {
    seal: query.data?.seal ?? null,
    // A collection only counts as ready when the user ALSO holds the current
    // seal that owns it. Without the seal (brand undeployed, or a fresh brand
    // redeploy where the discovered collection belongs to a previous seal) it
    // must not show as ready: it cannot be minted into with the new seal.
    collection: query.data?.seal ? (query.data?.collection ?? null) : null,
    loading: query.isFetching,
    ready: query.data !== undefined,
    refetch: query.refetch,
  };
}

export type SealRequestPhase =
  | 'idle'
  | 'minting-seal'
  | 'creating-collection'
  | 'creating'
  | 'signing'
  | 'done'
  | 'error';

/**
 * Wallet actions of the single signing flow. Every action is one
 * transaction paid by its actor; there is no coordinator.
 */
export function useSealRequest() {
  const { activeNetworkId } = useRadixWallet();
  const { sendTransaction } = useConsoleTransaction();
  const [phase, setPhase] = useState<SealRequestPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase('idle');
    setError(null);
  };

  const fail = (code: string) => {
    setPhase('error');
    setError(code);
    return null;
  };

  /** Self-mints the account's soulbound seal NFT (their insignia). */
  const mintSeal = async (args: {
    account: string;
    imageUrl: string;
  }): Promise<boolean> => {
    setError(null);
    if (!activeNetworkId) return !!fail('wallet_not_connected');
    const sealResource = radixSealAddress(activeNetworkId);
    if (!sealResource) return !!fail('seal_not_deployed');
    setPhase('minting-seal');
    const tx = await sendTransaction(
      buildSealMintManifest({
        account: args.account,
        sealResource,
        imageUrl: args.imageUrl,
      }),
    );
    if (!tx) return !!fail('onchain_failed');
    setPhase('done');
    return true;
  };

  /**
   * One click, two transactions: self-mint the seal (if the account does not
   * have one yet) and then create the signing collection owned by it. A single
   * transaction is impossible because the collection's owner rule must embed the
   * seal's global id, and the seal's RUID is only known after it is minted (see
   * onchain-custody). So the seal tx is sent first; once it commits, its global
   * id is read from the ledger and the collection tx is sent automatically.
   */
  const provisionCollection = async (args: {
    account: string;
    existingSeal: UserSeal | null;
    collectionName: string;
    symbol?: string;
    imageUrl: string;
    issuer?: IssuerMeta;
  }): Promise<string | null> => {
    setError(null);
    if (!activeNetworkId) return fail('wallet_not_connected');
    const sealResource = radixSealAddress(activeNetworkId);
    if (!sealResource) return fail('seal_not_deployed');

    // 1. Ensure the account holds its seal (mint + wait for it to be indexed).
    // Re-read the ledger before minting so a retry after a failed collection
    // step (seal already minted) does NOT mint a second seal.
    let seal = args.existingSeal ?? (await findUserSeal(activeNetworkId, args.account));
    if (!seal) {
      setPhase('minting-seal');
      const sealTx = await sendTransaction(
        buildSealMintManifest({
          account: args.account,
          sealResource,
          imageUrl: args.imageUrl,
        }),
      );
      if (!sealTx) return fail('onchain_failed');
      for (let attempt = 0; attempt < 8 && !seal; attempt++) {
        seal = await findUserSeal(activeNetworkId, args.account);
        if (!seal) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (!seal) return fail('seal_read_failed');
    }

    // 2. Create the collection owned by that seal.
    setPhase('creating-collection');
    const manifest = buildSignCollectionCreateManifest({
      account: args.account,
      sealGlobalId: seal.globalId,
      sealAddress: sealResource,
      networkId: activeNetworkId,
      collectionName: args.collectionName,
      symbol: args.symbol,
      imageUrl: args.imageUrl,
      issuer: args.issuer,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) return fail('onchain_failed');
    const resource = tx.createdEntities.find((a) => a.startsWith('resource_'));
    if (!resource) return fail('onchain_no_resource');
    rememberSignCollection(activeNetworkId, args.account, resource);
    setPhase('done');
    return resource;
  };

  /**
   * Creates the account's signing collection (owned by their seal). A
   * co-signer can bundle their first signature into it.
   */
  const createCollection = async (args: {
    account: string;
    sealGlobalId: string;
    collectionName: string;
    symbol?: string;
    imageUrl: string;
    issuer?: IssuerMeta;
    firstSignature?: { docHash: string; request: string };
  }): Promise<string | null> => {
    setError(null);
    if (!activeNetworkId) return fail('wallet_not_connected');
    setPhase('creating-collection');
    const manifest = buildSignCollectionCreateManifest({
      account: args.account,
      sealGlobalId: args.sealGlobalId,
      sealAddress: radixSealAddress(activeNetworkId),
      networkId: activeNetworkId,
      collectionName: args.collectionName,
      symbol: args.symbol,
      imageUrl: args.imageUrl,
      issuer: args.issuer,
      firstSignature: args.firstSignature
        ? { ...args.firstSignature, signedAt: new Date().toISOString() }
        : undefined,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) return fail('onchain_failed');
    const resource = tx.createdEntities.find((a) => a.startsWith('resource_'));
    if (!resource) return fail('onchain_no_resource');
    rememberSignCollection(activeNetworkId, args.account, resource);
    setPhase('done');
    return resource;
  };

  /**
   * Mints + distributes the invitation batch (and optionally the
   * initiator's own signature). Returns the shareable request key.
   */
  const createRequest = async (args: {
    account: string;
    sealGlobalId: string;
    collection: string;
    nextId: number;
    docHash: string;
    requiredSigners: string[];
    alsoSign: boolean;
    imageUrl: string;
  }): Promise<string | null> => {
    setError(null);
    if (!activeNetworkId) return fail('wallet_not_connected');
    setPhase('creating');
    const manifest = buildSignRequestManifest({
      account: args.account,
      sealGlobalId: args.sealGlobalId,
      collection: args.collection,
      nextId: args.nextId,
      docHash: args.docHash,
      networkId: activeNetworkId,
      requiredSigners: args.requiredSigners,
      alsoSign: args.alsoSign,
      imageUrl: args.imageUrl,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) return fail('onchain_failed');
    setPhase('done');
    return requestKey(args.collection, args.nextId);
  };

  /** Mints the signer's signature into their OWN collection. */
  const signRequest = async (args: {
    account: string;
    sealGlobalId: string;
    collection: string;
    nextId: number;
    docHash: string;
    request: string;
    imageUrl: string;
  }): Promise<boolean> => {
    setError(null);
    if (!activeNetworkId) return !!fail('wallet_not_connected');
    setPhase('signing');
    const manifest = buildSignatureMintManifest({
      account: args.account,
      sealGlobalId: args.sealGlobalId,
      collection: args.collection,
      nextId: args.nextId,
      docHash: args.docHash,
      networkId: activeNetworkId,
      request: args.request,
      imageUrl: args.imageUrl,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) return !!fail('onchain_failed');
    setPhase('done');
    return true;
  };

  /**
   * Mints one `cipher-invite` per authorized receiver into the encryptor's
   * collection (ROLA + Ledger encryption). Returns true on success.
   */
  const mintCipherInvites = async (args: {
    account: string;
    sealGlobalId: string;
    collection: string;
    nextId: number;
    headerHash: string;
    receivers: string[];
    imageUrl: string;
  }): Promise<string | null> => {
    setError(null);
    if (!activeNetworkId) return fail('wallet_not_connected');
    setPhase('creating');
    const manifest = buildCipherInviteManifest({
      account: args.account,
      sealGlobalId: args.sealGlobalId,
      collection: args.collection,
      nextId: args.nextId,
      headerHash: args.headerHash,
      networkId: activeNetworkId,
      receivers: args.receivers,
      imageUrl: args.imageUrl,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) return fail('onchain_failed');
    setPhase('done');
    return tx.transactionIntentHash;
  };

  /** Mints the receiver's decryption receipt into their OWN collection. */
  const mintCipherReceipt = async (args: {
    account: string;
    sealGlobalId: string;
    collection: string;
    nextId: number;
    headerHash: string;
    inviteCollection: string;
    imageUrl: string;
  }): Promise<boolean> => {
    setError(null);
    if (!activeNetworkId) return !!fail('wallet_not_connected');
    setPhase('signing');
    const manifest = buildCipherReceiptManifest({
      account: args.account,
      sealGlobalId: args.sealGlobalId,
      collection: args.collection,
      nextId: args.nextId,
      headerHash: args.headerHash,
      networkId: activeNetworkId,
      inviteCollection: args.inviteCollection,
      imageUrl: args.imageUrl,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) return !!fail('onchain_failed');
    setPhase('done');
    return true;
  };

  return {
    mintSeal,
    provisionCollection,
    createCollection,
    createRequest,
    signRequest,
    mintCipherInvites,
    mintCipherReceipt,
    phase,
    error,
    reset,
  };
}
