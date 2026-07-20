/**
 * Key derivation: deterministic ROLA signature → AES-256-GCM key.
 *
 * The wallet signs `deriveCipherChallenge(payload)` (Ed25519 is deterministic
 * per RFC 8032, so the same account over the same challenge always yields the
 * same signature). That signature is the HKDF input keying material; the
 * per-file salt doubles as the HKDF salt. Runs in browser and Node (WebCrypto).
 */
import {
  blake2b256HexOfString,
  canonicalJSON,
  randomNonceHex,
  toHex,
} from '@/features/sign/lib/hash';
import { CIPHER_CONTEXT, HKDF_INFO } from '../constants/cipher';
import type { CipherChallengePayload } from '../types/cipher.types';

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new Error('invalid_container');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export { toHex };

/** Fresh 32-byte hex salt; unique per file, never reused. */
export const randomFileSaltHex = randomNonceHex;

/** Fresh 8-byte hex IV prefix; per-chunk IV = baseIv || chunk index. */
export function randomBaseIvHex(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

export function buildChallengePayload(
  fileSaltHex: string,
  networkId: number,
): CipherChallengePayload {
  return { v: 1, context: CIPHER_CONTEXT, fileSalt: fileSaltHex, networkId };
}

/**
 * The 32-byte ROLA challenge the wallet signs, derived from the canonical
 * payload exactly like the sign feature does — deterministic by construction.
 */
export function deriveCipherChallenge(payload: CipherChallengePayload): string {
  return blake2b256HexOfString(canonicalJSON(payload));
}

/**
 * The 32-byte ROLA challenge a RECEIVER signs to request the key of a
 * ROLA + Ledger container. Commits to the exact container (headerHash) and to
 * this session (roomId), so a captured proof cannot be replayed elsewhere.
 * Derivable by receiver, sender and the authorization endpoint alike.
 */
export function deriveUnlockChallenge(input: {
  headerHash: string;
  roomId: string;
  networkId: number;
}): string {
  return blake2b256HexOfString(
    canonicalJSON({
      v: 1,
      context: 'radix-cipher-unlock-v1',
      headerHash: input.headerHash,
      roomId: input.roomId,
      networkId: input.networkId,
    }),
  );
}

/** HKDF-SHA256(ikm = signature, salt = fileSalt, info = HKDF_INFO) → 32 bytes. */
export async function deriveFileKeyBits(
  signatureHex: string,
  fileSaltHex: string,
): Promise<Uint8Array> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    hexToBytes(signatureHex) as BufferSource,
    'HKDF',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: hexToBytes(fileSaltHex) as BufferSource,
      info: new TextEncoder().encode(HKDF_INFO),
    },
    ikm,
    256,
  );
  return new Uint8Array(bits);
}

/** Import raw key bits as a non-extractable AES-GCM key. */
export function importAesKey(bits: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bits as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}
