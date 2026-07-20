/**
 * Per-message encryption: AES-256-GCM with a random 96-bit IV and an AAD that
 * binds the sender's role and a strictly increasing per-direction sequence
 * number — replayed, reordered or reflected messages fail the tag.
 *
 * Files ride the same session key: the announcement (`ChatFileMeta`) and each
 * binary frame are encrypted separately, with AADs that additionally bind the
 * announcement's sequence number and the frame index. Each AAD family has a
 * distinct marker byte, so ciphertexts can never be replayed across kinds.
 */
import { base64ToBytes, bytesToBase64 } from '@/features/p2p/lib/encoding';
import type { PeerRole } from '@/features/p2p/types/p2p.types';
import { CHAT_CONTEXT } from '../constants/chat';
import type { ChatFileMeta, ChatPlaintext } from '../types/chat.types';

const IV_BYTES = 12;

/** context || role || trailing u32/marker fields. */
function buildAad(senderRole: PeerRole, marker: number | null, seqs: number[]): Uint8Array {
  const context = new TextEncoder().encode(CHAT_CONTEXT);
  const aad = new Uint8Array(context.length + 1 + (marker == null ? 0 : 1) + seqs.length * 4);
  aad.set(context, 0);
  aad[context.length] = senderRole === 'host' ? 0 : 1;
  let offset = context.length + 1;
  if (marker != null) {
    aad[offset] = marker;
    offset += 1;
  }
  const view = new DataView(aad.buffer);
  for (const seq of seqs) {
    view.setUint32(offset, seq, false);
    offset += 4;
  }
  return aad;
}

/** Text messages keep the original v1 AAD layout (no marker). */
const messageAad = (senderRole: PeerRole, seq: number) =>
  buildAad(senderRole, null, [seq]);
/** File announcement: marker 'F'. */
const fileMetaAad = (senderRole: PeerRole, seq: number) =>
  buildAad(senderRole, 0x46, [seq]);
/** File frame: marker 'C', bound to the announcement seq AND the frame index. */
const fileChunkAad = (senderRole: PeerRole, seq: number, index: number) =>
  buildAad(senderRole, 0x43, [seq, index]);

async function encryptWithAad(
  key: CryptoKey,
  aad: Uint8Array,
  plain: Uint8Array,
): Promise<{ iv: Uint8Array; ct: Uint8Array }> {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad as BufferSource },
    key,
    plain as BufferSource,
  );
  return { iv, ct: new Uint8Array(ct) };
}

/** Throws Error('message_rejected') on any tampering or wrong AAD. */
async function decryptWithAad(
  key: CryptoKey,
  aad: Uint8Array,
  iv: Uint8Array,
  ct: Uint8Array,
): Promise<Uint8Array> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad as BufferSource },
      key,
      ct as BufferSource,
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error('message_rejected');
  }
}

/** JSON.parse that maps malformed payloads to the protocol error. */
function parseJson<T>(plain: Uint8Array): T {
  try {
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new Error('message_rejected');
  }
}

export async function encryptChatMessage(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  plaintext: ChatPlaintext,
): Promise<{ ivB64: string; ctB64: string }> {
  const { iv, ct } = await encryptWithAad(
    key,
    messageAad(senderRole, seq),
    new TextEncoder().encode(JSON.stringify(plaintext)),
  );
  return { ivB64: bytesToBase64(iv), ctB64: bytesToBase64(ct) };
}

/** Throws Error('message_rejected') on any tampering or wrong seq/role. */
export async function decryptChatMessage(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  ivB64: string,
  ctB64: string,
): Promise<ChatPlaintext> {
  const plain = await decryptWithAad(
    key,
    messageAad(senderRole, seq),
    base64ToBytes(ivB64),
    base64ToBytes(ctB64),
  );
  const parsed = parseJson<ChatPlaintext>(plain);
  if (typeof parsed.text !== 'string' || typeof parsed.at !== 'number') {
    throw new Error('message_rejected');
  }
  return parsed;
}

export async function encryptFileMeta(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  meta: ChatFileMeta,
): Promise<{ ivB64: string; ctB64: string }> {
  const { iv, ct } = await encryptWithAad(
    key,
    fileMetaAad(senderRole, seq),
    new TextEncoder().encode(JSON.stringify(meta)),
  );
  return { ivB64: bytesToBase64(iv), ctB64: bytesToBase64(ct) };
}

/** Throws Error('message_rejected') on any tampering or wrong seq/role. */
export async function decryptFileMeta(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  ivB64: string,
  ctB64: string,
): Promise<ChatFileMeta> {
  const plain = await decryptWithAad(
    key,
    fileMetaAad(senderRole, seq),
    base64ToBytes(ivB64),
    base64ToBytes(ctB64),
  );
  const parsed = parseJson<ChatFileMeta>(plain);
  if (
    typeof parsed.name !== 'string' ||
    typeof parsed.mime !== 'string' ||
    typeof parsed.size !== 'number' ||
    !Number.isInteger(parsed.size) ||
    parsed.size < 0 ||
    typeof parsed.at !== 'number'
  ) {
    throw new Error('message_rejected');
  }
  return parsed;
}

/** One encrypted binary frame: [12-byte IV][GCM ciphertext+tag]. */
export async function encryptFileChunk(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  index: number,
  bytes: Uint8Array,
): Promise<Uint8Array> {
  const { iv, ct } = await encryptWithAad(
    key,
    fileChunkAad(senderRole, seq, index),
    bytes,
  );
  const frame = new Uint8Array(iv.length + ct.length);
  frame.set(iv, 0);
  frame.set(ct, iv.length);
  return frame;
}

/** Throws Error('message_rejected') on tampering, replay or reordering. */
export async function decryptFileChunk(
  key: CryptoKey,
  senderRole: PeerRole,
  seq: number,
  index: number,
  frame: Uint8Array,
): Promise<Uint8Array> {
  if (frame.length <= IV_BYTES) throw new Error('message_rejected');
  return decryptWithAad(
    key,
    fileChunkAad(senderRole, seq, index),
    frame.slice(0, IV_BYTES),
    frame.slice(IV_BYTES),
  );
}
