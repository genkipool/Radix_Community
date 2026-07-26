/**
 * Wallet identity for the chat handshake: challenge construction and CLIENT-
 * SIDE verification of the peer's ROLA proof.
 *
 * The ROLA signed message is blake2b-256 of:
 *   'R' (0x52) || challenge (32 bytes) || len(dAppDef) as u8 || dAppDef || origin
 * (mirrors `signature_message` in the Radix Rust SDK rola crate and
 * @radixdlt/rola). The wallet's Ed25519 signature over that hash is verified
 * with WebCrypto, and the public key must derive to the claimed account
 * address (radix-engine-toolkit) — so a verified handshake proves the peer
 * controls that account AND that the ephemeral ECDH key is theirs.
 */
import { blake2b } from 'blakejs';
import {
  blake2b256Hex,
  blake2b256HexOfString,
  canonicalJSON,
} from '@/features/sign/lib/hash';
import { base64ToBytes } from '@/features/p2p/lib/encoding';
import type { PeerRole } from '@/features/p2p/types/p2p.types';
import { CHAT_CONTEXT } from '../constants/chat';
import type {
  ChatChallengePayload,
  ChatWireMessage,
  VerifiedPeer,
} from '../types/chat.types';

export function buildChatChallengePayload(input: {
  roomId: string;
  role: PeerRole;
  ecdhPubHash: string;
  networkId: number;
}): ChatChallengePayload {
  return { v: 1, context: CHAT_CONTEXT, ...input };
}

/** 32-byte hex ROLA challenge committing to room, role and ephemeral key. */
export function deriveChatChallenge(payload: ChatChallengePayload): string {
  return blake2b256HexOfString(canonicalJSON(payload));
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** The exact bytes the wallet signs for a given challenge/dApp/origin. */
export function rolaSignatureMessage(
  challengeHex: string,
  dAppDefinitionAddress: string,
  origin: string,
): Uint8Array {
  const challenge = hexToBytes(challengeHex);
  const dApp = new TextEncoder().encode(dAppDefinitionAddress);
  const originBytes = new TextEncoder().encode(origin);
  const msg = new Uint8Array(1 + challenge.length + 1 + dApp.length + originBytes.length);
  let offset = 0;
  msg[offset++] = 0x52; // 'R'
  msg.set(challenge, offset);
  offset += challenge.length;
  msg[offset++] = dApp.length;
  msg.set(dApp, offset);
  offset += dApp.length;
  msg.set(originBytes, offset);
  return blake2b(msg, undefined, 32);
}

async function verifyEd25519(
  publicKeyHex: string,
  signatureHex: string,
  message: Uint8Array,
): Promise<boolean> {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKeyHex) as BufferSource,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
  } catch {
    // Browser without WebCrypto Ed25519 (pre-Baseline-2025 engines).
    throw new Error('crypto_unsupported');
  }
  return crypto.subtle.verify(
    { name: 'Ed25519' },
    key,
    hexToBytes(signatureHex) as BufferSource,
    message as BufferSource,
  );
}

/** Derive the virtual account address a public key controls (browser WASM). */
async function deriveAccountAddress(
  publicKeyHex: string,
  networkId: number,
): Promise<string> {
  const { PublicKey, RadixEngineToolkit } = await import(
    '@radixdlt/radix-engine-toolkit'
  );
  return RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    new PublicKey.Ed25519(publicKeyHex),
    networkId,
  );
}

export interface HandshakeContext {
  roomId: string;
  /** Role the PEER must have claimed (the opposite of ours). */
  expectedRole: PeerRole;
  networkId: number;
  dAppDefinitionAddress: string;
  origin: string;
}

/**
 * Fully verifies a peer's handshake. Throws Error('peer_verification_failed')
 * on any mismatch and Error('crypto_unsupported') if the browser can't verify
 * Ed25519. Returns the verified account identity.
 */
export async function verifyPeerHandshake(
  handshake: Extract<ChatWireMessage, { t: 'handshake' }>,
  context: HandshakeContext,
): Promise<VerifiedPeer> {
  if (
    handshake.v !== 1 ||
    handshake.role !== context.expectedRole ||
    handshake.networkId !== context.networkId ||
    handshake.curve !== 'curve25519'
  ) {
    throw new Error('peer_verification_failed');
  }

  // The challenge the peer's wallet must have signed commits to THEIR
  // ephemeral key — recompute it from the material they sent.
  const ecdhPubHash = blake2b256Hex(base64ToBytes(handshake.ecdhPubB64));
  const challenge = deriveChatChallenge(
    buildChatChallengePayload({
      roomId: context.roomId,
      role: handshake.role,
      ecdhPubHash,
      networkId: context.networkId,
    }),
  );
  const message = rolaSignatureMessage(
    challenge,
    context.dAppDefinitionAddress,
    context.origin,
  );

  const validSignature = await verifyEd25519(
    handshake.publicKey,
    handshake.signature,
    message,
  );
  if (!validSignature) throw new Error('peer_verification_failed');

  const derivedAccount = await deriveAccountAddress(
    handshake.publicKey,
    context.networkId,
  );
  if (derivedAccount !== handshake.account) {
    throw new Error('peer_verification_failed');
  }

  return {
    account: handshake.account,
    declaredName: sanitizeDeclaredName(handshake.label),
  };
}

/**
 * The persona label is free text chosen by the peer and never signed, so it is
 * treated as untrusted display data: trimmed, stripped of control characters
 * (which could fake line breaks or hide text in the header) and length-capped.
 */
export function sanitizeDeclaredName(label: unknown): string | undefined {
  if (typeof label !== 'string') return undefined;
  const clean = label
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, 48) : undefined;
}
