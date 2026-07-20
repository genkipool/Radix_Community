/**
 * Cipher-typed facade over the generic P2P peer: binds the wire protocol
 * (DataChannelMessage) so hooks don't repeat the type parameter.
 */
import {
  connectAsGuest as connectGuest,
  connectAsHost as connectHost,
  type Peer,
  type PeerHandlers,
} from '@/features/p2p/lib/webrtc';
import type { CipherSignaling } from '@/features/p2p/lib/signaling';
import type { DataChannelMessage } from '../types/cipher.types';

export type CipherPeer = Peer<DataChannelMessage>;
export type CipherPeerHandlers = PeerHandlers<DataChannelMessage>;

export function connectAsHost(
  signaling: CipherSignaling,
  handlers: CipherPeerHandlers,
): Promise<CipherPeer> {
  return connectHost<DataChannelMessage>(signaling, handlers);
}

export function connectAsGuest(
  signaling: CipherSignaling,
  handlers: CipherPeerHandlers,
): Promise<CipherPeer> {
  return connectGuest<DataChannelMessage>(signaling, handlers);
}
