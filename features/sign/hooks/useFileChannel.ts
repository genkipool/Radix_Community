'use client';

/**
 * Direct browser-to-browser document delivery for signing links, on the shared
 * P2P layer (Supabase signaling + WebRTC DataChannel, DTLS-encrypted).
 *
 * The initiator keeps their tab open as HOST of a room whose 128-bit id rides
 * in the share URL's FRAGMENT (never reaches server logs). Each co-signer that
 * opens the link joins as GUEST and receives the document automatically; the
 * host then re-opens the room for the next co-signer. The received file goes
 * through the normal dropzone pipeline, so its hash is still computed locally
 * and checked against the on-ledger request.
 */
import { useEffect, useRef, useState } from 'react';
import { createSignaling, type CipherSignaling } from '@/features/p2p/lib/signaling';
import { connectAsHost, connectAsGuest, type Peer } from '@/features/p2p/lib/webrtc';
import { MAX_FILE_BYTES } from '../constants/limits';

/** One DataChannel frame; the channel is ordered, no per-frame header needed. */
const FRAME_BYTES = 64 * 1024;

type WireMessage =
  | { t: 'meta'; name: string; mime: string; size: number }
  | { t: 'done' }
  | { t: 'received' };

export type SendChannelPhase = 'idle' | 'waiting' | 'sending' | 'error';

/**
 * Host side. While `enabled` and a document is loaded, keeps a room open and
 * serves the document to every guest that joins, one at a time.
 */
export function useSendFileChannel(input: {
  enabled: boolean;
  roomId: string;
  fileName: string | null;
  fileType: string | null;
  bytes: Uint8Array | null;
}) {
  const { enabled, roomId, fileName, fileType, bytes } = input;
  const [phase, setPhase] = useState<SendChannelPhase>('idle');
  const [deliveries, setDeliveries] = useState(0);
  /** Fraction [0, 1] of the current delivery; 0 while waiting for a peer. */
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    if (!enabled || !bytes || !fileName) {
      // Deferred: state updates must never run synchronously in an effect.
      queueMicrotask(() => {
        if (active) setPhase('idle');
      });
      return () => {
        active = false;
      };
    }
    let signaling: CipherSignaling | null = null;
    let peer: Peer<WireMessage> | null = null;

    const serveOnce = async () => {
      signaling = await createSignaling(roomId);
      if (!active) {
        void signaling.leave();
        return false;
      }
      let ackReceived: () => void = () => undefined;
      const acked = new Promise<void>((resolve) => {
        ackReceived = resolve;
      });
      peer = await connectAsHost<WireMessage>(signaling, {
        onMessage: (m) => {
          if (m.t === 'received') ackReceived();
        },
        onBinary: () => undefined,
        // A dropped guest also ends the round; the loop re-arms the room.
        onClose: () => ackReceived(),
      });
      if (!active) {
        peer.close();
        return false;
      }
      setPhase('sending');
      setProgress(0);
      peer.sendMessage({
        t: 'meta',
        name: fileName,
        mime: fileType || 'application/octet-stream',
        size: bytes.byteLength,
      });
      // Fresh ArrayBuffer copy: the view may sit on a shared/offset buffer.
      const buf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buf).set(bytes);
      const total = buf.byteLength;
      let lastPct = 0;
      for (let offset = 0; offset < total && active; offset += FRAME_BYTES) {
        const end = Math.min(total, offset + FRAME_BYTES);
        await peer.sendBinary(buf.slice(offset, end));
        // Whole-percent steps only, to keep re-renders cheap on big files.
        const pct = total > 0 ? Math.floor((end / total) * 100) : 100;
        if (pct > lastPct) {
          lastPct = pct;
          setProgress(end / total);
        }
      }
      peer.sendMessage({ t: 'done' });
      await acked;
      peer.close();
      peer = null;
      if (active) setDeliveries((d) => d + 1);
      return true;
    };

    void (async () => {
      while (active) {
        setPhase('waiting');
        setProgress(0);
        try {
          if (!(await serveOnce())) return;
        } catch {
          if (!active) return;
          setPhase('error');
          return;
        }
        // Small pause before re-hosting the room for the next co-signer.
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    })();

    return () => {
      active = false;
      peer?.close();
      void signaling?.leave();
    };
  }, [enabled, roomId, fileName, fileType, bytes]);

  return { phase, deliveries, progress };
}

export type ReceiveChannelPhase =
  | 'idle'
  | 'connecting'
  | 'receiving'
  | 'done'
  | 'error';

/**
 * Guest side. Joins `roomId` once and resolves the received document through
 * `onFile` (the shared dropzone handler, so hashing/checks run as if the user
 * had dropped the file). `onFile` is read through a ref: this repo bans
 * useCallback and the handler is recreated every render.
 */
export function useReceiveFileChannel(input: {
  roomId: string | null;
  onFile: (file: File) => void;
}) {
  const { roomId } = input;
  const [phase, setPhase] = useState<ReceiveChannelPhase>('idle');
  const [progress, setProgress] = useState(0);

  // Mount-time snapshot (same pattern as VerifyForm): the handler is recreated
  // every render but only closes over stable state setters, so the first
  // reference stays valid; assigning refs during render is disallowed.
  const onFileRef = useRef(input.onFile);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!roomId || startedRef.current) return;
    startedRef.current = true;
    let peer: Peer<WireMessage> | null = null;
    let meta: { name: string; mime: string; size: number } | null = null;
    const parts: ArrayBuffer[] = [];
    let received = 0;
    let finished = false;

    void (async () => {
      setPhase('connecting');
      const signaling = await createSignaling(roomId);
      peer = await connectAsGuest<WireMessage>(signaling, {
        onMessage: (m) => {
          if (m.t === 'meta') {
            if (m.size > MAX_FILE_BYTES) {
              finished = true;
              setPhase('error');
              peer?.close();
              return;
            }
            meta = m;
            setProgress(0);
            setPhase('receiving');
          } else if (m.t === 'done' && meta && !finished) {
            finished = true;
            const file = new File(parts, meta.name || 'document', {
              type: meta.mime || 'application/octet-stream',
            });
            peer?.sendMessage({ t: 'received' });
            setPhase('done');
            onFileRef.current(file);
            // Give the ack a moment to flush before tearing down.
            setTimeout(() => peer?.close(), 500);
          }
        },
        onBinary: (frame) => {
          if (finished) return;
          parts.push(frame);
          received += frame.byteLength;
          if (received > MAX_FILE_BYTES) {
            finished = true;
            setPhase('error');
            peer?.close();
            return;
          }
          if (meta?.size) setProgress(Math.min(1, received / meta.size));
        },
        onClose: () => {
          if (!finished) setPhase('error');
        },
      });
    })().catch(() => {
      if (!finished) setPhase('error');
    });

    return () => {
      peer?.close();
    };
  }, [roomId]);

  return { phase, progress };
}
