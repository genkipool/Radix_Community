/**
 * Shared types for browser-to-browser transport (used by the cipher and chat
 * features). Domain-specific wire protocols live in each feature; this layer
 * only knows about signaling and generic peers.
 */

/** WebRTC role: the host creates the room and sends the offer. */
export type PeerRole = 'host' | 'guest';

/** Signaling messages relayed over the Supabase Realtime room channel. */
export type SignalMessage =
  | { t: 'offer'; sdp: string; from: string; to: string }
  | { t: 'answer'; sdp: string; from: string; to: string }
  | { t: 'ice'; candidate: RTCIceCandidateInit; from: string; to: string }
  | { t: 'bye'; from: string; to: string };
