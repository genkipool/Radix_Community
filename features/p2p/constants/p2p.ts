/** DataChannel backpressure thresholds shared by every P2P feature. */

/**
 * Pause sending when the DataChannel buffers more than this (1 MiB).
 *
 * Deliberately small. A sender that never awaits can hand `send()` megabytes
 * in a single tick; SCTP then transmits at line rate, which starves the ICE
 * consent checks that keep the connection alive and makes every progress
 * report a lie (the bytes are queued, not delivered). 1 MiB is far more than
 * enough to keep the pipe saturated — the next frames are always ready before
 * the buffer empties — while bounding the burst and the lag between "sent" and
 * "arrived".
 */
export const BUFFERED_HIGH = 1 << 20;

/** Resume sending when the buffered amount drains below this (256 KiB). */
export const BUFFERED_LOW = 1 << 18;
