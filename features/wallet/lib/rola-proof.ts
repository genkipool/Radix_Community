'use client';

/**
 * Requests a ROLA account proof over a caller-supplied challenge. Shared by
 * every feature that binds cryptography to a wallet signature (cipher, chat).
 *
 * Throws Error(<code>) with codes: 'wallet_rejected', 'no_proof',
 * 'challenge_mismatch' — callers map them to their own i18n error keys.
 */
import { DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
import { getOrCreateToolkit } from './radix-toolkit';

type Rdt = NonNullable<ReturnType<typeof getOrCreateToolkit>>;

export interface RolaAccountProof {
  account: string;
  publicKey: string;
  signature: string;
  curve: string;
  challenge: string;
}

// The RDT challenge generator is global to the toolkit instance, so signature
// requests must never overlap or one flow could consume the other's challenge.
let signingQueue: Promise<unknown> = Promise.resolve();

function enqueueSigning<T>(run: () => Promise<T>): Promise<T> {
  const result = signingQueue.then(run, run);
  signingQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function requestAccountProof(
  rdt: Rdt,
  challenge: string,
): Promise<RolaAccountProof> {
  const run = async (): Promise<RolaAccountProof> => {
    // Bind the wallet signature to THIS request by feeding our challenge.
    rdt.walletApi.provideChallengeGenerator(async () => challenge);
    const response = await rdt.walletApi.sendOneTimeRequest(
      DataRequestBuilder.accounts().exactly(1).withProof(),
    );
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
      publicKey: proofEntry.proof.publicKey,
      signature: proofEntry.proof.signature,
      curve: proofEntry.proof.curve,
      challenge,
    };
  };

  return enqueueSigning(run);
}
