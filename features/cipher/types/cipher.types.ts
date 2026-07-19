/**
 * Domain types for the cipher feature.
 *
 * Security model: the file NEVER leaves the browser. The AES-256-GCM key is
 * derived (HKDF) from a deterministic Ed25519 ROLA signature over a challenge
 * that commits to the per-file salt, so the encrypting account can re-derive
 * the key on any device by signing again — no key material is ever stored.
 */

/** Canonical payload hashed into the ROLA challenge (see deriveCipherChallenge). */
export interface CipherChallengePayload {
  v: 1;
  context: 'radix-cipher-v1';
  /** 32 random bytes, hex — unique per file, also the HKDF salt. */
  fileSalt: string;
  networkId: number;
}

/**
 * Plaintext JSON header embedded in every .radixseal.enc container. Everything a
 * holder of the file needs to route a decrypt request back to the sender and
 * for the sender to re-derive the key statelessly.
 *
 * Note: the ROLA signature also commits to dAppDefinitionAddress and origin,
 * so the key is bound to (account, dApp definition, origin, network). They are
 * recorded here so mismatches surface as explicit errors instead of a silent
 * GCM failure.
 */
export interface CipherHeader {
  v: 1;
  context: 'radix-cipher-v1';
  alg: 'AES-256-GCM';
  kdf: 'HKDF-SHA256';
  fileSalt: string;
  /** 8 random bytes, hex — per-chunk IV = baseIv || uint32 chunk index. */
  baseIv: string;
  chunkSize: number;
  chunkCount: number;
  fileSize: number;
  fileName: string;
  mimeType: string;
  senderAccount: string;
  senderPublicKey: string;
  curve: 'curve25519';
  networkId: number;
  dAppDefinitionAddress: string;
  origin: string;
  createdAt: string;
  /**
   * ROLA + Ledger protection: only accounts holding a `cipher-invite` NFT for
   * this container (its `document_hash` = this header's hash) minted in the
   * sender's signing collection may request the key, proving their account
   * with a ROLA challenge. Absent on plain ROLA containers.
   */
  access?: 'rola-ledger';
  /** The sender's signing collection where the invite NFTs were minted. */
  inviteCollection?: string;
}

/** Parsed head of a container: header + its hash + where ciphertext starts. */
export interface ContainerHead {
  header: CipherHeader;
  /** blake2b-256 of the canonical header JSON bytes; AAD of every chunk. */
  headerHash: string;
  /** Byte offset of chunk 0 within the container. */
  dataOffset: number;
}

/** Session mode carried in the share URL fragment. */
export type SessionMode = 'receive' | 'unlock';

export type { PeerRole, SignalMessage } from '@/features/p2p/types/p2p.types';

/** Why the sender refused (or failed) to release the key. */
export type DenyReason =
  | 'rejected'
  | 'wallet_error'
  | 'account_mismatch'
  | 'header_mismatch'
  | 'origin_mismatch'
  | 'network_mismatch'
  | 'not_authorized';

/** Receiver's ROLA proof accompanying a decrypt request (ROLA + Ledger). */
export interface UnlockProof {
  account: string;
  publicKey: string;
  signature: string;
  curve: string;
}

/**
 * Application protocol over the DataChannel. Control messages are JSON
 * strings; file bytes travel as raw binary frames between `chunk-start`
 * markers. The derived file key (never the raw ROLA signature) is the only
 * secret that ever crosses the wire, protected by DTLS.
 */
export type DataChannelMessage =
  | { t: 'hello'; v: 1; role: 'sender' | 'receiver' }
  | { t: 'meta'; headB64: string }
  | { t: 'chunk-start'; index: number; byteLength: number }
  | { t: 'transfer-complete'; chunkCount: number }
  | { t: 'receipt'; receivedChunks: number }
  | {
      t: 'decrypt-request';
      requesterName: string;
      headB64: string;
      /** ROLA proof over the unlock challenge (ROLA + Ledger containers). */
      proof?: UnlockProof;
    }
  | { t: 'decrypt-approved'; fileKeyHex: string }
  | { t: 'decrypt-denied'; reason: DenyReason }
  | { t: 'error'; code: CipherErrorCode }
  | { t: 'bye' };

/** Error codes mapped 1:1 to `cipher.errors.*` i18n keys. */
export type CipherErrorCode =
  | 'wallet_rejected'
  | 'no_proof'
  | 'challenge_mismatch'
  | 'secp256k1'
  | 'origin_mismatch'
  | 'network_mismatch'
  | 'account_mismatch'
  | 'header_mismatch'
  | 'decrypt_failed'
  | 'not_authorized'
  | 'peer_disconnected'
  | 'room_busy'
  | 'signaling_unavailable'
  | 'storage_quota'
  | 'invalid_container'
  | 'webrtc_failed'
  | 'file_read'
  | 'unknown';
