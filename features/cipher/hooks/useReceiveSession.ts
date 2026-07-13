'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadBytes } from '@/features/sign/lib/certificate';
import type {
  CipherErrorCode,
  ContainerHead,
  DataChannelMessage,
  DenyReason,
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
import { base64ToBytes, createChunkAssembler } from '../lib/transfer';
import { connectAsGuest, type CipherPeer } from '../lib/peer';

export type ReceivePhase =
  | 'connecting'
  | 'receiving'
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
};

/**
 * Flow A, receiver side (guest): open the share URL, receive the encrypted
 * container into IndexedDB chunk by chunk, then ask the sender to release the
 * key and decrypt locally. The plaintext never exists outside this browser.
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
  const encryptedNameRef = useRef<string>('file.radixenc');
  const phaseRef = useRef<ReceivePhase>('connecting');

  useEffect(() => {
    let cancelled = false;
    const assembler = createChunkAssembler();
    let received = 0;

    const moveTo = (next: ReceivePhase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    const fail = (e: unknown) => {
      setError(toCipherErrorCode(e));
      moveTo('error');
      peerRef.current?.close();
    };

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

    const handlePeerClose = () => {
      const current = phaseRef.current;
      if (current === 'done' || current === 'denied' || current === 'error') return;
      // Once the file is fully here the sender may close; only the key
      // request truly needs them online.
      if (current === 'received') return;
      setError('peer_disconnected');
      moveTo('error');
    };

    const handleMessage = (message: DataChannelMessage) => {
      void (async () => {
        try {
          if (message.t === 'meta') {
            const headBytes = base64ToBytes(message.headB64);
            const parsed = parseContainerHeadBytes(headBytes);
            // Refuse up front if the browser can't hold the ciphertext.
            const estimate = await navigator.storage?.estimate?.().catch(() => null);
            if (estimate?.quota != null && estimate.usage != null) {
              const needed = encryptedDataSize(parsed.header) * 1.1;
              if (estimate.quota - estimate.usage < needed) {
                throw new Error('storage_quota');
              }
            }
            const fileId = newFileId();
            fileIdRef.current = fileId;
            headRef.current = parsed;
            headB64Ref.current = message.headB64;
            encryptedNameRef.current = `${parsed.header.fileName}.radixenc`;
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
            setHead(parsed);
            setProgress(0);
            moveTo('receiving');
          } else if (message.t === 'chunk-start') {
            assembler.start(message.index, message.byteLength);
          } else if (message.t === 'transfer-complete') {
            const fileId = fileIdRef.current;
            const expected = headRef.current?.header.chunkCount ?? 0;
            if (!fileId || received !== expected) {
              throw new Error('peer_disconnected');
            }
            await updateFileMeta(fileId, {
              complete: true,
              receivedChunks: received,
            });
            peerRef.current?.sendMessage({ t: 'receipt', receivedChunks: received });
            moveTo('received');
          } else if (message.t === 'decrypt-approved') {
            await decryptWithKey(message.fileKeyHex);
          } else if (message.t === 'decrypt-denied') {
            setDenyReason(message.reason);
            setError(
              message.reason === 'rejected' ? null : DENY_TO_ERROR[message.reason],
            );
            moveTo('denied');
          } else if (message.t === 'bye') {
            handlePeerClose();
          }
        } catch (e) {
          fail(e);
        }
      })();
    };

    const handleBinary = (bytes: ArrayBuffer) => {
      void (async () => {
        try {
          const chunk = assembler.push(bytes);
          if (!chunk || !fileIdRef.current || !headRef.current) return;
          await putChunk(fileIdRef.current, chunk.index, chunk.blob);
          received += 1;
          setProgress(received / headRef.current.header.chunkCount);
        } catch (e) {
          fail(e);
        }
      })();
    };

    // Micro-delay so a dev StrictMode double-mount doesn't join the room
    // twice (the host pairs with the first joiner it sees).
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const signaling = await createSignaling(roomId);
          if (cancelled) {
            void signaling.leave();
            return;
          }
          signalingRef.current = signaling;
          const peer = await connectAsGuest(signaling, {
            onMessage: handleMessage,
            onBinary: handleBinary,
            onClose: handlePeerClose,
          });
          if (cancelled) {
            peer.close();
            return;
          }
          peerRef.current = peer;
        } catch (e) {
          if (!cancelled) fail(e);
        }
      })();
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
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

  /** Ask the sender to sign; name is shown in their approval card. */
  function requestDecrypt(requesterName: string): void {
    const peer = peerRef.current;
    const headB64 = headB64Ref.current;
    if (!peer || !headB64) return;
    peer.sendMessage({ t: 'decrypt-request', requesterName, headB64 });
    setDenyReason(null);
    setError(null);
    phaseRef.current = 'waitingApproval';
    setPhase('waitingApproval');
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
