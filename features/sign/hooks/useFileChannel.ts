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

    /** Drops a half-open session so the room can be re-armed cleanly. */
    const teardown = async () => {
      peer?.close();
      peer = null;
      await signaling?.leave().catch(() => undefined);
      signaling = null;
    };

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
        // Cap below 100%: the last frames are still draining, so 100% would be
        // a lie until the buffer is empty (set truthfully after flush below).
        const pct = total > 0 ? Math.floor((end / total) * 100) : 100;
        if (pct > lastPct) {
          lastPct = pct;
          setProgress(Math.min(end / total, 0.99));
        }
      }
      peer.sendMessage({ t: 'done' });
      // Every byte (frames + the done marker) is on the wire now — only here is
      // 100% true. Then wait for the receiver to confirm it has the whole file.
      //
      // Past this point the receiver may close at ANY moment: it acks and tears
      // the channel down as soon as it holds the file. A disconnect here is
      // therefore a COMPLETED delivery, not a failure — treating it as one is
      // what made a successful transfer look failed, re-arm the room and keep
      // showing "waiting for a signer" while the file had actually arrived.
      try {
        await peer.flush();
      } catch {
        /* receiver already gone: it has everything by definition */
      }
      if (active) setProgress(1);
      await acked;
      peer.close();
      peer = null;
      if (active) setDeliveries((d) => d + 1);
      return true;
    };

    void (async () => {
      // A failed round must NEVER end the loop: the very first attempt can lose
      // the race with a co-signer opening the link (ICE timeout, signaling
      // hiccup, guest reloading), and giving up left the link permanently dead
      // until the user hit "resend" by hand. Instead we re-arm the room with a
      // short backoff, so the link keeps working on its own.
      let failures = 0;
      while (active) {
        setPhase('waiting');
        setProgress(0);
        try {
          if (!(await serveOnce())) return;
          failures = 0;
        } catch {
          if (!active) return;
          failures += 1;
          // Surfaced until the room is re-armed on the next iteration.
          setPhase('error');
          await teardown();
        }
        if (!active) return;
        // Backoff between rounds: immediate re-arm for the next co-signer,
        // growing (capped) while attempts keep failing.
        await new Promise((resolve) =>
          setTimeout(resolve, failures === 0 ? 500 : Math.min(2000 * failures, 8000)),
        );
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
 * Guest side. Joins `roomId` and resolves the received document through
 * `onFile` (the shared dropzone handler, so hashing/checks run as if the user
 * had dropped the file). `onFile` is read through a ref: this repo bans
 * useCallback and the handler is recreated every render.
 *
 * Attempts are RETRIED: opening a share link routinely loses the race with the
 * host still arming its room (or re-arming it between co-signers), and a single
 * shot left the link looking permanently broken.
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
    let cancelled = false;
    let peer: Peer<WireMessage> | null = null;

    /** One join attempt; resolves true once the whole file is in. */
    const receiveOnce = () =>
      new Promise<boolean>((resolve) => {
        let meta: { name: string; mime: string; size: number } | null = null;
        const parts: ArrayBuffer[] = [];
        let received = 0;
        let finished = false;

        const fail = () => {
          if (finished) return;
          finished = true;
          peer?.close();
          resolve(false);
        };

        void (async () => {
          setPhase('connecting');
          const signaling = await createSignaling(roomId);
          if (cancelled) {
            void signaling.leave();
            fail();
            return;
          }
          peer = await connectAsGuest<WireMessage>(signaling, {
            onMessage: (m) => {
              if (m.t === 'meta') {
                if (m.size > MAX_FILE_BYTES) {
                  setPhase('error');
                  fail();
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
                resolve(true);
              }
            },
            onBinary: (frame) => {
              if (finished) return;
              parts.push(frame);
              received += frame.byteLength;
              if (received > MAX_FILE_BYTES) {
                setPhase('error');
                fail();
                return;
              }
              if (meta?.size) setProgress(Math.min(1, received / meta.size));
            },
            // Losing the peer mid-round is a failed attempt, not the end.
            onClose: fail,
          });
        })().catch(fail);
      });

    void (async () => {
      // Generous but bounded: the host re-arms its room every few seconds, so
      // a handful of spaced attempts covers a slow sender without spinning.
      for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
        if (await receiveOnce()) return;
        if (cancelled) return;
        setPhase('connecting');
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (!cancelled) setPhase('error');
    })();

    return () => {
      cancelled = true;
      peer?.close();
    };
  }, [roomId]);

  return { phase, progress };
}
