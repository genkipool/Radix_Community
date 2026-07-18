/**
 * Client helper for the ROLA + Ledger authorization endpoint: the ENCRYPTOR's
 * browser calls it before releasing a key, to verify the requester's ROLA
 * proof and their on-ledger cipher-invite for this exact container/session.
 * Shared by both sender-side flows (same-session share and unlock link).
 */
import type { UnlockProof } from '../types/cipher.types';

export async function verifyLedgerAuthorization(body: {
  networkId: number;
  headerHash: string;
  roomId: string;
  account: string;
  senderAccount: string;
  collection: string;
  proof: UnlockProof;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/cipher/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        networkId: body.networkId,
        headerHash: body.headerHash,
        roomId: body.roomId,
        account: body.account,
        senderAccount: body.senderAccount,
        collection: body.collection,
        proof: {
          publicKey: body.proof.publicKey,
          signature: body.proof.signature,
          curve: body.proof.curve,
        },
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { authorized?: boolean };
    return data.authorized === true;
  } catch {
    return false;
  }
}
