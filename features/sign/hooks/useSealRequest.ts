'use client';

import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import { radixSealAddress } from '../constants/seal';
import { fetchLedgerNow } from '../lib/ledger-time';
import { buildSealMintManifest } from '../lib/radix-seal-manifest';
import {
  buildCipherInviteManifest,
  buildCipherReceiptManifest,
  buildCollectionMetadataManifest,
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureMintManifest,
  requestKey,
  type CollectionMetaField,
} from '../lib/sign-request';
import {
  findCollectionProfile,
  findSealAndCollection,
  findSignCollections,
  findUserSeal,
  findUserSeals,
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
  /**
   * The collection the user just picked, before the ledger re-read lands.
   * Without it the UI waits on a network round trip to move the highlight,
   * which reads as a laggy, unresponsive click.
   */
  const [pendingCollection, setPendingCollection] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['seal-setup', activeNetworkId, account],
    enabled: !!account && !!activeNetworkId,
    queryFn: async (): Promise<{
      seal: UserSeal | null;
      collection: UserSignCollection | null;
    }> => {
      // With two seals in the wallet, only the one that commands the
      // collection produces a proof the mint will accept.
      return findSealAndCollection(activeNetworkId!, account!);
    },
  });
  return {
    seal: query.data?.seal ?? null,
    // A collection only counts as ready when the user ALSO holds the current
    // seal that owns it. Without the seal (brand undeployed, or a fresh brand
    // redeploy where the discovered collection belongs to a previous seal) it
    // must not show as ready: it cannot be minted into with the new seal.
    collection: query.data?.seal ? (query.data?.collection ?? null) : null,
    /** What the UI should show as active RIGHT NOW, refetch pending or not. */
    activeAddress:
      pendingCollection ??
      (query.data?.seal ? (query.data?.collection?.resourceAddress ?? null) : null),
    loading: query.isFetching,
    ready: query.data !== undefined,
    refetch: query.refetch,
    /**
     * Work from a different signing collection of the same account. Pins the
     * choice (same store discovery reads) and re-reads the ledger, so the seal
     * that owns THAT collection is resolved with it.
     */
    selectCollection: (resourceAddress: string) => {
      if (!activeNetworkId || !account) return;
      setPendingCollection(resourceAddress);
      rememberSignCollection(activeNetworkId, account, resourceAddress);
      void query.refetch().finally(() => setPendingCollection(null));
    },
  };
}

/**
 * The same prerequisites for SEVERAL accounts at once, keyed by account.
 *
 * Holding a collection is per account, and the account that matters is the one
 * the invitation was sent to. A wallet with three accounts, two of them with
 * collections, says nothing about whether the invited one can sign — so the
 * question has to be asked of each candidate rather than of "the wallet".
 *
 * Every entry shares its cache with {@link useSealSetup}, so a collection
 * created through the onboarding box refreshes this list too.
 */
export function useSealSetups(accounts: string[], enabled = true) {
  const { activeNetworkId } = useRadixWallet();
  const results = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ['seal-setup', activeNetworkId, account],
      enabled: enabled && !!activeNetworkId,
      queryFn: () => findSealAndCollection(activeNetworkId!, account),
    })),
  });
  const setups = new Map<
    string,
    { seal: UserSeal | null; collection: UserSignCollection | null }
  >();
  accounts.forEach((account, i) => {
    const data = results[i]?.data;
    if (data) setups.set(account, data);
  });
  return {
    /** Accounts that can record a signature right now (seal + collection). */
    ready: accounts.filter(
      (a) => !!setups.get(a)?.seal && !!setups.get(a)?.collection,
    ),
    /** True once every account has an answer, so "none can sign" is not a guess. */
    resolved: accounts.length > 0 && accounts.every((a) => setups.has(a)),
    loading: results.some((r) => r.isFetching),
  };
}

/**
 * Every signing collection the account holds, loaded ON DEMAND — the normal
 * path answers from the pinned choice in one request, and scanning an account's
 * whole NFT holdings just to discover a duplicate that most accounts do not
 * have would tax every page load.
 */
export function useSignCollections(account: string | null, enabled: boolean) {
  const { activeNetworkId } = useRadixWallet();
  const query = useQuery({
    queryKey: ['sign-collections', activeNetworkId, account],
    enabled: enabled && !!account && !!activeNetworkId,
    queryFn: () => findSignCollections(activeNetworkId!, account!),
    staleTime: 30_000,
  });
  return {
    collections: query.data ?? [],
    loading: query.isFetching,
    /** Re-reads the ledger and resolves WITH the fresh list, so a caller can
     *  wait for a just-created collection to show up in it. */
    refetch: async (): Promise<UserSignCollection[]> =>
      (await query.refetch()).data ?? [],
  };
}

/** Every seal the account holds, so a second one can be chosen deliberately. */
export function useUserSeals(account: string | null) {
  const { activeNetworkId } = useRadixWallet();
  const query = useQuery({
    queryKey: ['user-seals', activeNetworkId, account],
    enabled: !!account && !!activeNetworkId,
    queryFn: () => findUserSeals(activeNetworkId!, account!),
    staleTime: 30_000,
  });
  return { seals: query.data ?? [], loading: query.isFetching, refetch: query.refetch };
}

/** The unlocked display metadata of a collection, for the edit form. */
export function useCollectionProfile(resourceAddress: string | null) {
  const { activeNetworkId } = useRadixWallet();
  const query = useQuery({
    queryKey: ['collection-profile', activeNetworkId, resourceAddress],
    enabled: !!resourceAddress && !!activeNetworkId,
    queryFn: () => findCollectionProfile(activeNetworkId!, resourceAddress!),
    staleTime: 30_000,
  });
  return {
    profile: query.data ?? null,
    loading: query.isFetching,
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
    /**
     * Mint a FRESH insignia for this collection even though the account already
     * has one. Deliberate and irreversible: a seal can never be transferred or
     * burned, so this leaves one more in the wallet forever.
     */
    forceNewSeal?: boolean;
    collectionName: string;
    symbol?: string;
    imageUrl: string;
    issuer?: IssuerMeta;
    extraMetadata?: CollectionMetaField[];
  }): Promise<string | null> => {
    setError(null);
    if (!activeNetworkId) return fail('wallet_not_connected');
    const sealResource = radixSealAddress(activeNetworkId);
    if (!sealResource) return fail('seal_not_deployed');

    // 1. Ensure the account holds its seal (mint + wait for it to be indexed).
    // Re-read the ledger before minting so a retry after a failed collection
    // step (seal already minted) does NOT mint a second seal.
    let seal = args.forceNewSeal
      ? null
      : (args.existingSeal ?? (await findUserSeal(activeNetworkId, args.account)));
    if (!seal) {
      // Snapshot BEFORE minting: with an account that already has seals, the
      // new one is identified by being the id that was not in this set.
      const before = new Set(
        args.forceNewSeal
          ? (await findUserSeals(activeNetworkId, args.account)).map((x) => x.globalId)
          : [],
      );
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
        const seals = await findUserSeals(activeNetworkId, args.account);
        seal = seals.find((x) => !before.has(x.globalId)) ?? null;
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
      extraMetadata: args.extraMetadata,
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
   * Rewrites the DISPLAY metadata of an existing collection: its name, symbol,
   * logo and the issuer identity printed on certificates. Owner-gated, so the
   * transaction carries a proof of the seal that owns it. Nothing a signature
   * proves can be touched this way — those keys were locked at creation.
   */
  const updateCollectionMetadata = async (args: {
    account: string;
    sealGlobalId: string;
    collection: string;
    name?: string;
    symbol?: string;
    iconUrl?: string;
    orgName?: string;
    orgUrl?: string;
  }): Promise<boolean> => {
    setError(null);
    if (!activeNetworkId) return !!fail('wallet_not_connected');
    const manifest = buildCollectionMetadataManifest(args);
    if (!manifest) return true; // nothing changed
    setPhase('creating');
    const tx = await sendTransaction(manifest);
    if (!tx) return !!fail('onchain_failed');
    setPhase('done');
    return true;
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
    extraMetadata?: CollectionMetaField[];
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
      extraMetadata: args.extraMetadata,
      firstSignature: args.firstSignature
        ? { ...args.firstSignature, signedAt: await fetchLedgerNow(activeNetworkId) }
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
   * initiator's own signature). Returns the shareable request key together with
   * the transaction that created it, so the certificate and the share box can
   * point at the very transaction a reader can look up. Null if the ledger did
   * not commit it.
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
  }): Promise<{ key: string; transactionIntentHash: string } | null> => {
    setError(null);
    if (!activeNetworkId) return fail('wallet_not_connected');
    setPhase('creating');
    const manifest = buildSignRequestManifest({
      issuedAt: await fetchLedgerNow(activeNetworkId),
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
    return {
      key: requestKey(args.collection, args.nextId),
      transactionIntentHash: tx.transactionIntentHash,
    };
  };

  /**
   * Mints the signer's signature into their OWN collection. Returns the
   * transaction that recorded it, or null when the ledger did not commit it.
   */
  const signRequest = async (args: {
    account: string;
    sealGlobalId: string;
    collection: string;
    nextId: number;
    docHash: string;
    request: string;
    imageUrl: string;
  }): Promise<string | null> => {
    setError(null);
    if (!activeNetworkId) return fail('wallet_not_connected');
    setPhase('signing');
    const manifest = buildSignatureMintManifest({
      issuedAt: await fetchLedgerNow(activeNetworkId),
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
    if (!tx) return fail('onchain_failed');
    setPhase('done');
    return tx.transactionIntentHash;
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
      issuedAt: await fetchLedgerNow(activeNetworkId),
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
      issuedAt: await fetchLedgerNow(activeNetworkId),
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
    updateCollectionMetadata,
    createRequest,
    signRequest,
    mintCipherInvites,
    mintCipherReceipt,
    phase,
    error,
    reset,
  };
}
