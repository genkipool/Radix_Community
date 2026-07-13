'use client';

import { useEffect, useRef, useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { NETWORKS } from '@/features/wallet/constants/network';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { requestAccountProof } from '@/features/wallet/lib/rola-proof';
import { base64ToBytes } from '@/features/p2p/lib/encoding';
import { createSignaling, type CipherSignaling } from '@/features/p2p/lib/signaling';
import { buildShareUrl, randomRoomId } from '@/features/p2p/lib/session-url';
import {
  connectAsGuest,
  connectAsHost,
  type Peer,
  type PeerHandlers,
} from '@/features/p2p/lib/webrtc';
import type { PeerRole } from '@/features/p2p/types/p2p.types';
import { MAX_MESSAGE_CHARS } from '../constants/chat';
import type {
  ChatErrorCode,
  ChatMessage,
  ChatPhase,
  ChatWireMessage,
  VerifiedPeer,
} from '../types/chat.types';
import { decryptChatMessage, encryptChatMessage } from '../lib/chatCrypto';
import { toChatErrorCode } from '../lib/errors';
import {
  deriveChatKey,
  generateEphemeralKeys,
  type EphemeralKeys,
} from '../lib/handshake';
import {
  buildChatChallengePayload,
  deriveChatChallenge,
  verifyPeerHandshake,
} from '../lib/identity';

type ChatPeer = Peer<ChatWireMessage>;
type HandshakeMessage = Extract<ChatWireMessage, { t: 'handshake' }>;

/** Abort the session if the peer connects but never completes the handshake. */
const HANDSHAKE_TIMEOUT_MS = 60_000;

/**
 * End-to-end encrypted chat session, host or guest side.
 *
 * Protocol: on channel open each side sends a `handshake` carrying its
 * ephemeral ECDH public key and a ROLA proof whose challenge commits to that
 * key, the room and the role. Each side verifies the other's proof locally
 * (Ed25519 + account derivation); only then is the AES-256-GCM session key
 * derived (ECDH + HKDF over the room/keys transcript) and the room becomes
 * `secure`. Every message is individually encrypted with an anti-replay
 * sequence AAD — on top of WebRTC's DTLS.
 */
export function useChatSession() {
  const { activeNetworkId } = useRadixWallet();
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerIdentity, setPeerIdentity] = useState<VerifiedPeer | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<ChatErrorCode | null>(null);

  const phaseRef = useRef<ChatPhase>('idle');
  const roleRef = useRef<PeerRole>('host');
  const roomIdRef = useRef<string | null>(null);
  const peerRef = useRef<ChatPeer | null>(null);
  const signalingRef = useRef<CipherSignaling | null>(null);
  const ephemeralRef = useRef<EphemeralKeys | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const sendSeqRef = useRef(0);
  const recvSeqRef = useRef(0);
  const handshakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const moveTo = (next: ChatPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  function teardown(): void {
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
    handshakeTimerRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    void signalingRef.current?.leave();
    signalingRef.current = null;
    keyRef.current = null;
    ephemeralRef.current = null;
  }

  // Never leave the peer/signaling dangling if the view unmounts mid-session.
  useEffect(() => {
    return () => {
      if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
      peerRef.current?.close();
      peerRef.current = null;
      void signalingRef.current?.leave();
      signalingRef.current = null;
    };
  }, []);

  function fail(e: unknown): void {
    setError(toChatErrorCode(e));
    moveTo('error');
    teardown();
  }

  /** Generate ephemeral keys and get the wallet's proof over the challenge. */
  async function prepareIdentity(
    role: PeerRole,
    roomId: string,
  ): Promise<HandshakeMessage> {
    if (activeNetworkId == null) throw new Error('wallet_rejected');
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) throw new Error('wallet_rejected');

    const ephemeral = await generateEphemeralKeys();
    ephemeralRef.current = ephemeral;
    const challenge = deriveChatChallenge(
      buildChatChallengePayload({
        roomId,
        role,
        ecdhPubHash: ephemeral.pubHashHex,
        networkId: activeNetworkId,
      }),
    );
    const proof = await requestAccountProof(rdt, challenge);
    if (proof.curve !== 'curve25519') throw new Error('secp256k1');

    return {
      t: 'handshake',
      v: 1,
      role,
      account: proof.account,
      publicKey: proof.publicKey,
      curve: proof.curve,
      signature: proof.signature,
      ecdhPubB64: ephemeral.pubB64,
      networkId: activeNetworkId,
    };
  }

  async function handlePeerHandshake(handshake: HandshakeMessage): Promise<void> {
    if (keyRef.current) return; // already established — ignore duplicates
    const roomId = roomIdRef.current;
    const ephemeral = ephemeralRef.current;
    if (!roomId || !ephemeral || activeNetworkId == null) return;

    const myRole = roleRef.current;
    const verified = await verifyPeerHandshake(handshake, {
      roomId,
      expectedRole: myRole === 'host' ? 'guest' : 'host',
      networkId: activeNetworkId,
      dAppDefinitionAddress: NETWORKS[activeNetworkId].dAppDefinitionAddress,
      origin: window.location.origin,
    });

    keyRef.current = await deriveChatKey(
      ephemeral.privateKey,
      base64ToBytes(handshake.ecdhPubB64),
      {
        roomId,
        hostPubB64: myRole === 'host' ? ephemeral.pubB64 : handshake.ecdhPubB64,
        guestPubB64: myRole === 'guest' ? ephemeral.pubB64 : handshake.ecdhPubB64,
      },
    );
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
    handshakeTimerRef.current = null;
    setPeerIdentity(verified);
    moveTo('secure');
  }

  async function handleEncryptedMessage(
    message: Extract<ChatWireMessage, { t: 'msg' }>,
  ): Promise<void> {
    const key = keyRef.current;
    if (!key) throw new Error('message_rejected');
    // Strictly sequential per direction: anything else is replay/drop.
    if (message.seq !== recvSeqRef.current) throw new Error('message_rejected');
    const peerRole = roleRef.current === 'host' ? 'guest' : 'host';
    const plain = await decryptChatMessage(
      key,
      peerRole,
      message.seq,
      message.ivB64,
      message.ctB64,
    );
    recvSeqRef.current += 1;
    setMessages((current) => [
      ...current,
      {
        id: `r-${message.seq}`,
        direction: 'received',
        text: plain.text,
        at: plain.at,
      },
    ]);
  }

  const wireHandlers: PeerHandlers<ChatWireMessage> = {
    onMessage(message) {
      void (async () => {
        try {
          if (message.t === 'handshake') {
            await handlePeerHandshake(message);
          } else if (message.t === 'msg') {
            await handleEncryptedMessage(message);
          } else if (message.t === 'bye') {
            teardown();
            moveTo('closed');
          }
        } catch (e) {
          fail(e);
        }
      })();
    },
    onBinary: () => undefined,
    onClose() {
      const current = phaseRef.current;
      if (current === 'closed' || current === 'error' || current === 'idle') return;
      if (current === 'secure') {
        teardown();
        moveTo('closed');
      } else {
        fail(new Error('peer_disconnected'));
      }
    },
  };

  function armHandshakeTimeout(): void {
    handshakeTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'handshaking') {
        fail(new Error('peer_verification_failed'));
      }
    }, HANDSHAKE_TIMEOUT_MS);
  }

  /** Host: sign, open a room and wait for the guest. */
  async function start(): Promise<void> {
    setError(null);
    try {
      moveTo('signing');
      const roomId = randomRoomId();
      roomIdRef.current = roomId;
      roleRef.current = 'host';
      const myHandshake = await prepareIdentity('host', roomId);

      moveTo('creating');
      setShareUrl(buildShareUrl({ r: roomId }));
      const signaling = await createSignaling(roomId);
      signalingRef.current = signaling;

      moveTo('waiting');
      const peer = await connectAsHost<ChatWireMessage>(signaling, wireHandlers);
      peerRef.current = peer;
      peer.sendMessage(myHandshake);
      moveTo('handshaking');
      armHandshakeTimeout();
    } catch (e) {
      fail(e);
    }
  }

  /** Guest: sign, join the room from the share URL. */
  async function join(roomId: string): Promise<void> {
    setError(null);
    try {
      moveTo('signing');
      roomIdRef.current = roomId;
      roleRef.current = 'guest';
      const myHandshake = await prepareIdentity('guest', roomId);

      moveTo('connecting');
      const signaling = await createSignaling(roomId);
      signalingRef.current = signaling;
      const peer = await connectAsGuest<ChatWireMessage>(signaling, wireHandlers);
      peerRef.current = peer;
      peer.sendMessage(myHandshake);
      moveTo('handshaking');
      armHandshakeTimeout();
    } catch (e) {
      fail(e);
    }
  }

  /** Encrypt and send one message; appends it locally on success. */
  async function send(text: string): Promise<void> {
    const peer = peerRef.current;
    const key = keyRef.current;
    const trimmed = text.trim();
    if (!peer || !key || !trimmed || phaseRef.current !== 'secure') return;
    const body = trimmed.slice(0, MAX_MESSAGE_CHARS);
    try {
      const seq = sendSeqRef.current;
      const at = Date.now();
      const wire = await encryptChatMessage(key, roleRef.current, seq, {
        text: body,
        at,
      });
      peer.sendMessage({ t: 'msg', seq, ivB64: wire.ivB64, ctB64: wire.ctB64 });
      sendSeqRef.current += 1;
      setMessages((current) => [
        ...current,
        { id: `s-${seq}`, direction: 'sent', text: body, at },
      ]);
    } catch (e) {
      fail(e);
    }
  }

  /** Politely end the conversation. */
  function leave(): void {
    peerRef.current?.sendMessage({ t: 'bye' });
    teardown();
    moveTo('closed');
  }

  return {
    phase,
    messages,
    peerIdentity,
    shareUrl,
    error,
    start,
    join,
    send,
    leave,
  };
}
