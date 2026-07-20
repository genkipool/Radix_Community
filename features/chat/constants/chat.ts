/** Hard constants of the chat feature (part of the wire protocol — changing
 *  them breaks interop between peers on different versions). */

/** Domain-separation context mixed into the handshake ROLA challenge. */
export const CHAT_CONTEXT = 'radix-chat-v1' as const;

/** HKDF info prefix binding the session key to this feature and algorithm. */
export const CHAT_HKDF_INFO = 'radix-chat-v1/aes-gcm';

export const MAX_MESSAGE_CHARS = 4000;

/** Plaintext bytes per encrypted file frame on the DataChannel. */
export const FILE_FRAME_BYTES = 64 * 1024;

/**
 * Received frames buffer in memory up to this much before being flushed as
 * one IndexedDB record. Memory stays flat, so attachments have no size limit
 * beyond the browser's storage quota; local copies expire after 24 h
 * (the cipher store's retention).
 */
export const FILE_SPILL_BYTES = 1 << 20;
