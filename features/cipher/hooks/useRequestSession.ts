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
import { createBlobSink, decryptContainer } from '../lib/decrypt';
import { toCipherErrorCode } from '../lib/errors';
import { hexToBytes } from '../lib/keys';
import { createSignaling, type CipherSignaling } from '@/features/p2p/lib/signaling';
import { bytesToBase64 } from '../lib/transfer';
import { connectAsHost, type CipherPeer } from '../lib/peer';
import { buildSessionUrl, randomRoomId } from '../lib/session-url';

export type RequestPhase =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'waitingApproval'
  | 'decrypting'
  | 'done'
  | 'denied'
  | 'error';

/**
 * Flow B, receiver side (host): the user already holds a .radixenc file and
 * shares an unlock URL with the original sender. When the sender opens it and
 * signs, the key arrives here and the local file is decrypted in place —
 * the ciphertext itself never travels.
 */
export function useRequestSession() {
  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<CipherErrorCode | null>(null);
  const [denyReason, setDenyReason] = useState<DenyReason | null>(null);

  const peerRef = useRef<CipherPeer | null>(null);
  const signalingRef = useRef<CipherSignaling | null>(null);
  const fileRef = useRef<File | null>(null);
  const headRef = useRef<ContainerHead | null>(null);
  const phaseRef = useRef<RequestPhase>('idle');

  const moveTo = (next: RequestPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  // Never leave the peer/signaling dangling if the view unmounts mid-session.
  useEffect(() => {
    return () => {
      peerRef.current?.close();
      peerRef.current = null;
      void signalingRef.current?.leave();
      signalingRef.current = null;
    };
  }, []);

  function handlePeerClose() {
    const current = phaseRef.current;
    if (current === 'done' || current === 'denied' || current === 'error') return;
    setError('peer_disconnected');
    moveTo('error');
  }

  function handleMessage(message: DataChannelMessage) {
    void (async () => {
      try {
        if (message.t === 'decrypt-approved') {
          const file = fileRef.current;
          const head = headRef.current;
          if (!file || !head) return;
          moveTo('decrypting');
          setProgress(0);
          const sink = createBlobSink(head.header.mimeType);
          await decryptContainer(file, hexToBytes(message.fileKeyHex), sink, setProgress);
          downloadBytes(sink.result(), head.header.fileName, head.header.mimeType);
          moveTo('done');
        } else if (message.t === 'decrypt-denied') {
          setDenyReason(message.reason);
          moveTo('denied');
        } else if (message.t === 'bye') {
          handlePeerClose();
        }
      } catch (e) {
        setError(toCipherErrorCode(e));
        moveTo('error');
      }
    })();
  }

  /**
   * Open the room and send the decrypt request as soon as the sender joins.
   * ROLA + Ledger containers pass `auth`: the pre-signed proof over the
   * unlock challenge (bound to `auth.roomId`, which becomes the session room).
   */
  async function open(
    file: File,
    head: ContainerHead,
    requesterName: string,
    auth?: { roomId: string; proof: UnlockProof },
  ): Promise<void> {
    fileRef.current = file;
    headRef.current = head;
    setError(null);
    setDenyReason(null);
    moveTo('creating');
    try {
      const roomId = auth?.roomId ?? randomRoomId();
      setShareUrl(buildSessionUrl('unlock', roomId));
      const signaling = await createSignaling(roomId);
      signalingRef.current = signaling;

      moveTo('waiting');
      const peer = await connectAsHost(signaling, {
        onMessage: handleMessage,
        onBinary: () => undefined,
        onClose: handlePeerClose,
      });
      peerRef.current = peer;

      const headBytes = new Uint8Array(
        await file.slice(0, head.dataOffset).arrayBuffer(),
      );
      peer.sendMessage({
        t: 'decrypt-request',
        requesterName,
        headB64: bytesToBase64(headBytes),
        ...(auth ? { proof: auth.proof } : {}),
      });
      moveTo('waitingApproval');
    } catch (e) {
      setError(toCipherErrorCode(e));
      moveTo('error');
      close();
    }
  }

  function close(): void {
    peerRef.current?.close();
    peerRef.current = null;
    void signalingRef.current?.leave();
    signalingRef.current = null;
  }

  function reset(): void {
    peerRef.current?.sendMessage({ t: 'bye' });
    close();
    fileRef.current = null;
    headRef.current = null;
    setShareUrl(null);
    setProgress(0);
    setError(null);
    setDenyReason(null);
    moveTo('idle');
  }

  const sessionActive =
    phase === 'waiting' || phase === 'waitingApproval' || phase === 'decrypting';

  return {
    phase,
    shareUrl,
    progress,
    error,
    denyReason,
    sessionActive,
    open,
    reset,
  };
}
