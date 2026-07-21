'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CipherErrorCode,
  DataChannelMessage,
} from '../types/cipher.types';
import type { EncryptResult } from './useEncryptFlow';
import { verifyLedgerAuthorization } from '../lib/authorize';
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

/**
 * Flow A, sender side (host): share a freshly encrypted file over WebRTC,
 * then approve (sign) or reject the receiver's decrypt request. The derived
 * file key — never the ROLA signature — is released over the DTLS channel.
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
  // Resolved when the receiver acknowledges (`receipt`) that every chunk landed
  // in its store — the truthful "transfer complete" signal.
  const receiptRef = useRef<(() => void) | null>(null);

  const moveTo = (next: SendPhase) => {
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

  function handleMessage(message: DataChannelMessage) {
    if (message.t === 'decrypt-request') {
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
      handleClose();
    }
  }

  function handleClose() {
    if (phaseRef.current === 'keySent' || phaseRef.current === 'idle') return;
    setError('peer_disconnected');
    moveTo('error');
  }

  async function open(result: EncryptResult): Promise<void> {
    resultRef.current = result;
    setError(null);
    setRequest(null);
    setProgress(0);
    moveTo('creating');
    try {
      const roomId = randomRoomId();
      roomIdRef.current = roomId;
      setShareUrl(buildSessionUrl('receive', roomId));
      const signaling = await createSignaling(roomId);
      signalingRef.current = signaling;

      moveTo('waiting');
      const peer = await connectAsHost(signaling, {
        onMessage: handleMessage,
        onBinary: () => undefined,
        onClose: handleClose,
      });
      peerRef.current = peer;

      const meta = await getFileMeta(result.fileId);
      if (!meta) throw new Error('unknown');
      const headBytes = new Uint8Array(await meta.headBytes.arrayBuffer());
      headB64Ref.current = bytesToBase64(headBytes);

      moveTo('transferring');
      // Arm the receipt wait BEFORE the last frames go out, so a fast receiver
      // can't ack before we are listening.
      const receipt = new Promise<void>((resolve) => {
        receiptRef.current = resolve;
      });
      await sendEncryptedFile(
        peer,
        headBytes,
        meta.chunkCount,
        (index) => getChunk(result.fileId, index),
        setProgress,
      );
      // The bytes are only queued until the buffer drains; wait for that, then
      // for the receiver's receipt, before claiming the transfer is complete.
      await peer.flush();
      await Promise.race([
        receipt,
        new Promise<void>((resolve) => setTimeout(resolve, 30_000)),
      ]);
      // A disconnect during the wait already moved us to 'error'; don't override.
      if (phaseRef.current === 'transferring') moveTo('transferred');
    } catch (e) {
      setError(toCipherErrorCode(e));
      moveTo('error');
      close();
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
    peerRef.current?.close();
    peerRef.current = null;
    void signalingRef.current?.leave();
    signalingRef.current = null;
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
