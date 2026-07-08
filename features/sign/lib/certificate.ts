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
 */
export function extractDisclosedName(
  personaData: unknown,
  policy: DisclosurePolicy,
): string | null {
  if (policy === 'none') return null;

  const name = findFullNameEntry(personaData);
  if (!name) return null;

  if (typeof name === 'string') {
    // A single string: we can only honour "full_name"; surname is unknown.
    return policy === 'surname' ? null : name.trim() || null;
  }

  const given = (name.givenNames ?? '').trim();
  const family = (name.familyName ?? '').trim();

  if (policy === 'surname') {
    return family || null;
  }
  // full_name: order by variant (eastern = family first) when known.
  const eastern = name.variant?.toLowerCase() === 'eastern';
  const full = eastern ? `${family} ${given}` : `${given} ${family}`;
  return full.trim() || null;
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
