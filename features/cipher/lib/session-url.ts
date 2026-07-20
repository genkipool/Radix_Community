/**
 * Cipher share URLs: `/{locale}/console/encrypt-document#m=<mode>&r=<roomId>`.
 * Thin typed wrapper over the generic P2P share-URL helpers.
 */
import {
  buildShareUrl,
  isRoomId,
  parseShareHash,
  randomRoomId,
} from '@/features/p2p/lib/session-url';
import type { SessionMode } from '../types/cipher.types';

export { randomRoomId };

export function buildSessionUrl(mode: SessionMode, roomId: string): string {
  return buildShareUrl({ m: mode, r: roomId });
}

export function parseSessionHash(
  hash: string,
): { mode: SessionMode; roomId: string } | null {
  const params = parseShareHash(hash);
  const mode = params.get('m');
  const roomId = params.get('r');
  if ((mode !== 'receive' && mode !== 'unlock') || !roomId) return null;
  if (!isRoomId(roomId)) return null;
  return { mode, roomId };
}
