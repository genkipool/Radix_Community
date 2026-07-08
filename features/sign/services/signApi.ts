import type { AttestationEnvelope, VerifyResult } from '../types/sign.types';

/**
 * Sends the certificate (no file bytes) to the stateless verify endpoint.
 * The server checks the ROLA signature and, when present, the on-ledger NFT.
 */
export async function verifyEnvelope(
  envelope: AttestationEnvelope,
): Promise<VerifyResult> {
  const res = await fetch('/api/sign/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ envelope }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `verify_failed_${res.status}`);
  }
  return (await res.json()) as VerifyResult;
}

export interface OnChainStatus {
  found: boolean;
  requestId?: string;
  docHash?: string;
  networkId?: number;
  disclosure?: string;
  requiredSigners?: string[];
  signatures?: { account: string; signed: boolean }[];
  complete?: boolean;
}

/**
 * Reads the on-ledger state of a "by reference" signing request — by its key,
 * or resolved from a connected signer's wallet + the document hash.
 */
export async function fetchOnChainStatus(body: {
  networkId: number;
  docHash?: string;
  requestId?: string;
  account?: string;
}): Promise<OnChainStatus> {
  const res = await fetch('/api/sign/onchain-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `status_failed_${res.status}`);
  }
  return (await res.json()) as OnChainStatus;
}
