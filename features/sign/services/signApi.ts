import { sha256Hex, timestampImprintInput } from '../lib/timestamp';
import type {
  AttestationEnvelope,
  OnChainRequestRef,
  VerifyResult,
} from '../types/sign.types';

/**
 * Sends the certificate (no file bytes) to the stateless verify endpoint.
 * The server checks the ROLA signature and, when present, the on-ledger NFT.
 *
 * `requestOverride` is a request key the VERIFIER supplied (typed in, or read
 * from the shared link). It outranks the one inside the certificate: a
 * certificate names its own request, so on its own it can only ever be measured
 * against a yardstick its author chose.
 */
export async function verifyEnvelope(
  envelope: AttestationEnvelope,
  requestOverride?: OnChainRequestRef | null,
): Promise<VerifyResult> {
  const res = await fetch('/api/sign/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      envelope,
      ...(requestOverride ? { requestOverride } : {}),
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `verify_failed_${res.status}`);
  }
  return (await res.json()) as VerifyResult;
}

/** What a Time Stamping Authority gave back for one signature. */
export interface SignatureTimestamp {
  /** RFC 3161 token, base64 DER. */
  token: string;
  /** The authority's asserted time, ISO-8601. */
  genTime: string;
}

/**
 * Asks a Time Stamping Authority to attest that a just-produced signature
 * exists, and returns its token. Best effort by design: the authority is a
 * third party outside our control, and nobody should be unable to sign because
 * it is down, so every failure resolves to null and the signature goes on
 * without one.
 *
 * Only the imprint leaves the browser — a hash over the account, the document
 * challenge and the signature bytes — so the authority learns nothing.
 */
export async function requestSignatureTimestamp(
  signerAccount: string,
  challenge: string,
  signatureHex: string,
): Promise<SignatureTimestamp | null> {
  try {
    const imprint = await sha256Hex(
      timestampImprintInput(signerAccount, challenge, signatureHex),
    );
    const res = await fetch('/api/sign/timestamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imprint }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<SignatureTimestamp>;
    return body.token && body.genTime
      ? { token: body.token, genTime: body.genTime }
      : null;
  } catch {
    return null;
  }
}

export interface OnChainSignatureStatus {
  account: string;
  signed: boolean;
  /**
   * Consensus time of the transaction that minted this signature. Null when the
   * account has not signed, or when the Gateway cannot resolve it — a date that
   * cannot be established is reported as absent rather than filled in locally.
   */
  signedAt?: string | null;
}

/** Issuer identity read from the locked on-ledger collection metadata. */
export interface OnChainIssuer {
  account?: string;
  collectionName?: string;
  orgName?: string;
  orgWebsite?: string;
  orgLogoUrl?: string;
}

export interface OnChainStatus {
  found: boolean;
  mode?: 'seal';
  /** Normalized request key: `<initiator collection>:#<firstId>#`. */
  requestId?: string;
  /** The initiator's signing collection. */
  collection?: string;
  docHash?: string;
  hashMismatch?: boolean;
  networkId?: number;
  requiredSigners?: string[];
  signatures?: OnChainSignatureStatus[];
  complete?: boolean;
  issuer?: OnChainIssuer;
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
