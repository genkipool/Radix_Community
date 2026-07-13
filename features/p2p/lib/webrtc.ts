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
  close(): void;
}

/** How long ICE may take once the peers start negotiating. */
const CONNECT_TIMEOUT_MS = 30_000;

function wirePeer<TMessage>(
  pc: RTCPeerConnection,
  dc: RTCDataChannel,
  handlers: PeerHandlers<TMessage>,
): Peer<TMessage> {
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = BUFFERED_LOW;
  dc.onmessage = (event) => {
    if (typeof event.data === 'string') {
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
    handlers.onClose();
  };
  dc.onclose = notifyClose;
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      notifyClose();
    }
  };

  return {
    sendMessage(message) {
      if (dc.readyState === 'open') dc.send(JSON.stringify(message));
    },
    async sendBinary(bytes) {
      if (dc.readyState !== 'open') throw new Error('peer_disconnected');
      if (dc.bufferedAmount > BUFFERED_HIGH) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('peer_disconnected')),
            CONNECT_TIMEOUT_MS,
          );
          dc.addEventListener(
            'bufferedamountlow',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
      }
      if (dc.readyState !== 'open') throw new Error('peer_disconnected');
      dc.send(bytes);
    },
    close() {
      closed = true;
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

/** Host side: wait for the first guest, offer, open the channel. */
export async function connectAsHost<TMessage>(
  signaling: CipherSignaling,
  handlers: PeerHandlers<TMessage>,
): Promise<Peer<TMessage>> {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const dc = pc.createDataChannel('cipher', { ordered: true });
  let guestId: string | null = null;

  // The host may wait indefinitely for a guest; the ICE timeout only starts
  // once someone joins and negotiation actually begins.
  let armTimeout: () => void = () => undefined;
  const opened = new Promise<void>((resolve, reject) => {
    dc.onopen = () => resolve();
    dc.onerror = () => reject(new Error('webrtc_failed'));
    armTimeout = () => {
      setTimeout(() => reject(new Error('webrtc_failed')), CONNECT_TIMEOUT_MS);
    };
  });

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
    if (guestId) {
      // One-shot room: turn away anyone after the first guest.
      void signaling
        .send({ t: 'bye', from: signaling.peerId, to: peerId })
        .catch(() => undefined);
      return;
    }
    guestId = peerId;
    armTimeout();
    watchIce(pc, signaling, peerId);
    void (async () => {
      const offer = await pc.createOffer();
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
