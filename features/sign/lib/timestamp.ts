/**
 * Trusted timestamps for OFF-ledger signatures (RFC 3161), shared client/server.
 *
 * An on-ledger signature already carries an independent clock: the transaction
 * that minted it was timestamped by consensus, and verification reads that time
 * back from the Gateway. An off-ledger (ROLA) signature had nothing of the sort
 * — its date was whatever the signer's browser said — so a certificate could
 * claim any date and still verify. A timestamp token closes that: a Time
 * Stamping Authority signs "this signature existed at T", and T cannot be moved
 * backwards by whoever holds the certificate.
 *
 * What the TSA sees is the imprint below: a hash of a hash of a signature. It
 * learns nothing about the document, the signer's identity or even the account.
 */

/** Domain separator, so this imprint can never collide with another hash use. */
const IMPRINT_PREFIX = 'radix-seal-timestamp:v1';

/**
 * The exact string whose SHA-256 the TSA timestamps. It commits to the signer,
 * the document (through the ROLA challenge) and the signature itself, so a token
 * can never be lifted from one signature onto another. Both the signing client
 * and the verifier derive it the same way, from data already in the certificate.
 */
export function timestampImprintInput(
  signerAccount: string,
  challenge: string,
  signatureHex: string,
): string {
  return [
    IMPRINT_PREFIX,
    signerAccount,
    challenge.toLowerCase(),
    signatureHex.toLowerCase(),
  ].join('|');
}

/** SHA-256 of a UTF-8 string as lowercase hex (WebCrypto: browser and Node). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** What the verifier reports about a signature's timestamp token. */
export interface TimestampCheck {
  /**
   * The token is cryptographically sound AND commits to this signature:
   * the CMS signature verifies, the chain links verify, the signing certificate
   * carries the time-stamping EKU, and the imprint is this signature's.
   */
  valid: boolean;
  /** The authority's asserted time (ISO-8601), or null when unusable. */
  genTime: string | null;
  /** Human-readable name of the signing authority, for display. */
  authority: string | null;
  /** SHA-256 of the topmost certificate the token chains to. */
  anchorFingerprint: string | null;
  /**
   * The anchor is one this deployment recognises. A `valid` token from an
   * unknown anchor is still real evidence, just not evidence THIS app vouches
   * for, so the two are reported separately rather than collapsed into one tick.
   */
  trusted: boolean;
  /** Machine-readable reason when `valid` is false. */
  reason?: string;
}

/** Maximum size of a timestamp token we will accept, base64 (16 KiB). */
export const MAX_TOKEN_BASE64 = 16 * 1024;

/**
 * How far a certificate's declared `signedAt` may sit from the independent
 * clock (the TSA's genTime, or the ledger commit) before it stops being
 * corroborated. The token is requested right after the wallet returns the proof
 * and an on-ledger signature commits seconds later, so real gaps are tiny;
 * ten minutes is slack for a slow wallet confirmation, not for a different day.
 */
export const SIGNED_AT_TOLERANCE_MS = 10 * 60 * 1000;

/**
 * An unambiguous instant, or null.
 *
 * `Date.parse` is happy to accept `07/19/2026 17:17:25` and resolve it against
 * whatever timezone the machine running the check happens to be in. Comparing
 * something like that against a ledger timestamp does not measure the record,
 * it measures the server's `TZ`: the same NFT would pass in UTC and fail two
 * hours out in Madrid. So only ISO-8601 carrying an explicit offset counts as
 * something we can compare; anything else is unknown, and says so.
 */
export function instantOf(text: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    return null;
  }
  const value = Date.parse(text);
  return Number.isNaN(value) ? null : value;
}

/**
 * True when `declared` is corroborated by an independent `anchor` time. Null
 * when there is no anchor to compare against (nothing is claimed either way).
 *
 * A `declared` value this app did not write — no timezone, or not a date at all
 * — counts as disagreement rather than as unknown: the certificate format is
 * ours to define, every date we emit is `toISOString()`, so anything else in
 * that slot has been through other hands.
 */
export function signedAtAgrees(
  declared: string,
  anchor: string | null,
): boolean | null {
  if (!anchor) return null;
  const a = instantOf(declared);
  const b = instantOf(anchor);
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= SIGNED_AT_TOLERANCE_MS;
}

/**
 * The same comparison for the `issued_at` written INSIDE an on-ledger NFT,
 * against the commit time of the transaction that minted it.
 *
 * Unlike a certificate, that field is not ours alone to define. Collections
 * minted before the format was pinned down carry a locale-formatted date with
 * no timezone (`07/19/2026 17:17:25`), and an NFT minted by hand through the
 * console carries whatever its owner typed. None of that is evidence of
 * backdating, so an unparseable value is reported as UNKNOWN. Accusing honest
 * records of contradicting the ledger would be worse than saying nothing.
 */
export function issuedAtAgrees(
  issuedAt: string,
  committedAt: string | null,
): boolean | null {
  if (!issuedAt || !committedAt) return null;
  const a = instantOf(issuedAt);
  const b = instantOf(committedAt);
  if (a === null || b === null) return null;
  return Math.abs(a - b) <= SIGNED_AT_TOLERANCE_MS;
}
