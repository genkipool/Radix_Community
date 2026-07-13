// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  deriveChatKey,
  generateEphemeralKeys,
} from '@/features/chat/lib/handshake';
import {
  decryptChatMessage,
  encryptChatMessage,
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
  return { hostKey, guestKey, transcript, host, guest };
}

describe('chat key agreement', () => {
  it('both sides derive a working shared key', async () => {
    const { hostKey, guestKey } = await establishedPair();
    // Keys are non-extractable; prove equality by using them against each other.
    const wire = await encryptChatMessage(hostKey, 'host', 0, {
      text: 'hola',
      at: 123,
    });
    const plain = await decryptChatMessage(guestKey, 'host', 0, wire.ivB64, wire.ctB64);
    expect(plain).toEqual({ text: 'hola', at: 123 });
  });

  it('a different transcript yields a different key', async () => {
    const host = await generateEphemeralKeys();
    const guest = await generateEphemeralKeys();
    const base = {
      roomId: 'ab'.repeat(16),
      hostPubB64: host.pubB64,
      guestPubB64: guest.pubB64,
    };
    const keyA = await deriveChatKey(host.privateKey, guest.pubRaw, base);
    const keyB = await deriveChatKey(host.privateKey, guest.pubRaw, {
      ...base,
      roomId: 'cd'.repeat(16),
    });
    const wire = await encryptChatMessage(keyA, 'host', 0, { text: 'x', at: 1 });
    await expect(
      decryptChatMessage(keyB, 'host', 0, wire.ivB64, wire.ctB64),
    ).rejects.toThrow('message_rejected');
  });
});

describe('chat message crypto', () => {
  it('rejects replayed sequence numbers and reflected roles', async () => {
    const { hostKey, guestKey } = await establishedPair();
    const wire = await encryptChatMessage(hostKey, 'host', 5, { text: 'x', at: 1 });

    // Wrong seq (replay at another position).
    await expect(
      decryptChatMessage(guestKey, 'host', 6, wire.ivB64, wire.ctB64),
    ).rejects.toThrow('message_rejected');
    // Reflection: same bytes claimed as coming from the guest.
    await expect(
      decryptChatMessage(guestKey, 'guest', 5, wire.ivB64, wire.ctB64),
    ).rejects.toThrow('message_rejected');
    // Honest decrypt still works.
    await expect(
      decryptChatMessage(guestKey, 'host', 5, wire.ivB64, wire.ctB64),
    ).resolves.toEqual({ text: 'x', at: 1 });
  });

  it('rejects tampered ciphertext', async () => {
    const { hostKey, guestKey } = await establishedPair();
    const wire = await encryptChatMessage(hostKey, 'host', 0, { text: 'x', at: 1 });
    const corrupted = wire.ctB64.slice(0, -4) + (wire.ctB64.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(
      decryptChatMessage(guestKey, 'host', 0, wire.ivB64, corrupted),
    ).rejects.toThrow('message_rejected');
  });
});
