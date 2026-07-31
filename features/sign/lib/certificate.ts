/**
 * Certificate assembly, persona-name extraction and browser download helpers.
 */
import { CERT_SUFFIX } from '../constants/limits';
import type {
  AttestationEnvelope,
  AttestationPayload,
  DisclosurePolicy,
  SignatureEntry,
} from '../types/sign.types';

/**
 * Extract the disclosed name from the wallet's persona data according to the
 * chosen policy. Defensive: the wallet may return the name as a plain string or
 * as a `{ givenNames, familyName, nickname, variant }` structure, and may omit
 * it entirely (user has no name set) — in which case we return null.
 *
 * When the policy's own field comes back empty the name falls back, in order,
 * to the persona's nickname and then to `personaLabel` (the name the signer
 * gave that persona in their wallet). A signature certificate that says
 * "Firmado por: account_tdx_2_12x…" when the wallet plainly knows a name reads
 * like a bug; every step of the chain is still the signer's own self-declared
 * text, never a verified identity, which is what the certificate page says.
 *
 * `policy === 'none'` ("signature only") suppresses the persona DATA — nothing
 * is requested from the wallet, so no name and no email travel with the
 * signature — but it still keeps the persona label, which the app already holds
 * from the session the signer logged in with. Nothing extra is asked of the
 * wallet to get it. When there is no label either, the caller prints the
 * account address.
 *
 * None of this is load-bearing: `disclosedName` sits outside the signed payload
 * (the ROLA challenge is derived from `payload`, which does not include it), so
 * it is presentation only, exactly as the "self-declared" note on the
 * certificate page says.
 */
export function extractDisclosedName(
  personaData: unknown,
  policy: DisclosurePolicy,
  /** The connected session's persona label (see the note above). */
  personaLabel?: string | null,
): string | null {
  const fallback = personaLabel?.trim() || null;
  if (policy === 'none') return fallback;

  const name = findFullNameEntry(personaData);
  if (!name) return fallback;

  if (typeof name === 'string') {
    // A single string: we can only honour "full_name"; surname is unknown.
    const whole = name.trim();
    if (policy === 'surname') return fallback;
    return whole || fallback;
  }

  const given = (name.givenNames ?? '').trim();
  const family = (name.familyName ?? '').trim();
  const nickname = (name.nickname ?? '').trim();

  if (policy === 'surname') {
    return family || nickname || fallback;
  }
  // full_name: order by variant (eastern = family first) when known.
  const eastern = name.variant?.toLowerCase() === 'eastern';
  const full = (eastern ? `${family} ${given}` : `${given} ${family}`).trim();
  return full || nickname || fallback;
}

/**
 * Extract the first disclosed email from the wallet's persona data, or null.
 * Defensive against string / string[] / { emailAddresses } shapes.
 */
export function extractDisclosedEmail(personaData: unknown): string | null {
  if (!Array.isArray(personaData)) return null;
  for (const entry of personaData) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const kind = e.entry ?? e.field;
    if (kind !== 'emailAddresses') continue;
    const value = (e.fields ?? e.value ?? e.emailAddresses) as unknown;
    if (typeof value === 'string') return value.trim() || null;
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === 'string') as
        | string
        | undefined;
      return first?.trim() || null;
    }
  }
  return null;
}

interface PersonaName {
  givenNames?: string;
  familyName?: string;
  nickname?: string;
  variant?: string;
}

function findFullNameEntry(personaData: unknown): string | PersonaName | null {
  if (!Array.isArray(personaData)) return null;
  for (const entry of personaData) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    // RDT shapes: { entry: 'fullName', fields: {...} } or { entry:'fullName', value }
    const kind = e.entry ?? e.field;
    if (kind !== 'fullName') continue;
    const value = (e.fields ?? e.value ?? e) as unknown;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return value as PersonaName;
  }
  return null;
}

/** Create a fresh certificate with its first signature. */
export function buildEnvelope(
  payload: AttestationPayload,
  firstSignature: SignatureEntry,
): AttestationEnvelope {
  return { payload, signatures: [firstSignature], onChain: null };
}

/**
 * Builds a certificate for an ON-LEDGER (multi-party) signing, so every mode
 * yields a downloadable artifact. Its signatures carry NO ROLA proof
 * (`proof: null`): each is proven by the signer's on-chain signature NFT, which
 * the verifier re-checks via the chain of custody. `onChain` stays null because
 * the signatures live in each signer's own Seal-owned collection, not one.
 */
export function buildOnChainCertificate(input: {
  docHash: string;
  fileName: string;
  fileSize: number;
  networkId: number;
  /** The invited/required signers (from the on-ledger request). */
  requiredSigners: string[];
  /**
   * Accounts that have signed on-ledger so far, each with the consensus time of
   * the transaction that recorded it. That time is the signature's real date;
   * the certificate is often downloaded days later, and stamping it with the
   * moment of download would put a date on the page that the ledger contradicts.
   */
  signedAccounts: Array<{ account: string; signedAt?: string | null }>;
  nonce: string;
  /** On-ledger request key, so verification re-resolves the required set. */
  requestId?: string;
}): AttestationEnvelope {
  const now = new Date().toISOString();
  const payload: AttestationPayload = {
    v: 1,
    docHash: input.docHash,
    hashAlg: 'blake2b-256',
    fileName: input.fileName,
    fileSize: input.fileSize,
    message: '',
    disclosure: 'none',
    email: false,
    signers: input.requiredSigners,
    timestamp: now,
    networkId: input.networkId,
    nonce: input.nonce,
  };
  return {
    payload,
    signatures: input.signedAccounts.map(({ account, signedAt }) => ({
      signerAccount: account,
      disclosedName: null,
      disclosedEmail: null,
      proof: null,
      // Falls back to now only when the ledger time could not be read, and
      // verification then reports the date as uncorroborated.
      signedAt: signedAt || now,
    })),
    onChain: null,
    request: input.requestId
      ? { networkId: input.networkId, requestId: input.requestId }
      : null,
  };
}

/** Append a co-signer's signature to an existing certificate. */
export function appendSignature(
  envelope: AttestationEnvelope,
  signature: SignatureEntry,
): AttestationEnvelope {
  return { ...envelope, signatures: [...envelope.signatures, signature] };
}

/** True when the certificate has a valid-looking entry for every required signer. */
export function signedAccounts(envelope: AttestationEnvelope): string[] {
  return envelope.signatures.map((s) => s.signerAccount);
}

/** Required signers still missing a signature (empty when open or complete). */
export function pendingSigners(envelope: AttestationEnvelope): string[] {
  const signed = new Set(signedAccounts(envelope));
  return envelope.payload.signers.filter((a) => !signed.has(a));
}

/** `report.pdf` → `report.pdf.radixsig.json` */
export function certificateFileName(originalName: string): string {
  return `${originalName}${CERT_SUFFIX}`;
}

/** Trigger a browser download from in-memory bytes, then revoke the URL. */
export function downloadBytes(
  bytes: Uint8Array | Blob,
  fileName: string,
  mime = 'application/octet-stream',
): void {
  const blob =
    bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCertificate(envelope: AttestationEnvelope): void {
  const json = JSON.stringify(envelope, null, 2);
  downloadBytes(
    new Blob([json], { type: 'application/json' }),
    certificateFileName(envelope.payload.fileName),
    'application/json',
  );
}
