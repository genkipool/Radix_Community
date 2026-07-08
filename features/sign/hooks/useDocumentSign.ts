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
  buildAttestationMintManifest,
  buildMultiAttestationMintManifest,
} from '../lib/manifest';
import type {
  AttestationEnvelope,
  AttestationPayload,
  DisclosurePolicy,
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
 */
async function requestWalletSignature(
  rdt: Rdt,
  challenge: string,
  disclosure: DisclosurePolicy,
  includeEmail: boolean,
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
    disclosedName: extractDisclosedName(walletData.personaData, disclosure),
    disclosedEmail: includeEmail
      ? extractDisclosedEmail(walletData.personaData)
      : null,
  };
}

/**
 * Orchestrates document signing (single or multi-party) and, for single-sign,
 * optional on-ledger anchoring.
 */
export function useDocumentSign() {
  const { activeNetworkId } = useRadixWallet();
  const { sendTransaction } = useConsoleTransaction();
  const [phase, setPhase] = useState<SignPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase('idle');
    setError(null);
  };

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
      );

      const entry: SignatureEntry = {
        signerAccount: sig.account,
        disclosedName: sig.disclosedName,
        disclosedEmail: sig.disclosedEmail,
        proof: sig.proof,
        signedAt: new Date().toISOString(),
      };
      let envelope = buildEnvelope(payload, entry);

      // Single-sign inline anchoring (multi-sign anchors once complete).
      if (!isMulti && input.onChain) {
        if (input.signerAccount && sig.account !== input.signerAccount) {
          setPhase('error');
          setError('account_mismatch');
          return null;
        }
        setPhase('anchoring');
        const manifest = buildAttestationMintManifest({
          accountAddress: sig.account,
          docHash: input.docHash,
          timestamp: payload.timestamp,
        });
        const tx = await sendTransaction(manifest);
        if (!tx) {
          setPhase('error');
          setError('onchain_failed');
          return null;
        }
        const resourceAddress = tx.createdEntities.find((a) =>
          a.startsWith('resource_'),
        );
        if (!resourceAddress) {
          setPhase('error');
          setError('onchain_no_resource');
          return null;
        }
        envelope = {
          ...envelope,
          onChain: {
            networkId: activeNetworkId,
            transactionIntentHash: tx.transactionIntentHash,
            resourceAddress,
            nfts: [
              { signerAccount: sig.account, nftGlobalId: `${resourceAddress}:#0#` },
            ],
          },
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

      const entry: SignatureEntry = {
        signerAccount: sig.account,
        disclosedName: sig.disclosedName,
        disclosedEmail: sig.disclosedEmail,
        proof: sig.proof,
        signedAt: new Date().toISOString(),
      };

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
   * Anchor a COMPLETE certificate on-ledger: one atomic transaction mints an
   * independent soulbound NFT for every signer and deposits it into that
   * signer's account. Whoever runs this pays the fee.
   */
  const anchor = async (
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
    if (activeNetworkId !== envelope.payload.networkId) {
      setPhase('error');
      setError('network_mismatch');
      return null;
    }

    const signers = [...new Set(envelope.signatures.map((s) => s.signerAccount))];
    const manifest = buildMultiAttestationMintManifest({
      signers,
      docHash: envelope.payload.docHash,
      timestamp: new Date().toISOString(),
    });

    try {
      setPhase('anchoring');
      const tx = await sendTransaction(manifest);
      if (!tx) {
        setPhase('error');
        setError('onchain_failed');
        return null;
      }
      // One independent resource per signer; each holds a single NFT (#0#).
      const resources = tx.createdEntities.filter((a) =>
        a.startsWith('resource_'),
      );
      if (resources.length === 0) {
        setPhase('error');
        setError('onchain_no_resource');
        return null;
      }
      setPhase('done');
      return {
        envelope: {
          ...envelope,
          onChain: {
            networkId: envelope.payload.networkId,
            transactionIntentHash: tx.transactionIntentHash,
            resourceAddress: resources[0],
            nfts: signers.map((signerAccount, i) => ({
              signerAccount,
              nftGlobalId: `${resources[i] ?? resources[0]}:#0#`,
            })),
          },
        },
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
