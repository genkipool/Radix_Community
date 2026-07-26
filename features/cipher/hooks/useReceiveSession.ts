'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadBytes } from '@/features/sign/lib/certificate';
import type {
  CipherErrorCode,
  ContainerHead,
  DataChannelMessage,
  DenyReason,
  UnlockProof,
} from '../types/cipher.types';
import { encryptedDataSize, parseContainerHeadBytes } from '../lib/container';
import { createBlobSink, decryptContainer } from '../lib/decrypt';
import { toCipherErrorCode } from '../lib/errors';
import {
  assembleContainerBlob,
  deleteFile,
  newFileId,
  putChunk,
  putFileMeta,
  updateFileMeta,
} from '../lib/idb';
import { hexToBytes } from '../lib/keys';
import { createSignaling, type CipherSignaling } from '@/features/p2p/lib/signaling';
import {
  base64ToBytes,
  createReceiveTransfer,
  type TransferStore,
} from '../lib/transfer';
import { connectAsGuest, type CipherPeer } from '../lib/peer';

export type ReceivePhase =
  | 'connecting'
  | 'receiving'
  | 'reconnecting'
  | 'received'
  | 'waitingApproval'
  | 'decrypting'
  | 'done'
  | 'denied'
  | 'error';

const DENY_TO_ERROR: Record<DenyReason, CipherErrorCode> = {
  rejected: 'unknown',
  wallet_error: 'wallet_rejected',
  account_mismatch: 'account_mismatch',
  header_mismatch: 'header_mismatch',
  origin_mismatch: 'origin_mismatch',
  network_mismatch: 'network_mismatch',
  not_authorized: 'not_authorized',
};

/**
 * Connection attempts before giving up. The sender re-arms its room within a
 * second or two of losing us, so this covers a couple of minutes of a flaky
 * link — and the chunks already stored survive, so a retry is cheap.
 */
const MAX_ATTEMPTS = 24;
const RETRY_BASE_MS = 800;
const RETRY_MAX_MS = 5_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flow A, receiver side (guest): open the share URL, receive the encrypted
 * container into IndexedDB chunk by chunk, then ask the sender to release the
 * key and decrypt locally. The plaintext never exists outside this browser.
 *
 * Losing the channel does NOT lose the transfer: the chunks already written
 * stay in IndexedDB and the session rejoins the same room, telling the sender
 * how many it holds so the file continues from there.
 */
export function useReceiveSession(roomId: string) {
  const [phase, setPhase] = useState<ReceivePhase>('connecting');
  const [head, setHead] = useState<ContainerHead | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<CipherErrorCode | null>(null);
  const [denyReason, setDenyReason] = useState<DenyReason | null>(null);

  const peerRef = useRef<CipherPeer | null>(null);
  const signalingRef = useRef<CipherSignaling | null>(null);
  const fileIdRef = useRef<string | null>(null);
  const headRef = useRef<ContainerHead | null>(null);
  const headB64Ref = useRef<string | null>(null);
  const encryptedNameRef = useRef<string>('file.radixseal.enc');
  const phaseRef = useRef<ReceivePhase>('connecting');
  /** The decrypt request the user already made; re-sent after a reconnect. */
  const pendingRequestRef = useRef<
    { requesterName: string; proof?: UnlockProof } | null
  >(null);
  /** Set once the file is whole, so a reconnect asks for nothing more. */
  const receivedChunksRef = useRef(0);
  const sendRef = useRef<((message: DataChannelMessage) => void) | null>(null);
  /** Re-opens the channel when the session parked but the user still needs it. */
  const restartRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    /** Ends the connection attempt in flight (peer gone / channel closed). */
    let endRound: (() => void) | null = null;
    /** The sender said `bye`: no room to rejoin, so stop retrying. */
    let senderLeft = false;

    const moveTo = (next: ReceivePhase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    const fail = (e: unknown) => {
      if (cancelled) return;
      setError(toCipherErrorCode(e));
      moveTo('error');
      peerRef.current?.close();
      // Release the loop too: closing our own peer raises no `onclose`.
      endRound?.();
    };

    /** Local persistence for the container being received. */
    const store: TransferStore = {
      async begin(parsed, headBytes) {
        // Refuse up front if the browser can't hold the ciphertext.
        const estimate = await navigator.storage?.estimate?.().catch(() => null);
        if (estimate?.quota != null && estimate.usage != null) {
          const needed = encryptedDataSize(parsed.header) * 1.1;
          if (estimate.quota - estimate.usage < needed) {
            throw new Error('storage_quota');
          }
        }
        const fileId = newFileId();
        encryptedNameRef.current = `${parsed.header.fileName}.radixseal.enc`;
        await putFileMeta({
          id: fileId,
          kind: 'received',
          fileName: parsed.header.fileName,
          encryptedName: encryptedNameRef.current,
          headBytes: new Blob([headBytes as Uint8Array<ArrayBuffer>]),
          headerHash: parsed.headerHash,
          chunkCount: parsed.header.chunkCount,
          receivedChunks: 0,
          complete: false,
          createdAt: Date.now(),
        });
        return fileId;
      },
      write: (fileId, index, blob) => putChunk(fileId, index, blob),
      finish: (fileId, chunkCount) =>
        updateFileMeta(fileId, { complete: true, receivedChunks: chunkCount }),
    };

    // ONE state machine for the whole session: it survives reconnects, which
    // is what makes the transfer resumable.
    const transfer = createReceiveTransfer(
      store,
      parseContainerHeadBytes,
      base64ToBytes,
      {
        onHead: (parsed, fileId, headB64) => {
          headRef.current = parsed;
          fileIdRef.current = fileId;
          headB64Ref.current = headB64;
          setHead(parsed);
          if (phaseRef.current !== 'received') moveTo('receiving');
        },
        onProgress: (received, total) => {
          receivedChunksRef.current = received;
          setProgress(total > 0 ? received / total : 0);
        },
        onComplete: () => {
          sendRef.current?.({
            t: 'receipt',
            receivedChunks: receivedChunksRef.current,
          });
          setProgress(1);
          // The user may already be waiting on an approval from an earlier
          // round; don't drag them back to "received".
          if (phaseRef.current !== 'waitingApproval') moveTo('received');
        },
      },
    );

    const decryptWithKey = async (fileKeyHex: string) => {
      const fileId = fileIdRef.current;
      const parsed = headRef.current;
      if (!fileId || !parsed) return;
      moveTo('decrypting');
      setProgress(0);
      const container = await assembleContainerBlob(fileId);
      const sink = createBlobSink(parsed.header.mimeType);
      await decryptContainer(container, hexToBytes(fileKeyHex), sink, setProgress);
      downloadBytes(sink.result(), parsed.header.fileName, parsed.header.mimeType);
      moveTo('done');
    };

    /**
     * Every wire event funnels through ONE promise chain. The handlers do
     * async work (storage estimate, IndexedDB writes), so without this the
     * first chunk frames can outrun the still-persisting `meta` and get
     * dropped, and completion could be judged before the last write settles.
     */
    let queue: Promise<void> = Promise.resolve();
    const enqueue = (task: () => void | Promise<void>) => {
      queue = queue
        .then(() => {
          if (cancelled || phaseRef.current === 'error') return;
          return task();
        })
        .catch((e) => {
          // A short/interrupted transfer is not a failure: drop the round and
          // let the loop reconnect and resume from what we already stored.
          if (e instanceof Error && e.message === 'transfer_incomplete') {
            endRound?.();
            return;
          }
          fail(e);
        });
    };

    const handleMessage = (message: DataChannelMessage) => {
      enqueue(async () => {
        if (await transfer.handleMessage(message)) return;
        if (message.t === 'hello') {
          // The sender says hello on every (re)connection; nothing to do.
          return;
        }
        if (message.t === 'decrypt-approved') {
          await decryptWithKey(message.fileKeyHex);
        } else if (message.t === 'decrypt-denied') {
          pendingRequestRef.current = null;
          setDenyReason(message.reason);
          setError(
            message.reason === 'rejected' ? null : DENY_TO_ERROR[message.reason],
          );
          moveTo('denied');
        } else if (message.t === 'bye') {
          // The sender ended the session on purpose: there is nothing to
          // reconnect to, so stop retrying instead of burning attempts.
          senderLeft = true;
          endRound?.();
        }
      });
    };

    const handleBinary = (bytes: ArrayBuffer) => {
      enqueue(() => transfer.handleBinary(bytes));
    };

    /** One join attempt; resolves when the channel is gone again. */
    const joinOnce = async (): Promise<void> => {
      let ended = false;
      // Bound to THIS round: a stale peer closing later can only end its own.
      let finishRound: () => void = () => undefined;
      const roundOver = new Promise<void>((resolve) => {
        finishRound = () => {
          if (ended) return;
          ended = true;
          resolve();
        };
      });
      endRound = finishRound;

      const signaling = await createSignaling(roomId);
      if (cancelled) {
        void signaling.leave();
        return;
      }
      signalingRef.current = signaling;
      const peer = await connectAsGuest(signaling, {
        onMessage: handleMessage,
        onBinary: handleBinary,
        onClose: () => finishRound(),
      });
      if (cancelled) {
        peer.close();
        return;
      }
      peerRef.current = peer;
      sendRef.current = (message) => peer.sendMessage(message);

      // A fresh channel restarts the frame stream: whatever chunk was half
      // received is re-sent whole.
      transfer.resetPartial();
      peer.sendMessage({
        t: 'hello',
        v: 1,
        role: 'receiver',
        haveChunks: receivedChunksRef.current,
      });
      // Ask again for the key if the link dropped while we were waiting.
      const pending = pendingRequestRef.current;
      if (pending && headB64Ref.current) {
        peer.sendMessage({
          t: 'decrypt-request',
          requesterName: pending.requesterName,
          headB64: headB64Ref.current,
          ...(pending.proof ? { proof: pending.proof } : {}),
        });
      }
      await roundOver;
    };

    /**
     * Keep a channel to the sender for as long as this side still needs one:
     * to finish the file, or to get an answer to a key request. Runs again on
     * demand — a request made minutes after the file landed reconnects instead
     * of talking into a dead channel.
     */
    let running = false;
    const runLoop = async (): Promise<void> => {
      if (running || cancelled) return;
      running = true;
      try {
        let attempt = 0;
        while (attempt < MAX_ATTEMPTS && !cancelled) {
          const before = receivedChunksRef.current;
          try {
            await joinOnce();
          } catch (e) {
            const code = toCipherErrorCode(e);
            // Anything but a connection problem is terminal (bad container,
            // no storage): retrying would fail the same way.
            if (
              code !== 'peer_disconnected' &&
              code !== 'webrtc_failed' &&
              code !== 'room_busy' &&
              code !== 'signaling_unavailable'
            ) {
              fail(e);
              return;
            }
          } finally {
            endRound = null;
            sendRef.current = null;
            peerRef.current?.close();
            peerRef.current = null;
            void signalingRef.current?.leave();
            signalingRef.current = null;
          }
          if (cancelled) return;
          if (
            phaseRef.current === 'done' ||
            phaseRef.current === 'denied' ||
            phaseRef.current === 'error'
          ) {
            return;
          }
          // The file is here and nothing is pending: park instead of burning
          // attempts. requestDecrypt() starts the loop again when needed.
          if (transfer.complete && !pendingRequestRef.current) return;
          if (senderLeft) {
            setError('peer_disconnected');
            moveTo('error');
            return;
          }
          // A round that moved the file forward is progress, not a failure:
          // a long transfer over a flaky link must not run out of attempts.
          attempt = receivedChunksRef.current > before ? 0 : attempt + 1;
          if (phaseRef.current !== 'waitingApproval') moveTo('reconnecting');
          await delay(Math.min(RETRY_BASE_MS * (attempt + 1), RETRY_MAX_MS));
        }
        if (!cancelled) {
          setError('peer_disconnected');
          moveTo('error');
        }
      } finally {
        running = false;
      }
    };
    restartRef.current = () => void runLoop();

    // Micro-delay so a dev StrictMode double-mount doesn't join the room
    // twice (the host pairs with the first joiner it sees).
    const timer = setTimeout(() => void runLoop(), 60);

    return () => {
      cancelled = true;
      restartRef.current = null;
      clearTimeout(timer);
      endRound?.();
      peerRef.current?.close();
      peerRef.current = null;
      void signalingRef.current?.leave();
      signalingRef.current = null;
      const fileId = fileIdRef.current;
      if (fileId && phaseRef.current !== 'received' && phaseRef.current !== 'done') {
        void deleteFile(fileId).catch(() => undefined);
      }
    };
  }, [roomId]);

  /**
   * Ask the sender to sign; name is shown in their approval card. ROLA +
   * Ledger containers also carry the receiver's proof over the session-bound
   * unlock challenge.
   */
  function requestDecrypt(requesterName: string, proof?: UnlockProof): void {
    const headB64 = headB64Ref.current;
    if (!headB64) return;
    pendingRequestRef.current = { requesterName, proof };
    setDenyReason(null);
    setError(null);
    phaseRef.current = 'waitingApproval';
    setPhase('waitingApproval');
    if (peerRef.current) {
      peerRef.current.sendMessage({
        t: 'decrypt-request',
        requesterName,
        headB64,
        ...(proof ? { proof } : {}),
      });
      return;
    }
    // The session parked after the transfer (or the link dropped): reconnect,
    // and the request goes out again as soon as the channel is up.
    restartRef.current?.();
  }

  async function downloadEncrypted(): Promise<void> {
    const fileId = fileIdRef.current;
    if (!fileId) return;
    downloadBytes(await assembleContainerBlob(fileId), encryptedNameRef.current);
  }

  async function deleteLocalCopy(): Promise<void> {
    const fileId = fileIdRef.current;
    if (!fileId) return;
    await deleteFile(fileId).catch(() => undefined);
    fileIdRef.current = null;
  }

  return {
    phase,
    head,
    progress,
    error,
    denyReason,
    requestDecrypt,
    downloadEncrypted,
    deleteLocalCopy,
  };
}
