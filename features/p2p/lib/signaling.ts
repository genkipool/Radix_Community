'use client';

/**
 * WebRTC signaling over a Supabase Realtime broadcast channel. The room id
 * (128 random bits from the share URL fragment) is the only capability needed
 * to join; the channel carries nothing but SDP/ICE and a `bye`, and is left
 * as soon as the DataChannel opens.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { SignalMessage } from '../types/p2p.types';

export interface CipherSignaling {
  peerId: string;
  send(signal: SignalMessage): Promise<void>;
  onSignal(cb: (signal: SignalMessage) => void): void;
  /** Fires for every OTHER peer present in or joining the room. */
  onPeerJoin(cb: (peerId: string) => void): void;
  leave(): Promise<void>;
}

function randomPeerId(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSignaling(roomId: string): Promise<CipherSignaling> {
  const peerId = randomPeerId();
  let signalCb: ((signal: SignalMessage) => void) | null = null;
  let joinCb: ((peerId: string) => void) | null = null;
  const seenPeers = new Set<string>();

  let channel: RealtimeChannel;
  try {
    const client = getSupabaseBrowserClient();
    const name = `cipher:${roomId}`;
    // Only ONE channel may exist per topic. Two overlapping subscriptions fight
    // over it — the first `unsubscribe()` tears the topic down for the second —
    // which leaves a host that looks connected but receives nothing. React
    // StrictMode (dev mounts every effect twice) and Fast Refresh produce
    // exactly that overlap, so drop any stale channel before subscribing.
    await Promise.all(
      client
        .getChannels()
        .filter((existing) => existing.topic === `realtime:${name}`)
        .map((stale) => client.removeChannel(stale).catch(() => undefined)),
    );
    channel = client.channel(name, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: peerId },
      },
    });
  } catch {
    throw new Error('signaling_unavailable');
  }

  // Signals that arrive before `onSignal` is registered. Joining the room
  // announces our presence, and the peer answers IMMEDIATELY — often before the
  // caller (a tick later) installs its handler. Dropping those frames silently
  // lost the offer, and the join then waited for one that never came again:
  // the intermittent "shared link does not work" failure. Queue and replay.
  const earlySignals: SignalMessage[] = [];

  channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
    const signal = payload as SignalMessage;
    // Point-to-point: ignore our own echoes and frames meant for other peers.
    if (signal.from === peerId || signal.to !== peerId) return;
    if (signalCb) signalCb(signal);
    else earlySignals.push(signal);
  });

  const announcePeers = () => {
    for (const key of Object.keys(channel.presenceState())) {
      if (key !== peerId && !seenPeers.has(key)) {
        seenPeers.add(key);
        joinCb?.(key);
      }
    }
  };
  channel.on('presence', { event: 'sync' }, announcePeers);
  channel.on('presence', { event: 'join' }, announcePeers);

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel
          .track({ joinedAt: Date.now() })
          .then(() => resolve())
          .catch(() => reject(new Error('signaling_unavailable')));
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error('signaling_unavailable'));
      }
    });
  });

  return {
    peerId,
    async send(signal) {
      const status = await channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: signal,
      });
      if (status === 'error' || status === 'timed out') {
        throw new Error('signaling_unavailable');
      }
    },
    onSignal(cb) {
      signalCb = cb;
      // Replay whatever landed while nobody was listening (see `earlySignals`).
      const queued = earlySignals.splice(0);
      for (const signal of queued) cb(signal);
    },
    onPeerJoin(cb) {
      joinCb = cb;
      announcePeers();
    },
    async leave() {
      signalCb = null;
      joinCb = null;
      await channel.unsubscribe().catch(() => undefined);
    },
  };
}
