/**
 * Hashing + canonicalisation primitives shared by the client (signing) and the
 * server (verification). Blake2b-256 matches the hash Radix uses on-ledger.
 *
 * Runs in both the browser and Node (blakejs is pure JS, TextEncoder is global).
 */
import { blake2b } from 'blakejs';
import type { AttestationPayload } from '../types/sign.types';

const HEX = '0123456789abcdef';

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return out;
}

/** Blake2b-256 of raw bytes → lowercase hex (64 chars = 32 bytes). */
export function blake2b256Hex(bytes: Uint8Array): string {
  return toHex(blake2b(bytes, undefined, 32));
}

/** Blake2b-256 of a UTF-8 string → lowercase hex. */
export function blake2b256HexOfString(text: string): string {
  return blake2b256Hex(new TextEncoder().encode(text));
}

/**
 * Deterministic JSON serialisation: object keys sorted recursively so the same
 * logical payload always produces the same bytes (and thus the same challenge)
 * regardless of key insertion order or JS engine.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJSON).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') +
    '}'
  );
}

/**
 * The ROLA challenge the wallet signs = Blake2b-256 of the canonical payload.
 * Because it is derived from the payload, the signature cryptographically
 * commits to the document hash, message, timestamp and disclosure policy.
 * Result is 64 hex chars = exactly the 32-byte challenge ROLA expects.
 */
export function deriveChallenge(payload: AttestationPayload): string {
  return blake2b256HexOfString(canonicalJSON(payload));
}

/** Cryptographically-random 32-byte hex nonce (browser or Node). */
export function randomNonceHex(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return toHex(buf);
}
