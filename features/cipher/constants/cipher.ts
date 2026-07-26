/**
 * Hard constants of the cipher feature. The container format ("RDXENC" +
 * 2-digit version) and the KDF context strings are part of the on-disk format:
 * changing any of them makes previously encrypted files unreadable.
 */

/** 8-byte ASCII magic at offset 0 of every .radixseal.enc container. */
export const CIPHER_MAGIC = 'RDXENC01';

export const CIPHER_VERSION = 1 as const;

/** Domain-separation context mixed into the ROLA challenge payload. */
export const CIPHER_CONTEXT = 'radix-cipher-v1' as const;

/** HKDF info string binding derived keys to this feature and algorithm. */
export const HKDF_INFO = 'radix-cipher-v1/aes-gcm';

/** Plaintext bytes per AES-GCM chunk (1 MiB). */
export const CHUNK_SIZE = 1 << 20;

/** AES-GCM authentication tag appended to every encrypted chunk. */
export const GCM_TAG_BYTES = 16;

/** Upper bound for the JSON header so a hostile file can't allocate at will. */
export const MAX_HEADER_BYTES = 16 * 1024;

export const FILE_EXTENSION = '.radixseal.enc';

/**
 * DataChannel binary frame size.
 *
 * 16 KiB, the size every browser handles natively and the one WebRTC guidance
 * settles on. The channel is ordered, so a frame in flight delays everything
 * queued behind it: with 64 KiB frames a control message (or the transport
 * keepalive) waited four times longer to get out, which on a slow or lossy
 * link is exactly when that latency matters. Smaller frames also give the
 * backpressure check four times finer granularity. Frame boundaries are not
 * part of the format — the receiver reassembles by the announced chunk length
 * — so this can change without breaking any existing container or peer.
 */
export const WIRE_FRAME_SIZE = 16 * 1024;

export const IDB_NAME = 'radix-cipher';

/** Local copies of transferred files are dropped after this long. */
export const IDB_TTL_MS = 24 * 60 * 60 * 1000;
