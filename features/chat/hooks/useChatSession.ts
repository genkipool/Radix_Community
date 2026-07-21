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
import {
  assembleContainerBlob,
  cleanupExpired,
  deleteFile,
  newFileId,
  putChunk,
  putFileMeta,
  updateFileMeta,
} from '@/features/cipher/lib/idb';
import {
  FILE_FRAME_BYTES,
  FILE_SPILL_BYTES,
  MAX_MESSAGE_CHARS,
} from '../constants/chat';
import type {
  ChatErrorCode,
  ChatFileMeta,
  ChatFileState,
  ChatMessage,
  ChatPhase,
  ChatWireMessage,
  VerifiedPeer,
} from '../types/chat.types';
import {
  decryptChatMessage,
  decryptFileChunk,
  decryptFileMeta,
  encryptChatMessage,
  encryptFileChunk,
  encryptFileMeta,
} from '../lib/chatCrypto';
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

/** Receiver-side assembly of the file currently coming in. Decrypted frames
 *  buffer in memory up to FILE_SPILL_BYTES and are then flushed to IndexedDB
 *  (the cipher store, 24 h retention), so memory stays flat at any size. */
interface IncomingFile {
  seq: number;
  meta: ChatFileMeta;
  messageId: string;
  /** IndexedDB file id holding the flushed chunks. */
  fileId: string;
  buffer: Uint8Array[];
  buffered: number;
  flushed: number;
  received: number;
  index: number;
}

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
  const [sendingFile, setSendingFile] = useState(false);

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
  const sendingFileRef = useRef(false);
  // Flipped by cancelSendFile(); the outgoing loop checks it between frames.
  const cancelSendRef = useRef(false);
  const incomingFileRef = useRef<IncomingFile | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  // Incoming wire events run through ONE promise chain: the async handlers
  // (decrypt, assembly) must process in arrival order, or file frames could
  // outrun their announcement and AAD indices would misalign.
  const wireQueueRef = useRef<Promise<void>>(Promise.resolve());

  const moveTo = (next: ChatPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  /** Patch the attachment state of one entry (progress, completion, URL). */
  function updateFile(messageId: string, patch: Partial<ChatFileState>): void {
    setMessages((current) =>
      current.map((m) =>
        m.id === messageId && m.file ? { ...m, file: { ...m.file, ...patch } } : m,
      ),
    );
  }

  function trackObjectUrl(blob: Blob | File): string {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    return url;
  }

  function teardown(): void {
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
    handshakeTimerRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    void signalingRef.current?.leave();
    signalingRef.current = null;
    keyRef.current = null;
    ephemeralRef.current = null;
    // A transfer cannot survive the session: mark whatever was in flight and
    // drop its partial local copy.
    const incoming = incomingFileRef.current;
    incomingFileRef.current = null;
    if (incoming) void deleteFile(incoming.fileId).catch(() => undefined);
    setMessages((current) =>
      current.map((m) =>
        m.file?.status === 'transferring'
          ? { ...m, file: { ...m.file, status: 'error' } }
          : m,
      ),
    );
  }

  // Never leave the peer/signaling dangling if the view unmounts mid-session.
  // Local copies of past attachments expire after 24 h (shared cipher store).
  useEffect(() => {
    void cleanupExpired().catch(() => undefined);
    const urls = objectUrlsRef.current;
    return () => {
      if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
      peerRef.current?.close();
      peerRef.current = null;
      void signalingRef.current?.leave();
      signalingRef.current = null;
      const incoming = incomingFileRef.current;
      incomingFileRef.current = null;
      if (incoming) void deleteFile(incoming.fileId).catch(() => undefined);
      for (const url of urls) URL.revokeObjectURL(url);
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

  async function handleFileAnnouncement(
    message: Extract<ChatWireMessage, { t: 'file' }>,
  ): Promise<void> {
    const key = keyRef.current;
    if (!key) throw new Error('message_rejected');
    if (message.seq !== recvSeqRef.current) throw new Error('message_rejected');
    // One incoming file at a time: a second announcement mid-transfer is a
    // protocol violation.
    if (incomingFileRef.current) throw new Error('message_rejected');
    const peerRole = roleRef.current === 'host' ? 'guest' : 'host';
    const meta = await decryptFileMeta(
      key,
      peerRole,
      message.seq,
      message.ivB64,
      message.ctB64,
    );
    // No fixed size limit: the only bound is the browser's storage quota,
    // checked up front so a too-big file fails before any bytes flow.
    const estimate = await navigator.storage?.estimate?.().catch(() => null);
    if (estimate?.quota != null && estimate.usage != null) {
      if (estimate.quota - estimate.usage < meta.size * 1.05) {
        throw new Error('storage_quota');
      }
    }
    recvSeqRef.current += 1;

    const messageId = `r-${message.seq}`;
    const empty = meta.size === 0;
    setMessages((current) => [
      ...current,
      {
        id: messageId,
        direction: 'received',
        text: '',
        at: meta.at,
        file: {
          name: meta.name,
          mime: meta.mime,
          size: meta.size,
          progress: empty ? 1 : 0,
          status: empty ? 'done' : 'transferring',
          url: empty
            ? trackObjectUrl(new Blob([], { type: meta.mime }))
            : undefined,
        },
      },
    ]);
    if (!empty) {
      const fileId = newFileId();
      await putFileMeta({
        id: fileId,
        kind: 'chat',
        fileName: meta.name,
        encryptedName: meta.name,
        headBytes: new Blob([]),
        headerHash: '',
        chunkCount: 0,
        receivedChunks: 0,
        complete: false,
        createdAt: Date.now(),
      });
      incomingFileRef.current = {
        seq: message.seq,
        meta,
        messageId,
        fileId,
        buffer: [],
        buffered: 0,
        flushed: 0,
        received: 0,
        index: 0,
      };
    }
  }

  /** Persist the buffered frames as one IndexedDB chunk record. */
  async function flushIncoming(incoming: IncomingFile): Promise<void> {
    if (incoming.buffered === 0) return;
    await putChunk(
      incoming.fileId,
      incoming.flushed,
      new Blob(incoming.buffer as BlobPart[]),
    );
    incoming.flushed += 1;
    incoming.buffer = [];
    incoming.buffered = 0;
  }

  async function handleFileFrame(bytes: ArrayBuffer): Promise<void> {
    const incoming = incomingFileRef.current;
    const key = keyRef.current;
    // Stray frames (no announced file) are dropped, like unknown messages.
    if (!incoming || !key) return;
    const peerRole = roleRef.current === 'host' ? 'guest' : 'host';
    const plain = await decryptFileChunk(
      key,
      peerRole,
      incoming.seq,
      incoming.index,
      new Uint8Array(bytes),
    );
    incoming.index += 1;
    incoming.buffer.push(plain);
    incoming.buffered += plain.byteLength;
    incoming.received += plain.byteLength;
    if (incoming.received > incoming.meta.size) {
      throw new Error('message_rejected');
    }
    if (incoming.received === incoming.meta.size) {
      await flushIncoming(incoming);
      await updateFileMeta(incoming.fileId, {
        chunkCount: incoming.flushed,
        receivedChunks: incoming.flushed,
        complete: true,
      });
      incomingFileRef.current = null;
      // Disk-backed Blob over the stored chunks; wrapping restores the mime.
      const blob = new Blob([await assembleContainerBlob(incoming.fileId)], {
        type: incoming.meta.mime || 'application/octet-stream',
      });
      updateFile(incoming.messageId, {
        progress: 1,
        status: 'done',
        url: trackObjectUrl(blob),
      });
      return;
    }
    if (incoming.buffered >= FILE_SPILL_BYTES) await flushIncoming(incoming);
    const progress = incoming.received / incoming.meta.size;
    // Throttle re-renders to whole-percent steps.
    if (
      Math.floor(progress * 100) >
      Math.floor(((incoming.received - plain.byteLength) / incoming.meta.size) * 100)
    ) {
      updateFile(incoming.messageId, { progress });
    }
  }

  /** The peer aborted the file it was sending: drop the partial local copy and
   *  mark the entry canceled (the log stays; only this transfer ends). */
  function handleFileCancel(): void {
    const incoming = incomingFileRef.current;
    if (!incoming) return;
    incomingFileRef.current = null;
    void deleteFile(incoming.fileId).catch(() => undefined);
    updateFile(incoming.messageId, { status: 'canceled' });
  }

  /** Serialize incoming wire work; failures close the room via `fail`. */
  function enqueueWire(task: () => void | Promise<void>): void {
    wireQueueRef.current = wireQueueRef.current
      .then(() => {
        const current = phaseRef.current;
        if (current === 'error' || current === 'closed') return;
        return task();
      })
      .catch(fail);
  }

  const wireHandlers: PeerHandlers<ChatWireMessage> = {
    onMessage(message) {
      enqueueWire(async () => {
        if (message.t === 'handshake') {
          await handlePeerHandshake(message);
        } else if (message.t === 'msg') {
          await handleEncryptedMessage(message);
        } else if (message.t === 'file') {
          await handleFileAnnouncement(message);
        } else if (message.t === 'file-cancel') {
          handleFileCancel();
        } else if (message.t === 'bye') {
          teardown();
          moveTo('closed');
        }
      });
    },
    onBinary(bytes) {
      enqueueWire(() => handleFileFrame(bytes));
    },
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

  /**
   * Encrypt and stream one file: an announcement message (the metadata,
   * AES-GCM like any text message) followed by encrypted 64 KiB frames.
   * One outgoing file at a time; text can interleave freely.
   */
  async function sendFile(file: File): Promise<void> {
    const peer = peerRef.current;
    const key = keyRef.current;
    if (!peer || !key || phaseRef.current !== 'secure') return;
    if (sendingFileRef.current) return;
    sendingFileRef.current = true;
    cancelSendRef.current = false;
    setSendingFile(true);
    const seq = sendSeqRef.current;
    const messageId = `s-${seq}`;
    try {
      const at = Date.now();
      const meta: ChatFileMeta = {
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        at,
      };
      const wire = await encryptFileMeta(key, roleRef.current, seq, meta);
      peer.sendMessage({ t: 'file', seq, ivB64: wire.ivB64, ctB64: wire.ctB64 });
      sendSeqRef.current += 1;
      setMessages((current) => [
        ...current,
        {
          id: messageId,
          direction: 'sent',
          text: '',
          at,
          file: {
            name: meta.name,
            mime: meta.mime,
            size: meta.size,
            progress: file.size === 0 ? 1 : 0,
            status: file.size === 0 ? 'done' : 'transferring',
            url: trackObjectUrl(file),
          },
        },
      ]);

      let sent = 0;
      let index = 0;
      let lastPct = 0;
      while (sent < file.size) {
        if (cancelSendRef.current) {
          // Tell the peer to drop its partial, mark ours canceled, and stop.
          peer.sendMessage({ t: 'file-cancel', seq });
          updateFile(messageId, { status: 'canceled' });
          return;
        }
        const slice = file.slice(sent, sent + FILE_FRAME_BYTES);
        const frame = await encryptFileChunk(
          key,
          roleRef.current,
          seq,
          index,
          new Uint8Array(await slice.arrayBuffer()),
        );
        await peer.sendBinary(frame.buffer as ArrayBuffer);
        sent += slice.size;
        index += 1;
        // Cap below 100% until the buffer flushes, so the bar is truthful.
        const pct = Math.floor((sent / file.size) * 100);
        if (pct > lastPct) {
          lastPct = pct;
          updateFile(messageId, { progress: Math.min(sent / file.size, 0.99) });
        }
      }
      await peer.flush();
      updateFile(messageId, { progress: 1, status: 'done' });
    } catch (e) {
      updateFile(messageId, { status: 'error' });
      // If the peer politely left mid-transfer the room is already closed;
      // only surface a session error while the room was still live.
      if (phaseRef.current === 'secure') fail(e);
    } finally {
      sendingFileRef.current = false;
      setSendingFile(false);
    }
  }

  /** Request cancellation of the file currently being sent (if any). The send
   *  loop notices between frames, tells the peer, and stops. */
  function cancelSendFile(): void {
    if (sendingFileRef.current) cancelSendRef.current = true;
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
    sendingFile,
    start,
    join,
    send,
    sendFile,
    cancelSendFile,
    leave,
  };
}
