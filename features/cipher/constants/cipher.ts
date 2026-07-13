/**
 * Hard constants of the cipher feature. The container format ("RDXENC" +
 * 2-digit version) and the KDF context strings are part of the on-disk format:
 * changing any of them makes previously encrypted files unreadable.
 */

/** 8-byte ASCII magic at offset 0 of every .radixenc container. */
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

export const FILE_EXTENSION = '.radixenc';

/** DataChannel binary frame size (safe cross-browser SCTP message size). */
export const WIRE_FRAME_SIZE = 64 * 1024;

export const IDB_NAME = 'radix-cipher';

/** Local copies of transferred files are dropped after this long. */
export const IDB_TTL_MS = 24 * 60 * 60 * 1000;
