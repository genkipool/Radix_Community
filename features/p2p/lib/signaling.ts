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
    channel = getSupabaseBrowserClient().channel(`cipher:${roomId}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: peerId },
      },
    });
  } catch {
    throw new Error('signaling_unavailable');
  }

  channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
    const signal = payload as SignalMessage;
    // Point-to-point: ignore our own echoes and frames meant for other peers.
    if (signal.from === peerId || signal.to !== peerId) return;
    signalCb?.(signal);
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
