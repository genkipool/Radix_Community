/**
 * Per-message encryption: AES-256-GCM with a random 96-bit IV and an AAD that
 * binds the sender's role and a strictly increasing per-direction sequence
 * number — replayed, reordered or reflected messages fail the tag.
 */
import { base64ToBytes, bytesToBase64 } from '@/features/p2p/lib/encoding';
import type { PeerRole } from '@/features/p2p/types/p2p.types';
import { CHAT_CONTEXT } from '../constants/chat';
import type { ChatPlaintext } from '../types/chat.types';

function messageAad(senderRole: PeerRole, seq: number): Uint8Array {
  const context = new TextEncoder().encode(CHAT_CONTEXT);
  const aad = new Uint8Array(context.length + 1 + 4);
  aad.set(context, 0);
  aad[context.length] = senderRole === 'host' ? 0 : 1;
  new DataView(aad.buffer).setUint32(context.length + 1, seq, false);
  return aad;
}

export async function encryptChatMessage(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  plaintext: ChatPlaintext,
): Promise<{ ivB64: string; ctB64: string }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: messageAad(senderRole, seq) as BufferSource,
    },
    key,
    new TextEncoder().encode(JSON.stringify(plaintext)),
  );
  return { ivB64: bytesToBase64(iv), ctB64: bytesToBase64(new Uint8Array(ct)) };
}

/** Throws Error('message_rejected') on any tampering or wrong seq/role. */
export async function decryptChatMessage(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  ivB64: string,
  ctB64: string,
): Promise<ChatPlaintext> {
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(ivB64) as BufferSource,
        additionalData: messageAad(senderRole, seq) as BufferSource,
      },
      key,
      base64ToBytes(ctB64) as BufferSource,
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as ChatPlaintext;
    if (typeof parsed.text !== 'string' || typeof parsed.at !== 'number') {
      throw new Error('message_rejected');
    }
    return parsed;
  } catch {
    throw new Error('message_rejected');
  }
}
