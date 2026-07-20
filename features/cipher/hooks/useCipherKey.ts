'use client';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { requestAccountProof } from '@/features/wallet/lib/rola-proof';
import {
  buildChallengePayload,
  deriveCipherChallenge,
  deriveFileKeyBits,
} from '../lib/keys';

export interface CipherKeyGrant {
  /** HKDF output — the AES-256-GCM key material for this file. */
  keyBits: Uint8Array;
  /** Account that signed; the file is bound to it. */
  account: string;
  publicKey: string;
}

/**
 * Requests a deterministic ROLA signature over the file's challenge and
 * derives the AES key from it. Throws Error(<CipherErrorCode>) on failure —
 * notably 'secp256k1': only Ed25519 (curve25519) accounts sign
 * deterministically per RFC 8032, so other curves would produce an
 * unrecoverable key on re-derivation.
 */
export function useCipherKey() {
  const { activeNetworkId } = useRadixWallet();

  async function requestKey(fileSalt: string): Promise<CipherKeyGrant> {
    if (activeNetworkId == null) throw new Error('wallet_rejected');
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) throw new Error('wallet_rejected');

    const challenge = deriveCipherChallenge(
      buildChallengePayload(fileSalt, activeNetworkId),
    );
    const proof = await requestAccountProof(rdt, challenge);
    if (proof.curve !== 'curve25519') throw new Error('secp256k1');

    return {
      keyBits: await deriveFileKeyBits(proof.signature, fileSalt),
      account: proof.account,
      publicKey: proof.publicKey,
    };
  }

  return { requestKey };
}
