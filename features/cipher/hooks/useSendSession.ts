'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CipherErrorCode,
  DataChannelMessage,
} from '../types/cipher.types';
import type { EncryptResult } from './useEncryptFlow';
import { verifyLedgerAuthorization } from '../lib/authorize';
import { encryptedChunkRange, encryptedDataSize } from '../lib/container';
import { toCipherErrorCode } from '../lib/errors';
import { getChunk, getFileMeta } from '../lib/idb';
import { toHex } from '../lib/keys';
import { createSignaling, type CipherSignaling } from '@/features/p2p/lib/signaling';
import { bytesToBase64, sendEncryptedFile } from '../lib/transfer';
import { connectAsHost, type CipherPeer } from '../lib/peer';
import { buildSessionUrl, randomRoomId } from '../lib/session-url';
import { useCipherKey } from './useCipherKey';

export type SendPhase =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'transferring'
  | 'reconnecting'
  | 'transferred'
  | 'approving'
  | 'keySent'
  | 'error';

export interface IncomingDecryptRequest {
  requesterName: string;
  /** ROLA + Ledger: the requester's proven account, invite verified on-ledger. */
  requesterAccount?: string;
  ledgerVerified?: boolean;
}

/** How long to wait for the receiver's `hello` before assuming it has nothing. */
const HELLO_WAIT_MS = 5_000;

/** How long to wait for the receiver's receipt before moving on regardless. */
const RECEIPT_WAIT_MS = 30_000;

/** Backoff between re-arming the room after a lost round. */
const RETRY_BASE_MS = 800;
const RETRY_MAX_MS = 6_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flow A, sender side (host): share a freshly encrypted file over WebRTC,
 * then approve (sign) or reject the receiver's decrypt request. The derived
 * file key — never the ROLA signature — is released over the DTLS channel.
 *
 * The room is SERVED IN ROUNDS, like the signing channel: losing the peer ends
 * a round, not the session. The room is re-armed under the same share URL and
 * the receiver — which keeps the chunks it already stored — reconnects and
 * says how far it got, so the file continues from there. Nothing but the user
 * cancelling, or the key being released, ends the loop.
 */
export function useSendSession() {
  const { requestKey } = useCipherKey();
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [request, setRequest] = useState<IncomingDecryptRequest | null>(null);
  const [error, setError] = useState<CipherErrorCode | null>(null);

  const peerRef = useRef<CipherPeer | null>(null);
  const signalingRef = useRef<CipherSignaling | null>(null);
  const resultRef = useRef<EncryptResult | null>(null);
  const headB64Ref = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const phaseRef = useRef<SendPhase>('idle');
  /** Set by reset()/unmount: stops the serve loop for good. */
  const cancelledRef = useRef(false);
  /** A peer has connected at least once — later waits are RE-connections. */
  const everConnectedRef = useRef(false);
  // Resolved when the receiver acknowledges (`receipt`) that every chunk landed
  // in its store — the truthful "transfer complete" signal.
  const receiptRef = useRef<(() => void) | null>(null);
  /** Resolved by the receiver's `hello`, which carries its resume point. */
  const helloRef = useRef<((haveChunks: number) => void) | null>(null);
  /** Rejects the round in flight the moment the channel drops. */
  const roundLostRef = useRef<(() => void) | null>(null);

  const moveTo = (next: SendPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  /** Read through a call so the serve loop isn't narrowed by past moveTo()s. */
  const phaseNow = (): SendPhase => phaseRef.current;

  // Never leave the peer/signaling dangling if the view unmounts mid-session.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      // Release the serve loop: closing our own peer raises no `onclose`.
      roundLostRef.current?.();
      peerRef.current?.close();
      peerRef.current = null;
      void signalingRef.current?.leave();
      signalingRef.current = null;
    };
  }, []);

  function handleMessage(message: DataChannelMessage) {
    if (message.t === 'hello') {
      helloRef.current?.(Math.max(0, message.haveChunks ?? 0));
      helloRef.current = null;
    } else if (message.t === 'decrypt-request') {
      // The request must reference the exact container shared in this
      // session — anything else is a substitution attempt.
      if (message.headB64 !== headB64Ref.current) {
        peerRef.current?.sendMessage({ t: 'decrypt-denied', reason: 'header_mismatch' });
        return;
      }
      const header = resultRef.current?.header;
      if (header?.access === 'rola-ledger') {
        // ROLA + Ledger: the requester must prove an invited account before
        // the request is even shown for approval.
        const proof = message.proof;
        const roomId = roomIdRef.current;
        if (!proof || !header.inviteCollection || !roomId) {
          peerRef.current?.sendMessage({ t: 'decrypt-denied', reason: 'not_authorized' });
          return;
        }
        void (async () => {
          const authorized = await verifyLedgerAuthorization({
            networkId: header.networkId,
            headerHash: resultRef.current!.headerHash,
            roomId,
            account: proof.account,
            senderAccount: header.senderAccount,
            collection: header.inviteCollection!,
            proof,
          });
          if (!authorized) {
            peerRef.current?.sendMessage({ t: 'decrypt-denied', reason: 'not_authorized' });
            return;
          }
          setRequest({
            requesterName: message.requesterName,
            requesterAccount: proof.account,
            ledgerVerified: true,
          });
        })();
        return;
      }
      setRequest({ requesterName: message.requesterName });
    } else if (message.t === 'receipt') {
      receiptRef.current?.();
      receiptRef.current = null;
    } else if (message.t === 'bye') {
      // The receiver left on purpose: end the round, and the loop stops
      // re-arming only once the key has been released.
      roundLostRef.current?.();
    }
  }

  function dropPeer(): void {
    peerRef.current?.close();
    peerRef.current = null;
    void signalingRef.current?.leave();
    signalingRef.current = null;
  }

  /**
   * One round: arm the room, serve whatever the receiver still needs, then
   * stay connected for the key exchange. Rejects as soon as the peer is gone.
   */
  async function serveOnce(
    roomId: string,
    headBytes: Uint8Array,
    chunkCount: number,
    totalBytes: number,
  ): Promise<void> {
    const result = resultRef.current!;
    let lost = false;
    // Bound to THIS round: a stale peer closing later can only end its own.
    let loseRound: () => void = () => undefined;
    const peerLost = new Promise<never>((_, reject) => {
      loseRound = () => {
        if (lost) return;
        lost = true;
        reject(new Error('peer_disconnected'));
      };
    });
    roundLostRef.current = loseRound;
    // Nothing below may leave an unhandled rejection behind when the round
    // ends normally and the peer drops afterwards.
    peerLost.catch(() => undefined);

    const signaling = await createSignaling(roomId);
    if (cancelledRef.current) {
      void signaling.leave();
      return;
    }
    signalingRef.current = signaling;

    const peer = await connectAsHost(signaling, {
      onMessage: handleMessage,
      onBinary: () => undefined,
      onClose: () => loseRound(),
    });
    if (cancelledRef.current) {
      peer.close();
      return;
    }
    peerRef.current = peer;
    everConnectedRef.current = true;
    setRequest(null);

    // Ask where to resume from. An old receiver never answers — the timeout
    // then means "it has nothing", i.e. send the whole file.
    const hello = new Promise<number>((resolve) => {
      helloRef.current = resolve;
    });
    peer.sendMessage({ t: 'hello', v: 1, role: 'sender' });
    const startIndex = Math.min(
      chunkCount,
      Math.max(
        0,
        await Promise.race([
          hello,
          delay(HELLO_WAIT_MS).then(() => 0),
          peerLost,
        ]),
      ),
    );

    if (startIndex < chunkCount) {
      moveTo('transferring');
      const bytesBefore = encryptedChunkRange(result.header, 0, startIndex).start;
      setProgress(totalBytes > 0 ? Math.min(0.99, bytesBefore / totalBytes) : 0);
      // Arm the receipt wait BEFORE the last frames go out, so a fast receiver
      // can't ack before we are listening.
      const receipt = new Promise<void>((resolve) => {
        receiptRef.current = resolve;
      });
      await Promise.race([
        sendEncryptedFile(peer, headBytes, chunkCount, (index) => getChunk(result.fileId, index), {
          startIndex,
          bytesBefore,
          totalBytes,
          onProgress: setProgress,
        }),
        peerLost,
      ]);
      // The bytes are only queued until the buffer drains; wait for that, then
      // for the receiver's receipt, before claiming the transfer is complete.
      await Promise.race([peer.flush(), peerLost]);
      setProgress(1);
      await Promise.race([
        receipt,
        delay(RECEIPT_WAIT_MS),
        peerLost,
      ]);
    } else {
      setProgress(1);
    }

    moveTo('transferred');
    // The file is there; stay connected so the receiver can ask for the key.
    // Resolves only when the peer goes away — the loop then re-arms unless the
    // key has already been released.
    await peerLost;
  }

  async function open(result: EncryptResult): Promise<void> {
    resultRef.current = result;
    cancelledRef.current = false;
    everConnectedRef.current = false;
    setError(null);
    setRequest(null);
    setProgress(0);
    moveTo('creating');

    let headBytes: Uint8Array;
    let chunkCount: number;
    const roomId = randomRoomId();
    try {
      roomIdRef.current = roomId;
      setShareUrl(buildSessionUrl('receive', roomId));
      const meta = await getFileMeta(result.fileId);
      if (!meta) throw new Error('unknown');
      headBytes = new Uint8Array(await meta.headBytes.arrayBuffer());
      headB64Ref.current = bytesToBase64(headBytes);
      chunkCount = meta.chunkCount;
    } catch (e) {
      setError(toCipherErrorCode(e));
      moveTo('error');
      return;
    }

    const totalBytes = encryptedDataSize(result.header);
    let failures = 0;
    while (!cancelledRef.current && phaseNow() !== 'keySent') {
      moveTo(everConnectedRef.current ? 'reconnecting' : 'waiting');
      try {
        await serveOnce(roomId, headBytes, chunkCount, totalBytes);
        failures = 0;
      } catch (e) {
        const code = toCipherErrorCode(e);
        // A lost peer is a lost ROUND: the link stays valid and the receiver
        // resumes. Anything else (unreadable file, storage) is terminal.
        if (code !== 'peer_disconnected' && code !== 'webrtc_failed' && code !== 'signaling_unavailable') {
          setError(code);
          moveTo('error');
          dropPeer();
          return;
        }
        failures += 1;
      } finally {
        roundLostRef.current = null;
        helloRef.current = null;
        receiptRef.current = null;
      }
      if (cancelledRef.current || phaseNow() === 'keySent') break;
      dropPeer();
      await delay(Math.min(RETRY_BASE_MS * Math.max(1, failures), RETRY_MAX_MS));
    }
  }

  /** User clicked "Approve & sign": re-derive the key and release it. */
  async function approve(): Promise<void> {
    const result = resultRef.current;
    const peer = peerRef.current;
    if (!result || !peer || !request) return;
    moveTo('approving');
    setError(null);
    try {
      const grant = await requestKey(result.header.fileSalt);
      if (grant.account !== result.header.senderAccount) {
        peer.sendMessage({ t: 'decrypt-denied', reason: 'account_mismatch' });
        throw new Error('account_mismatch');
      }
      peer.sendMessage({
        t: 'decrypt-approved',
        fileKeyHex: toHex(grant.keyBits),
      });
      moveTo('keySent');
    } catch (e) {
      const code = toCipherErrorCode(e);
      if (code !== 'account_mismatch') {
        peer.sendMessage({ t: 'decrypt-denied', reason: 'wallet_error' });
      }
      setError(code);
      moveTo('transferred');
    }
  }

  function deny(): void {
    peerRef.current?.sendMessage({ t: 'decrypt-denied', reason: 'rejected' });
    setRequest(null);
  }

  function close(): void {
    cancelledRef.current = true;
    roundLostRef.current?.();
    dropPeer();
  }

  function reset(): void {
    peerRef.current?.sendMessage({ t: 'bye' });
    close();
    resultRef.current = null;
    headB64Ref.current = null;
    setShareUrl(null);
    setRequest(null);
    setProgress(0);
    setError(null);
    moveTo('idle');
  }

  /** True while leaving the page would strand the connected receiver. */
  const sessionActive =
    phase === 'waiting' ||
    phase === 'transferring' ||
    phase === 'reconnecting' ||
    phase === 'transferred' ||
    phase === 'approving';

  return {
    phase,
    shareUrl,
    progress,
    request,
    error,
    sessionActive,
    open,
    approve,
    deny,
    reset,
  };
}
