/**
 * Ephemeral key agreement: P-256 ECDH (universally supported in WebCrypto)
 * plus HKDF-SHA256 into an AES-256-GCM session key. The HKDF info binds the
 * key to the room and BOTH ephemeral public keys (host first), so a key only
 * exists for the exact pair of verified handshakes exchanged in this session.
 */
import { blake2b } from 'blakejs';
import { bytesToBase64 } from '@/features/p2p/lib/encoding';
import { blake2b256Hex } from '@/features/sign/lib/hash';
import { CHAT_HKDF_INFO } from '../constants/chat';

export interface EphemeralKeys {
  privateKey: CryptoKey;
  /** Raw (uncompressed point) public key bytes. */
  pubRaw: Uint8Array;
  pubB64: string;
  /** blake2b-256 hex of pubRaw — committed inside the ROLA challenge. */
  pubHashHex: string;
}

export async function generateEphemeralKeys(): Promise<EphemeralKeys> {
  let keyPair: CryptoKeyPair;
  try {
    keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
  } catch {
    throw new Error('crypto_unsupported');
  }
  const pubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  );
  return {
    privateKey: keyPair.privateKey,
    pubRaw,
    pubB64: bytesToBase64(pubRaw),
    pubHashHex: blake2b256Hex(pubRaw),
  };
}

export interface KeyTranscript {
  roomId: string;
  hostPubB64: string;
  guestPubB64: string;
}

/** Both peers derive the same AES-256-GCM key from the same transcript. */
export async function deriveChatKey(
  myPrivateKey: CryptoKey,
  peerPubRaw: Uint8Array,
  transcript: KeyTranscript,
): Promise<CryptoKey> {
  let sharedBits: ArrayBuffer;
  try {
    const peerKey = await crypto.subtle.importKey(
      'raw',
      peerPubRaw as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: peerKey },
      myPrivateKey,
      256,
    );
  } catch {
    throw new Error('peer_verification_failed');
  }

  const ikm = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, [
    'deriveBits',
  ]);
  const salt = blake2b(new TextEncoder().encode(transcript.roomId), undefined, 32);
  const info = new TextEncoder().encode(
    `${CHAT_HKDF_INFO}|${transcript.hostPubB64}|${transcript.guestPubB64}`,
  );
  const keyBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info },
    ikm,
    256,
  );
  return crypto.subtle.importKey('raw', keyBits, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}
