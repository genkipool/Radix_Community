'use client';

/**
 * RTCPeerConnection + single ordered DataChannel. The host (whoever generated
 * the share URL) waits for a peer, sends the offer and owns the channel; the
 * guest answers. Signaling stops mattering once the channel opens. Sessions
 * are strictly one-to-one: a second joiner gets a `bye` and surfaces
 * `room_busy` locally.
 *
 * The wire message type is generic — each feature (cipher transfer, chat)
 * defines its own JSON control protocol; binary frames pass through as-is.
 */
import { BUFFERED_HIGH, BUFFERED_LOW } from '../constants/p2p';
import type { CipherSignaling } from './signaling';

/**
 * Default ICE set mirrors `radix_default_ice_servers()` from the Radix Rust
 * SDK connect crate: Google STUN plus the public metered.ca TURN relay, so
 * symmetric-NAT peers connect out of the box. Override via env.
 */
export function iceServers(): RTCIceServer[] {
  const stunUrls = (
    process.env.NEXT_PUBLIC_STUN_URLS ||
    'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'
  )
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const turnUrl =
    process.env.NEXT_PUBLIC_TURN_URL ||
    'turn:standard.relay.metered.ca:80,turns:standard.relay.metered.ca:443?transport=tcp';
  const turnUsername =
    process.env.NEXT_PUBLIC_TURN_USERNAME || '51253affa7c2960189ce8cb6';
  const turnCredential =
    process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '3HWkp3Wgg2cujD2g';

  const servers: RTCIceServer[] = [{ urls: stunUrls }];
  if (turnUrl && turnUsername) {
    servers.push({
      urls: turnUrl.split(',').map((url) => url.trim()),
      username: turnUsername,
      credential: turnCredential,
    });
  }
  return servers;
}

export interface PeerHandlers<TMessage> {
  onMessage(message: TMessage): void;
  onBinary(bytes: ArrayBuffer): void;
  /** Channel closed or connection lost after being established. */
  onClose(): void;
}

export interface Peer<TMessage> {
  sendMessage(message: TMessage): void;
  /** Sends one frame, honouring DataChannel backpressure. */
  sendBinary(bytes: ArrayBuffer): Promise<void>;
  /**
   * Bytes handed to `send()` that have NOT left the buffer yet. A sender that
   * subtracts this from what it enqueued knows how much really reached the
   * wire, which is the only honest basis for a progress bar.
   */
  bufferedAmount(): number;
  /**
   * Resolves once every queued byte has actually left the send buffer (it is
   * on the wire, not merely handed to `send()`). Lets a sender report "done"
   * or 100% truthfully instead of the instant the last frame was enqueued.
   */
  flush(): Promise<void>;
  close(): void;
}

/** How long ICE may take once the peers start negotiating. */
const CONNECT_TIMEOUT_MS = 30_000;

/**
 * Grace given to a NON-definitive ICE state (`disconnected`, and `failed`
 * while bytes are still moving) before the peer is declared gone.
 *
 * `disconnected` is not a close: ICE reports it as soon as the selected
 * candidate pair stops seeing inbound packets for a couple of seconds, which
 * happens routinely on a busy or lossy path, on Wi-Fi hand-offs and behind a
 * loaded TURN relay, and it clears itself while the DataChannel never stops
 * working. The grace is only the FLOOR: `livenessProven` below can extend it
 * indefinitely while data keeps flowing.
 */
const DISCONNECT_GRACE_MS = 15_000;

/** How often the drain watchdog samples the send buffer. */
const DRAIN_POLL_MS = 1_000;

/**
 * Give up on a send buffer that has neither shrunk nor shown any sign of life
 * for this long. Generous on purpose: a slow receiver (writing every chunk to
 * IndexedDB) or an SCTP retransmission storm on a lossy link legitimately
 * freezes the buffer for a long time, and the peer keeps proving it is there
 * through the keepalive in the meantime.
 */
const DRAIN_STALL_MS = 90_000;

/**
 * Transport-level keepalive. Not a feature message: it is filtered out before
 * anything reaches `handlers.onMessage`, and every feature's protocol ignores
 * unknown `t` values anyway, so a peer on an older build simply drops it.
 *
 * Two jobs. It proves the path works when the application has nothing to say
 * (a chat sitting idle, a sender waiting for the decrypt request), and the
 * packets themselves keep ICE's "receiving" flag set on both sides, which is
 * what stops a quiet or one-way path from being declared `disconnected` in the
 * first place.
 */
const KEEPALIVE_FRAME = '{"t":"__ka"}';
const KEEPALIVE_MS = 3_000;

/**
 * How recently the path must have proven itself for the peer to count as
 * alive. Comfortably above KEEPALIVE_MS so a single lost keepalive is not
 * mistaken for a dead link.
 */
const LIVENESS_WINDOW_MS = 10_000;

/**
 * Hand the event loop back after this many frames. At 16 KiB a frame the pause
 * costs a fraction of a millisecond per 256 KiB, far below any real link's
 * throughput, and it is what lets timers and inbound frames be serviced while
 * a file streams.
 */
const YIELD_EVERY_FRAMES = 16;

/**
 * Evidence that the path is working, independent of what ICE thinks.
 *
 * Two things count as proof, and both are facts rather than opinions: a frame
 * ARRIVED from the peer, or bytes LEFT our send buffer (SCTP only releases
 * them once the peer acknowledges them). Either one means packets are making
 * the round trip right now.
 */
interface Liveness {
  proof(): void;
  provenWithin(ms: number): boolean;
  since(): number;
}

function createLiveness(): Liveness {
  let lastProofAt = Date.now();
  return {
    proof() {
      lastProofAt = Date.now();
    },
    provenWithin(ms) {
      return Date.now() - lastProofAt < ms;
    },
    since() {
      return Date.now() - lastProofAt;
    },
  };
}

/**
 * Block until the DataChannel send buffer drains to `target` bytes. Resolves
 * promptly via `bufferedamountlow` when possible; rejects only if the channel
 * closes (detected within one poll) or nothing at all has happened for
 * DRAIN_STALL_MS. No wall-clock deadline: a large file over a slow relay can
 * spend minutes draining legitimately.
 */
function waitUntilDrained(
  dc: RTCDataChannel,
  target: number,
  live: Liveness,
): Promise<void> {
  if (dc.readyState !== 'open') return Promise.reject(new Error('peer_disconnected'));
  if (dc.bufferedAmount <= target) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let lastBuffered = dc.bufferedAmount;

    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      dc.removeEventListener('bufferedamountlow', onLow);
      action();
    };
    // The event only fires at the low-water mark; it just lets us resolve
    // sooner. All stall accounting lives in the interval below.
    const onLow = () => {
      if (dc.bufferedAmount <= target) finish(resolve);
    };
    const watchdog = setInterval(() => {
      if (dc.readyState !== 'open') {
        finish(() => reject(new Error('peer_disconnected')));
        return;
      }
      const buffered = dc.bufferedAmount;
      if (buffered < lastBuffered) {
        // Bytes left the buffer: the peer acknowledged them.
        lastBuffered = buffered;
        live.proof();
      }
      if (buffered <= target) {
        finish(resolve);
      } else if (!live.provenWithin(DRAIN_STALL_MS)) {
        finish(() => reject(new Error('peer_disconnected')));
      }
    }, DRAIN_POLL_MS);

    dc.addEventListener('bufferedamountlow', onLow);
  });
}

/**
 * Bind an open PeerConnection + DataChannel to a feature's handlers. Exported
 * so the close/liveness rules can be exercised against fake transports.
 */
export function wirePeer<TMessage>(
  pc: RTCPeerConnection,
  dc: RTCDataChannel,
  handlers: PeerHandlers<TMessage>,
): Peer<TMessage> {
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = BUFFERED_LOW;
  const live = createLiveness();

  dc.onmessage = (event) => {
    // Anything arriving is proof the path works, keepalives included.
    live.proof();
    if (typeof event.data === 'string') {
      if (event.data === KEEPALIVE_FRAME) return;
      try {
        handlers.onMessage(JSON.parse(event.data) as TMessage);
      } catch {
        /* ignore malformed frames */
      }
    } else {
      handlers.onBinary(event.data as ArrayBuffer);
    }
  };

  let closed = false;
  const notifyClose = () => {
    if (closed) return;
    closed = true;
    clearInterval(keepalive);
    cancelGrace();
    handlers.onClose();
  };
  dc.onclose = notifyClose;

  const keepalive = setInterval(() => {
    if (dc.readyState !== 'open') return;
    // While data is queued, drain progress already proves the peer is there;
    // queueing another frame behind a full buffer would prove nothing and only
    // add to the backlog.
    if (dc.bufferedAmount > 0) return;
    try {
      dc.send(KEEPALIVE_FRAME);
    } catch {
      /* channel closing: onclose handles it */
    }
  }, KEEPALIVE_MS);

  /**
   * ICE state is an opinion; bytes on the wire are a fact. A non-definitive
   * state starts a countdown that keeps being pushed back for as long as the
   * link keeps proving itself, so a transfer that is visibly progressing is
   * never torn down over `disconnected` — the exact churn that made bad links
   * reconnect over and over mid-file.
   */
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  function cancelGrace(): void {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = null;
  }
  const armGrace = () => {
    if (graceTimer || closed) return;
    graceTimer = setTimeout(function settle() {
      graceTimer = null;
      const state = pc.connectionState;
      if (state === 'connected' || state === 'new') return;
      if (live.provenWithin(LIVENESS_WINDOW_MS)) {
        // Still moving data: keep waiting for ICE to catch up with reality.
        armGrace();
        return;
      }
      notifyClose();
    }, DISCONNECT_GRACE_MS);
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'closed') {
      notifyClose();
    } else if (state === 'failed' || state === 'disconnected') {
      // `failed` normally means every candidate pair is dead, but it is also
      // reported on paths that recover, so it goes through the same
      // liveness-gated countdown rather than killing a working channel.
      armGrace();
    } else if (state === 'connected') {
      cancelGrace();
    }
  };

  // Frames sent since the last yield to the event loop. A caller that loops
  // over a whole file never awaits anything real, which starves timers and
  // inbound handlers (including the drain watchdog and the keepalive) on the
  // very links that most need them.
  let sinceYield = 0;

  return {
    sendMessage(message) {
      if (dc.readyState === 'open') dc.send(JSON.stringify(message));
    },
    async sendBinary(bytes) {
      if (dc.readyState !== 'open') throw new Error('peer_disconnected');
      // Checked BEFORE every frame, so the buffer can never hold more than
      // BUFFERED_HIGH + one frame no matter how fast the caller loops.
      if (dc.bufferedAmount > BUFFERED_HIGH) {
        await waitUntilDrained(dc, BUFFERED_LOW, live);
        sinceYield = 0;
      } else if (++sinceYield >= YIELD_EVERY_FRAMES) {
        sinceYield = 0;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (dc.readyState !== 'open') throw new Error('peer_disconnected');
      dc.send(bytes);
    },
    bufferedAmount() {
      return dc.bufferedAmount;
    },
    async flush() {
      if (dc.readyState !== 'open') throw new Error('peer_disconnected');
      await waitUntilDrained(dc, 0, live);
    },
    close() {
      closed = true;
      clearInterval(keepalive);
      cancelGrace();
      dc.close();
      pc.close();
    },
  };
}

function watchIce(pc: RTCPeerConnection, signaling: CipherSignaling, to: string) {
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void signaling
        .send({ t: 'ice', candidate: event.candidate.toJSON(), from: signaling.peerId, to })
        .catch(() => undefined);
    }
  };
}

function openTimeout(dc: RTCDataChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('webrtc_failed')), CONNECT_TIMEOUT_MS);
    dc.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    dc.onerror = () => {
      clearTimeout(timer);
      reject(new Error('webrtc_failed'));
    };
  });
}

/** Host side: wait for a guest, offer, open the channel. */
export async function connectAsHost<TMessage>(
  signaling: CipherSignaling,
  handlers: PeerHandlers<TMessage>,
): Promise<Peer<TMessage>> {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const dc = pc.createDataChannel('cipher', { ordered: true });
  let guestId: string | null = null;
  let channelOpen = false;

  // The host may wait indefinitely for a guest; the ICE timeout only starts
  // once someone joins and negotiation actually begins, and it is re-armed if
  // we switch to a newer guest.
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fail: (error: Error) => void = () => undefined;
  const opened = new Promise<void>((resolve, reject) => {
    fail = reject;
    dc.onopen = () => {
      channelOpen = true;
      if (timer) clearTimeout(timer);
      resolve();
    };
    dc.onerror = () => reject(new Error('webrtc_failed'));
  });
  const armTimeout = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fail(new Error('webrtc_failed')), CONNECT_TIMEOUT_MS);
  };

  signaling.onSignal((signal) => {
    if (signal.t === 'answer' && signal.from === guestId) {
      void pc
        .setRemoteDescription({ type: 'answer', sdp: signal.sdp })
        .catch(() => undefined);
    } else if (signal.t === 'ice' && signal.from === guestId) {
      void pc.addIceCandidate(signal.candidate).catch(() => undefined);
    }
  });

  signaling.onPeerJoin((peerId) => {
    if (channelOpen) {
      // Session established: this room is one-to-one, so turn latecomers away.
      void signaling
        .send({ t: 'bye', from: signaling.peerId, to: peerId })
        .catch(() => undefined);
      return;
    }
    // Nothing is connected yet, so a NEW peer simply becomes the guest we
    // negotiate with. Rejecting it (the old behaviour) meant a guest that
    // reloaded, or retried after losing the race with the host, was answered
    // `bye` while the host went on waiting for a peer that would never reply —
    // the room stayed dead until its timeout.
    const retarget = guestId !== null && guestId !== peerId;
    guestId = peerId;
    armTimeout();
    watchIce(pc, signaling, peerId);
    void (async () => {
      // An ICE restart is required when re-offering to a different peer, so the
      // candidate pair is renegotiated from scratch.
      const offer = await pc.createOffer(retarget ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      await signaling.send({
        t: 'offer',
        sdp: offer.sdp ?? '',
        from: signaling.peerId,
        to: peerId,
      });
    })().catch(() => undefined);
  });

  await opened;
  void signaling.leave();
  return wirePeer(pc, dc, handlers);
}

/** Guest side: wait for the host's offer, answer, receive the channel. */
export async function connectAsGuest<TMessage>(
  signaling: CipherSignaling,
  handlers: PeerHandlers<TMessage>,
): Promise<Peer<TMessage>> {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  let hostId: string | null = null;

  const channelPromise = new Promise<RTCDataChannel>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('webrtc_failed')), CONNECT_TIMEOUT_MS * 2);
    pc.ondatachannel = (event) => {
      clearTimeout(timer);
      resolve(event.channel);
    };
    signaling.onSignal((signal) => {
      if (signal.t === 'bye') {
        clearTimeout(timer);
        reject(new Error('room_busy'));
      } else if (signal.t === 'offer' && !hostId) {
        hostId = signal.from;
        watchIce(pc, signaling, signal.from);
        void (async () => {
          await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await signaling.send({
            t: 'answer',
            sdp: answer.sdp ?? '',
            from: signaling.peerId,
            to: signal.from,
          });
        })().catch(() => {
          clearTimeout(timer);
          reject(new Error('webrtc_failed'));
        });
      } else if (signal.t === 'ice' && signal.from === hostId) {
        void pc.addIceCandidate(signal.candidate).catch(() => undefined);
      }
    });
  });

  const dc = await channelPromise;
  const opened =
    dc.readyState === 'open' ? Promise.resolve() : openTimeout(dc);
  const peer = wirePeer(pc, dc, handlers);
  await opened;
  void signaling.leave();
  return peer;
}
