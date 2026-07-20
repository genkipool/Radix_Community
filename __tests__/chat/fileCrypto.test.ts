// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  deriveChatKey,
  generateEphemeralKeys,
} from '@/features/chat/lib/handshake';
import {
  decryptChatMessage,
  decryptFileChunk,
  decryptFileMeta,
  encryptChatMessage,
  encryptFileChunk,
  encryptFileMeta,
} from '@/features/chat/lib/chatCrypto';

async function establishedPair() {
  const host = await generateEphemeralKeys();
  const guest = await generateEphemeralKeys();
  const transcript = {
    roomId: 'ab'.repeat(16),
    hostPubB64: host.pubB64,
    guestPubB64: guest.pubB64,
  };
  const hostKey = await deriveChatKey(host.privateKey, guest.pubRaw, transcript);
  const guestKey = await deriveChatKey(guest.privateKey, host.pubRaw, transcript);
  return { hostKey, guestKey };
}

const META = { name: 'doc.pdf', mime: 'application/pdf', size: 5, at: 42 };

describe('chat file encryption', () => {
  it('meta and chunks round-trip between the two derived keys', async () => {
    const { hostKey, guestKey } = await establishedPair();
    const wire = await encryptFileMeta(hostKey, 'host', 3, META);
    const meta = await decryptFileMeta(guestKey, 'host', 3, wire.ivB64, wire.ctB64);
    expect(meta).toEqual(META);

    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const frame = await encryptFileChunk(hostKey, 'host', 3, 0, bytes);
    const plain = await decryptFileChunk(guestKey, 'host', 3, 0, frame);
    expect(Array.from(plain)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects chunks replayed at another index or sequence', async () => {
    const { hostKey, guestKey } = await establishedPair();
    const frame = await encryptFileChunk(hostKey, 'host', 3, 0, new Uint8Array(8));
    await expect(decryptFileChunk(guestKey, 'host', 3, 1, frame)).rejects.toThrow(
      'message_rejected',
    );
    await expect(decryptFileChunk(guestKey, 'host', 4, 0, frame)).rejects.toThrow(
      'message_rejected',
    );
    await expect(decryptFileChunk(guestKey, 'guest', 3, 0, frame)).rejects.toThrow(
      'message_rejected',
    );
  });

  it('file announcements cannot be confused with text messages at the same seq', async () => {
    const { hostKey, guestKey } = await establishedPair();
    const wire = await encryptFileMeta(hostKey, 'host', 0, META);
    await expect(
      decryptChatMessage(guestKey, 'host', 0, wire.ivB64, wire.ctB64),
    ).rejects.toThrow('message_rejected');
    const text = await encryptChatMessage(hostKey, 'host', 0, { text: 'x', at: 1 });
    await expect(
      decryptFileMeta(guestKey, 'host', 0, text.ivB64, text.ctB64),
    ).rejects.toThrow('message_rejected');
  });

  it('rejects malformed meta payloads', async () => {
    const { hostKey, guestKey } = await establishedPair();
    const wire = await encryptFileMeta(hostKey, 'host', 0, {
      ...META,
      size: -1,
    });
    await expect(
      decryptFileMeta(guestKey, 'host', 0, wire.ivB64, wire.ctB64),
    ).rejects.toThrow('message_rejected');
  });
});
