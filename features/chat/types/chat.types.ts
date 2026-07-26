/**
 * Domain types for the end-to-end encrypted chat.
 *
 * Security model: each peer generates an ephemeral ECDH keypair and proves
 * ownership of a Radix account by ROLA-signing a challenge that commits to
 * that ephemeral public key and the room. Both proofs are verified IN THE
 * BROWSER (Ed25519 + address derivation), so neither the signaling server nor
 * a man-in-the-middle can impersonate a peer. The session key is
 * ECDH → HKDF → AES-256-GCM, layered on top of WebRTC's DTLS.
 */
import type { PeerRole } from '@/features/p2p/types/p2p.types';

/** Canonical payload hashed into each peer's handshake ROLA challenge. */
export interface ChatChallengePayload {
  v: 1;
  context: 'radix-chat-v1';
  roomId: string;
  role: PeerRole;
  /** blake2b-256 (hex) of the raw ephemeral ECDH public key. */
  ecdhPubHash: string;
  networkId: number;
}

/** JSON control protocol over the DataChannel. */
export type ChatWireMessage =
  | {
      t: 'handshake';
      v: 1;
      role: PeerRole;
      account: string;
      publicKey: string;
      curve: string;
      signature: string;
      /** Raw P-256 public key, base64. */
      ecdhPubB64: string;
      networkId: number;
      /**
       * The peer's own wallet persona label, so each side can show a name
       * instead of a bare address. SELF-DECLARED: the ROLA challenge commits
       * to the room, role and ephemeral key, NOT to this string, so it proves
       * nothing. Only the account address is verified identity.
       */
      label?: string;
    }
  | { t: 'msg'; seq: number; ivB64: string; ctB64: string }
  /** Live "is typing" state. Carries no content, so it needs no encryption
   *  beyond the channel's own DTLS. */
  | { t: 'typing'; on: boolean }
  /** File announcement: encrypted `ChatFileMeta`, then the encrypted binary
   *  frames follow on the channel until `size` plaintext bytes arrived. */
  | { t: 'file'; seq: number; ivB64: string; ctB64: string }
  /** The sender aborted the in-flight file: the receiver drops its partial. */
  | { t: 'file-cancel'; seq: number }
  | { t: 'bye' };

/** Encrypted message body (JSON before AES-GCM). */
export interface ChatPlaintext {
  text: string;
  at: number;
}

/** Encrypted file announcement body (JSON before AES-GCM). */
export interface ChatFileMeta {
  name: string;
  mime: string;
  size: number;
  at: number;
}

/** Attachment state rendered inside a chat entry. */
export interface ChatFileState {
  name: string;
  mime: string;
  size: number;
  /** 0..1 transferred. */
  progress: number;
  status: 'transferring' | 'done' | 'error' | 'canceled';
  /** Object URL for download, set once the file is complete. */
  url?: string;
}

/** A rendered chat entry: a text message or a file attachment. */
export interface ChatMessage {
  id: string;
  direction: 'sent' | 'received';
  text: string;
  at: number;
  file?: ChatFileState;
}

/** The counterpart, once their handshake proof has been verified locally. */
export interface VerifiedPeer {
  /** Cryptographically proven: this peer controls this account. */
  account: string;
  /**
   * Wallet persona label the peer sent for itself. Convenience only, NOT part
   * of the proof — a locally saved agenda name always takes precedence.
   */
  declaredName?: string;
}

export type ChatPhase =
  | 'idle'
  | 'signing'
  | 'creating'
  | 'waiting'
  | 'connecting'
  | 'handshaking'
  | 'secure'
  | 'closed'
  | 'error';

/** Error codes mapped 1:1 to `chat.errors.*` i18n keys. */
export type ChatErrorCode =
  | 'wallet_rejected'
  | 'no_proof'
  | 'challenge_mismatch'
  | 'secp256k1'
  | 'peer_verification_failed'
  | 'peer_disconnected'
  | 'room_busy'
  | 'signaling_unavailable'
  | 'webrtc_failed'
  | 'crypto_unsupported'
  | 'message_rejected'
  | 'storage_quota'
  | 'unknown';
