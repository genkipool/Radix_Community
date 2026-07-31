'use client';

import { useState } from 'react';
import { DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import { deriveChallenge, randomNonceHex } from '../lib/hash';
import {
  appendSignature,
  buildEnvelope,
  extractDisclosedName,
  extractDisclosedEmail,
} from '../lib/certificate';
import {
  buildSignCollectionCreateManifest,
  buildSignatureMintManifest,
} from '../lib/sign-request';
import {
  findSealAndCollection,
  rememberSignCollection,
} from '../services/sealDiscovery';
import { requestSignatureTimestamp } from '../services/signApi';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import type {
  AttestationEnvelope,
  AttestationPayload,
  DisclosurePolicy,
  OnChainAnchor,
  SignatureEntry,
  SignatureProof,
  SignResult,
} from '../types/sign.types';

type Rdt = NonNullable<ReturnType<typeof getOrCreateToolkit>>;

export interface SignInput {
  fileBytes: Uint8Array;
  docHash: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  message: string;
  disclosure: DisclosurePolicy;
  includeEmail: boolean;
  /** Required co-signer accounts besides the initiator (empty = single sign). */
  coSigners: string[];
  /** Initiator's account: required for multi-sign and for single-sign anchoring. */
  signerAccount?: string;
  /** Single-sign only: anchor the hash on-ledger as a soulbound NFT. */
  onChain: boolean;
  /** Radix Seal collection display name (first anchor only). */
  collectionName?: string;
  /** Image URL for the collection + attestation NFT (defaults to the seal). */
  imageUrl?: string;
}

export type SignPhase = 'idle' | 'signing' | 'anchoring' | 'done' | 'error';

interface WalletSignature {
  account: string;
  proof: SignatureProof;
  disclosedName: string | null;
  disclosedEmail: string | null;
}

/**
 * Requests a single account proof over `challenge`, plus persona name/email per
 * the document policy. Throws Error(<code>) on failure (mapped to a message).
 *
 * `personaLabel` comes from the CONNECTED session, not from this request. The
 * signing request is a one-time one, which RDT sends as an `unauthorizedRequest`
 * — and RDT only fills `walletData.persona` for authorized ones, so the label
 * is never in the response here however the policy is set. Reading it from the
 * session the user is already logged in with is what lets the certificate name
 * a person under "signature only", where no persona data is requested at all.
 */
async function requestWalletSignature(
  rdt: Rdt,
  challenge: string,
  disclosure: DisclosurePolicy,
  includeEmail: boolean,
  personaLabel?: string | null,
): Promise<WalletSignature> {
  // Bind the wallet signature to THIS document by feeding our challenge.
  rdt.walletApi.provideChallengeGenerator(async () => challenge);

  const wantsName = disclosure !== 'none';
  let response;
  if (wantsName || includeEmail) {
    let personaData = DataRequestBuilder.personaData();
    if (wantsName) personaData = personaData.fullName();
    if (includeEmail) personaData = personaData.emailAddresses();
    response = await rdt.walletApi.sendOneTimeRequest(
      DataRequestBuilder.accounts().exactly(1).withProof(),
      personaData,
    );
  } else {
    response = await rdt.walletApi.sendOneTimeRequest(
      DataRequestBuilder.accounts().exactly(1).withProof(),
    );
  }
  if (response.isErr()) throw new Error('wallet_rejected');

  const walletData = response.value;
  const account = walletData.accounts?.[0];
  const proofEntry =
    (walletData.proofs ?? []).find(
      (p: { address?: string }) => p.address === account?.address,
    ) ?? walletData.proofs?.[0];

  if (!account || !proofEntry?.proof) throw new Error('no_proof');
  if (proofEntry.challenge && proofEntry.challenge !== challenge) {
    throw new Error('challenge_mismatch');
  }

  return {
    account: account.address,
    proof: {
      publicKey: proofEntry.proof.publicKey,
      signature: proofEntry.proof.signature,
      curve: proofEntry.proof.curve,
    },
    disclosedName: extractDisclosedName(
      walletData.personaData,
      disclosure,
      walletData.persona?.label ?? personaLabel,
    ),
    disclosedEmail: includeEmail
      ? extractDisclosedEmail(walletData.personaData)
      : null,
  };
}

/**
 * The certificate entry for one wallet signature, carrying a trusted timestamp
 * whenever the authority answers.
 *
 * An off-ledger signature's date used to be `new Date()` — the signer's own
 * clock, which a certificate holder could rewrite to any day they liked. With a
 * token, the AUTHORITY's time becomes the date, so `signedAt` is something a
 * verifier can check instead of something it has to take on faith. When the
 * authority is unreachable the local clock is used as before: it is better to
 * sign with a weakly-evidenced date than not to sign at all, and verification
 * reports the difference rather than hiding it.
 */
async function timestampedEntry(
  sig: WalletSignature,
  challenge: string,
): Promise<SignatureEntry> {
  const stamp = await requestSignatureTimestamp(
    sig.account,
    challenge,
    sig.proof.signature,
  );
  return {
    signerAccount: sig.account,
    disclosedName: sig.disclosedName,
    disclosedEmail: sig.disclosedEmail,
    proof: sig.proof,
    signedAt: stamp?.genTime ?? new Date().toISOString(),
    ...(stamp ? { timeStampToken: stamp.token } : {}),
  };
}

/**
 * Orchestrates document signing (single or multi-party) and, for single-sign,
 * optional on-ledger anchoring.
 */
export function useDocumentSign() {
  const { activeNetworkId, persona } = useRadixWallet();
  const { sendTransaction } = useConsoleTransaction();
  const [phase, setPhase] = useState<SignPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase('idle');
    setError(null);
  };

  /**
   * Mints one attestation into the account's Radix Seal collection: discovers
   * the collection (creating it on the first anchor), sends the transaction and
   * returns the resolved on-chain anchor. Throws Error(<code>) on failure.
   */
  async function anchorToCollection(
    account: string,
    networkId: number,
    input: {
      docHash: string;
      timestamp: string;
      collectionName: string;
      imageUrl: string;
    },
  ): Promise<OnChainAnchor> {
    const sealAddress = radixSealAddress(networkId);
    const imageUrl = input.imageUrl || sealImageUrl(window.location.origin);

    // Unified model: the signature lives as a `kind='signature'` NFT in the
    // account's Seal-OWNED collection (the same collection the invitation flow
    // uses; NFTs are told apart by `kind`). Owner = the official Radix Seal, so
    // verification binds it to the account via an unforgeable chain of custody.
    // Requires the account's soulbound Seal (its insignia).
    const { seal, collection } = await findSealAndCollection(networkId, account);
    if (!seal) throw new Error('seal_required');

    const localIdNum = collection ? collection.totalSupply + 1 : 1;
    // A stand-alone anchor has no on-ledger invitation, so `request` is empty;
    // verification (`findSignerSignature`) keys on kind + doc hash + signer only.
    const manifest = collection
      ? buildSignatureMintManifest({
          account,
          sealGlobalId: seal.globalId,
          collection: collection.resourceAddress,
          nextId: localIdNum,
          docHash: input.docHash,
          networkId,
          request: '',
          imageUrl,
        })
      : buildSignCollectionCreateManifest({
          account,
          sealGlobalId: seal.globalId,
          sealAddress,
          networkId,
          collectionName: input.collectionName || '',
          imageUrl,
          firstSignature: { docHash: input.docHash, request: '', signedAt: input.timestamp },
        });

    const tx = await sendTransaction(manifest);
    if (!tx) throw new Error('onchain_failed');

    const resourceAddress =
      collection?.resourceAddress ??
      tx.createdEntities.find((a) => a.startsWith('resource_'));
    if (!resourceAddress) throw new Error('onchain_no_resource');
    if (!collection) rememberSignCollection(networkId, account, resourceAddress);

    const localId = `#${localIdNum}#`;
    return {
      networkId,
      transactionIntentHash: tx.transactionIntentHash,
      resourceAddress,
      sealAddress,
      nfts: [
        {
          signerAccount: account,
          nftGlobalId: `${resourceAddress}:${localId}`,
          localId,
        },
      ],
    };
  }

  /** Sign a NEW document (first signature). */
  const sign = async (input: SignInput): Promise<SignResult | null> => {
    setError(null);
    if (!activeNetworkId) {
      setPhase('error');
      setError('wallet_not_connected');
      return null;
    }
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) {
      setPhase('error');
      setError('toolkit_not_initialized');
      return null;
    }

    const isMulti = input.coSigners.length > 0;
    // Required signers are fixed before the first signature (they are hashed
    // into the challenge). Sorted so every party derives the same challenge.
    const signers = isMulti
      ? [...new Set([input.signerAccount ?? '', ...input.coSigners])]
          .filter(Boolean)
          .sort()
      : [];

    const payload: AttestationPayload = {
      v: 1,
      docHash: input.docHash,
      hashAlg: 'blake2b-256',
      fileName: input.fileName,
      fileSize: input.fileSize,
      message: input.message,
      disclosure: input.disclosure,
      email: input.includeEmail,
      signers,
      timestamp: new Date().toISOString(),
      networkId: activeNetworkId,
      nonce: randomNonceHex(),
    };
    const challenge = deriveChallenge(payload);

    try {
      setPhase('signing');
      const sig = await requestWalletSignature(
        rdt,
        challenge,
        input.disclosure,
        input.includeEmail,
        persona?.label,
      );

      const entry = await timestampedEntry(sig, challenge);
      let envelope = buildEnvelope(payload, entry);

      // Single-sign inline anchoring (multi-sign anchors once complete).
      if (!isMulti && input.onChain) {
        if (input.signerAccount && sig.account !== input.signerAccount) {
          setPhase('error');
          setError('account_mismatch');
          return null;
        }
        setPhase('anchoring');
        envelope = {
          ...envelope,
          onChain: await anchorToCollection(sig.account, activeNetworkId, {
            docHash: input.docHash,
            timestamp: payload.timestamp,
            collectionName: input.collectionName ?? '',
            imageUrl: input.imageUrl ?? '',
          }),
        };
      }

      setPhase('done');
      return {
        envelope,
        fileBytes: input.fileBytes,
        fileName: input.fileName,
        fileType: input.fileType,
      };
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'unknown');
      return null;
    }
  };

  /** Append the current wallet's signature to an existing (partial) certificate. */
  const coSign = async (
    envelope: AttestationEnvelope,
    fileBytes: Uint8Array,
    fileName: string,
    fileType: string,
  ): Promise<SignResult | null> => {
    setError(null);
    if (!activeNetworkId) {
      setPhase('error');
      setError('wallet_not_connected');
      return null;
    }
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) {
      setPhase('error');
      setError('toolkit_not_initialized');
      return null;
    }

    const { payload } = envelope;
    const challenge = deriveChallenge(payload);

    try {
      setPhase('signing');
      const sig = await requestWalletSignature(
        rdt,
        challenge,
        payload.disclosure,
        payload.email,
        persona?.label,
      );

      if (payload.signers.length > 0 && !payload.signers.includes(sig.account)) {
        setPhase('error');
        setError('not_required_signer');
        return null;
      }
      if (envelope.signatures.some((s) => s.signerAccount === sig.account)) {
        setPhase('error');
        setError('already_signed');
        return null;
      }

      const entry = await timestampedEntry(sig, challenge);

      setPhase('done');
      return {
        envelope: appendSignature(envelope, entry),
        fileBytes,
        fileName,
        fileType,
      };
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'unknown');
      return null;
    }
  };

  /**
   * Anchor a COMPLETE certificate on-ledger. Mints one attestation (listing all
   * signers) into the anchoring account's own Radix Seal collection. The wallet
   * proves which account anchors; it must be one of the signers.
   */
  const anchor = async (
    envelope: AttestationEnvelope,
    fileBytes: Uint8Array,
    fileName: string,
    fileType: string,
    sealOpts?: { collectionName?: string; imageUrl?: string },
  ): Promise<SignResult | null> => {
    setError(null);
    if (!activeNetworkId) {
      setPhase('error');
      setError('wallet_not_connected');
      return null;
    }
    if (activeNetworkId !== envelope.payload.networkId) {
      setPhase('error');
      setError('network_mismatch');
      return null;
    }
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) {
      setPhase('error');
      setError('toolkit_not_initialized');
      return null;
    }

    const signers = [...new Set(envelope.signatures.map((s) => s.signerAccount))];

    try {
      // Identify the anchoring account (and its curve) via a fresh proof.
      setPhase('signing');
      const who = await requestWalletSignature(rdt, randomNonceHex(), 'none', false);
      if (!signers.includes(who.account)) {
        setPhase('error');
        setError('not_required_signer');
        return null;
      }

      setPhase('anchoring');
      const onChain = await anchorToCollection(who.account, activeNetworkId, {
        docHash: envelope.payload.docHash,
        timestamp: new Date().toISOString(),
        collectionName: sealOpts?.collectionName ?? '',
        imageUrl: sealOpts?.imageUrl ?? '',
      });
      setPhase('done');
      return {
        envelope: { ...envelope, onChain },
        fileBytes,
        fileName,
        fileType,
      };
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'unknown');
      return null;
    }
  };

  return { sign, coSign, anchor, phase, error, reset };
}
