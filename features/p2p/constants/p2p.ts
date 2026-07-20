/** DataChannel backpressure thresholds shared by every P2P feature. */

/** Pause sending when the DataChannel buffers more than this. */
export const BUFFERED_HIGH = 8 << 20;

/** Resume sending when the buffered amount drains below this. */
export const BUFFERED_LOW = 1 << 20;
