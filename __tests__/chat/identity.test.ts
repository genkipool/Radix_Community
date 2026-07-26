// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  buildChatChallengePayload,
  deriveChatChallenge,
  rolaSignatureMessage,
  sanitizeDeclaredName,
  verifyPeerHandshake,
} from '@/features/chat/lib/identity';
import { generateEphemeralKeys } from '@/features/chat/lib/handshake';
import { blake2b256Hex } from '@/features/sign/lib/hash';
import type { ChatWireMessage } from '@/features/chat/types/chat.types';

const CONTEXT = {
  roomId: '12'.repeat(16),
  networkId: 2,
  dAppDefinitionAddress: 'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk',
  origin: 'https://example.test',
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Synthetic wallet: an Ed25519 keypair that signs exactly like ROLA does. */
async function syntheticWalletHandshake() {
  const walletKeys = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicKeyHex = toHex(
    new Uint8Array(await crypto.subtle.exportKey('raw', walletKeys.publicKey)),
  );
  const account = await RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    new PublicKey.Ed25519(publicKeyHex),
    CONTEXT.networkId,
  );

  const ecdh = await generateEphemeralKeys();
  const challenge = deriveChatChallenge(
    buildChatChallengePayload({
      roomId: CONTEXT.roomId,
      role: 'guest',
      ecdhPubHash: blake2b256Hex(ecdh.pubRaw),
      networkId: CONTEXT.networkId,
    }),
  );
  const message = rolaSignatureMessage(
    challenge,
    CONTEXT.dAppDefinitionAddress,
    CONTEXT.origin,
  );
  const signature = toHex(
    new Uint8Array(
      await crypto.subtle.sign({ name: 'Ed25519' }, walletKeys.privateKey, message as BufferSource),
    ),
  );

  const handshake: Extract<ChatWireMessage, { t: 'handshake' }> = {
    t: 'handshake',
    v: 1,
    role: 'guest',
    account,
    publicKey: publicKeyHex,
    curve: 'curve25519',
    signature,
    ecdhPubB64: ecdh.pubB64,
    networkId: CONTEXT.networkId,
  };
  return handshake;
}

describe('rolaSignatureMessage', () => {
  it('is deterministic and sensitive to every input', () => {
    const challenge = 'ab'.repeat(32);
    const base = rolaSignatureMessage(challenge, 'account_x', 'https://a');
    expect(base).toHaveLength(32);
    expect(rolaSignatureMessage(challenge, 'account_x', 'https://a')).toEqual(base);
    expect(rolaSignatureMessage('cd'.repeat(32), 'account_x', 'https://a')).not.toEqual(base);
    expect(rolaSignatureMessage(challenge, 'account_y', 'https://a')).not.toEqual(base);
    expect(rolaSignatureMessage(challenge, 'account_x', 'https://b')).not.toEqual(base);
  });
});

describe('verifyPeerHandshake', () => {
  it('accepts a correctly signed handshake and returns the account', async () => {
    const handshake = await syntheticWalletHandshake();
    const verified = await verifyPeerHandshake(handshake, {
      ...CONTEXT,
      expectedRole: 'guest',
    });
    expect(verified.account).toBe(handshake.account);
  });

  it('rejects a wrong role, network, account or tampered signature', async () => {
    const handshake = await syntheticWalletHandshake();
    const context = { ...CONTEXT, expectedRole: 'guest' as const };

    await expect(
      verifyPeerHandshake(handshake, { ...context, expectedRole: 'host' }),
    ).rejects.toThrow('peer_verification_failed');

    await expect(
      verifyPeerHandshake({ ...handshake, account: 'account_tdx_2_fake' }, context),
    ).rejects.toThrow('peer_verification_failed');

    const badSig =
      handshake.signature.slice(0, -2) +
      (handshake.signature.endsWith('00') ? '01' : '00');
    await expect(
      verifyPeerHandshake({ ...handshake, signature: badSig }, context),
    ).rejects.toThrow('peer_verification_failed');

    // Swapping the ephemeral key breaks the challenge commitment.
    const other = await generateEphemeralKeys();
    await expect(
      verifyPeerHandshake({ ...handshake, ecdhPubB64: other.pubB64 }, context),
    ).rejects.toThrow('peer_verification_failed');
  });

  it('rejects handshakes bound to a different origin or dApp definition', async () => {
    const handshake = await syntheticWalletHandshake();
    await expect(
      verifyPeerHandshake(handshake, {
        ...CONTEXT,
        expectedRole: 'guest',
        origin: 'https://evil.test',
      }),
    ).rejects.toThrow('peer_verification_failed');
  });
});

describe('declared peer name', () => {
  it('carries the persona label through a verified handshake', async () => {
    const handshake = await syntheticWalletHandshake();
    const verified = await verifyPeerHandshake(
      { ...handshake, label: '  Luis  ' },
      { ...CONTEXT, expectedRole: 'guest' },
    );
    expect(verified.declaredName).toBe('Luis');
  });

  it('is absent when the peer sends none', async () => {
    const handshake = await syntheticWalletHandshake();
    const verified = await verifyPeerHandshake(handshake, {
      ...CONTEXT,
      expectedRole: 'guest',
    });
    expect(verified.declaredName).toBeUndefined();
  });

  it('strips control characters and caps the length of untrusted labels', () => {
    // A label is free text from the peer: newlines and zero-width characters
    // could otherwise forge extra lines in the header.
    expect(sanitizeDeclaredName('a b\u200bc\nd')).toBe('a b c d');
    expect(sanitizeDeclaredName('   ')).toBeUndefined();
    expect(sanitizeDeclaredName(42)).toBeUndefined();
    expect(sanitizeDeclaredName('x'.repeat(200))).toHaveLength(48);
  });
});
