import type { ChatErrorCode } from '../types/chat.types';

const CODES: ReadonlySet<string> = new Set([
  'wallet_rejected',
  'no_proof',
  'challenge_mismatch',
  'secp256k1',
  'peer_verification_failed',
  'peer_disconnected',
  'room_busy',
  'signaling_unavailable',
  'webrtc_failed',
  'crypto_unsupported',
  'message_rejected',
  'storage_quota',
] satisfies ChatErrorCode[]);

/** Map a thrown Error(<code>) to its i18n error code; anything else → unknown. */
export function toChatErrorCode(error: unknown): ChatErrorCode {
  const message = error instanceof Error ? error.message : '';
  return CODES.has(message) ? (message as ChatErrorCode) : 'unknown';
}
