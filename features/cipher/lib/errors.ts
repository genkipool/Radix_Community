import type { CipherErrorCode } from '../types/cipher.types';

const CODES: ReadonlySet<string> = new Set([
  'wallet_rejected',
  'no_proof',
  'challenge_mismatch',
  'secp256k1',
  'origin_mismatch',
  'network_mismatch',
  'account_mismatch',
  'header_mismatch',
  'decrypt_failed',
  'peer_disconnected',
  'room_busy',
  'signaling_unavailable',
  'storage_quota',
  'invalid_container',
  'webrtc_failed',
  'file_read',
] satisfies CipherErrorCode[]);

/** Map a thrown Error(<code>) to its i18n error code; anything else → unknown. */
export function toCipherErrorCode(error: unknown): CipherErrorCode {
  const message = error instanceof Error ? error.message : '';
  return CODES.has(message) ? (message as CipherErrorCode) : 'unknown';
}
