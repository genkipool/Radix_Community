/**
 * RFC 3161 protocol: build a TimeStampReq, talk to the authority, unwrap the
 * TimeStampResp. Server-side only — a browser cannot reach a TSA directly
 * (no CORS on any of them), so the app proxies the round trip.
 *
 * Deliberately hand-rolled DER: a TimeStampReq is four fields and this avoids
 * pulling an ASN.1 encoder into the request path. Token VERIFICATION, which is
 * where getting it wrong actually matters, uses node-forge (see tsa-verify).
 */
import 'server-only';

/** Default authority. Overridable so a deployment can point at its own. */
const DEFAULT_TSA_URL = 'https://freetsa.org/tsr';

export function tsaUrl(): string {
  return process.env.SIGN_TSA_URL || DEFAULT_TSA_URL;
}

/* ─── Minimal DER writer ──────────────────────────────────────────────────── */

function derLength(length: number): number[] {
  if (length < 0x80) return [length];
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest >>>= 8) bytes.unshift(rest & 0xff);
  return [0x80 | bytes.length, ...bytes];
}

function tlv(tag: number, value: ArrayLike<number>): number[] {
  const bytes = Array.from(value);
  return [tag, ...derLength(bytes.length), ...bytes];
}

const SEQUENCE = 0x30;
const INTEGER = 0x02;
const OCTET_STRING = 0x04;
const BOOLEAN = 0x01;
const NULL = 0x05;
const OID = 0x06;

/** OID 2.16.840.1.101.3.4.2.1 (sha256), body bytes only. */
const OID_SHA256 = [0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];

/**
 * A positive DER INTEGER from random bytes. The top bit is cleared and a zero
 * leading byte replaced, so the value never needs a padding byte and never
 * carries a non-minimal encoding — both of which some authorities reject.
 */
function randomNonce(): number[] {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  bytes[0] &= 0x7f;
  if (bytes[0] === 0) bytes[0] = 1;
  return Array.from(bytes);
}

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

/**
 * TimeStampReq over a SHA-256 imprint, asking the authority to include its
 * certificates (`certReq`) — without them the token cannot be verified by
 * anyone who receives the certificate later, which is the whole point.
 */
export function buildTimeStampRequest(imprintHex: string): Uint8Array {
  const messageImprint = tlv(SEQUENCE, [
    ...tlv(SEQUENCE, [...tlv(OID, OID_SHA256), ...tlv(NULL, [])]),
    ...tlv(OCTET_STRING, hexToBytes(imprintHex)),
  ]);
  return Uint8Array.from(
    tlv(SEQUENCE, [
      ...tlv(INTEGER, [1]),
      ...messageImprint,
      ...tlv(INTEGER, randomNonce()),
      ...tlv(BOOLEAN, [0xff]),
    ]),
  );
}

/* ─── Minimal DER reader ──────────────────────────────────────────────────── */

interface DerNode {
  tag: number;
  /** Offset of the tag byte. */
  start: number;
  /** Offset of the first content byte. */
  contentStart: number;
  /** Offset just past the last content byte. */
  end: number;
}

export function readNode(bytes: Uint8Array, offset: number): DerNode | null {
  if (offset + 2 > bytes.length) return null;
  const tag = bytes[offset];
  const first = bytes[offset + 1];
  let contentStart = offset + 2;
  let length = first;
  if (first & 0x80) {
    const count = first & 0x7f;
    // Indefinite length is not valid DER, and we refuse to guess.
    if (count === 0 || count > 4 || offset + 2 + count > bytes.length) return null;
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + bytes[offset + 2 + i];
    contentStart = offset + 2 + count;
  }
  const end = contentStart + length;
  if (end > bytes.length) return null;
  return { tag, start: offset, contentStart, end };
}

export function childNodes(bytes: Uint8Array, node: DerNode): DerNode[] {
  const out: DerNode[] = [];
  let offset = node.contentStart;
  while (offset < node.end) {
    const child = readNode(bytes, offset);
    if (!child) break;
    out.push(child);
    offset = child.end;
  }
  return out;
}

function integerValue(bytes: Uint8Array, node: DerNode): number {
  let value = 0;
  for (let i = node.contentStart; i < node.end; i++) value = value * 256 + bytes[i];
  return value;
}

/**
 * Unwraps a TimeStampResp into the bare TimeStampToken (a CMS ContentInfo).
 * Returns null unless the authority granted the request and attached a token.
 */
export function extractTimeStampToken(response: Uint8Array): Uint8Array | null {
  const top = readNode(response, 0);
  if (!top || top.tag !== SEQUENCE) return null;
  const parts = childNodes(response, top);
  const statusInfo = parts[0];
  if (!statusInfo || statusInfo.tag !== SEQUENCE) return null;
  const status = childNodes(response, statusInfo)[0];
  if (!status || status.tag !== INTEGER) return null;
  // 0 = granted, 1 = granted with modifications. Anything else is a rejection.
  const code = integerValue(response, status);
  if (code !== 0 && code !== 1) return null;
  const token = parts[1];
  if (!token || token.tag !== SEQUENCE) return null;
  return response.slice(token.start, token.end);
}

/* ─── The round trip ──────────────────────────────────────────────────────── */

/** Cap on the response we will read, so a hostile TSA cannot exhaust memory. */
const MAX_RESPONSE_BYTES = 64 * 1024;

/**
 * Asks the authority to timestamp `imprintHex` and returns the raw token.
 * Throws on any transport or protocol failure; callers treat timestamping as
 * best-effort, because a TSA being down must never block someone from signing.
 */
export async function fetchTimeStampToken(imprintHex: string): Promise<Uint8Array> {
  const response = await fetch(tsaUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/timestamp-query',
      Accept: 'application/timestamp-reply',
    },
    body: new Uint8Array(buildTimeStampRequest(imprintHex)),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('tsa_http_error');
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.length === 0 || body.length > MAX_RESPONSE_BYTES) {
    throw new Error('tsa_bad_response');
  }
  const token = extractTimeStampToken(body);
  if (!token) throw new Error('tsa_rejected');
  return token;
}
