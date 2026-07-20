/** Hard constants of the chat feature (part of the wire protocol — changing
 *  them breaks interop between peers on different versions). */

/** Domain-separation context mixed into the handshake ROLA challenge. */
export const CHAT_CONTEXT = 'radix-chat-v1' as const;

/** HKDF info prefix binding the session key to this feature and algorithm. */
export const CHAT_HKDF_INFO = 'radix-chat-v1/aes-gcm';

export const MAX_MESSAGE_CHARS = 4000;
