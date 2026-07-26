/**
 * Application protocol on top of the DataChannel: JSON control messages plus
 * raw binary frames. Each encrypted chunk is announced with `chunk-start`
 * (index + byte length) and then streamed in WIRE_FRAME_SIZE frames; the
 * channel is ordered and reliable, so no per-frame header is needed.
 *
 * The transfer is RESUMABLE. Chunks land in the receiver's IndexedDB one by
 * one, and the receiver reports how many it already holds when a channel
 * opens (`hello.haveChunks`), so a connection lost mid-file continues where it
 * stopped instead of starting over — or failing outright, which is what a
 * single ICE hiccup used to do to every file bigger than one chunk.
 */
import { WIRE_FRAME_SIZE } from '../constants/cipher';
import type { ContainerHead, DataChannelMessage } from '../types/cipher.types';
import type { CipherPeer } from './peer';

export { base64ToBytes, bytesToBase64 } from '@/features/p2p/lib/encoding';
import { bytesToBase64 } from '@/features/p2p/lib/encoding';

export interface SendFileOptions {
  /** First chunk to stream; > 0 resumes a transfer the receiver half holds. */
  startIndex?: number;
  /** Ciphertext bytes before `startIndex` — already at the receiver. */
  bytesBefore?: number;
  /** Total ciphertext bytes of the container (head excluded). */
  totalBytes?: number;
  /**
   * Fraction in [0, 0.99] of bytes that actually LEFT the send buffer. Never
   * reaches 1: the last frames are still in flight when the loop ends, so only
   * the caller — after `flush()` and the receiver's receipt — may claim 100%.
   */
  onProgress?: (fraction: number) => void;
}

/**
 * Stream every encrypted chunk to the peer. `getChunkBlob` pulls chunks one
 * at a time (from IndexedDB), so memory stays flat for any file size.
 */
export async function sendEncryptedFile(
  peer: CipherPeer,
  headBytes: Uint8Array,
  chunkCount: number,
  getChunkBlob: (index: number) => Promise<Blob | undefined>,
  options: SendFileOptions = {},
): Promise<void> {
  const { startIndex = 0, bytesBefore = 0, totalBytes = 0, onProgress } = options;
  peer.sendMessage({ t: 'meta', headB64: bytesToBase64(headBytes) });

  let enqueued = 0;
  let lastReported = -1;
  const report = () => {
    if (!onProgress || totalBytes <= 0) return;
    // What is on the wire, not what was handed to send(): the buffer holds
    // back up to BUFFERED_HIGH bytes that have NOT reached the receiver.
    const onWire = bytesBefore + enqueued - peer.bufferedAmount();
    const fraction = Math.min(0.99, Math.max(0, onWire / totalBytes));
    // Monotonic and throttled to whole percent steps, to keep renders cheap.
    if (Math.floor(fraction * 100) <= lastReported) return;
    lastReported = Math.floor(fraction * 100);
    onProgress(fraction);
  };

  // Read the next chunk from IndexedDB WHILE the current one streams. Without
  // the lookahead the wire went idle at every chunk boundary, waiting on a
  // 1 MiB read plus its copy — a stutter every megabyte, and dead air on a
  // link that is happier being fed steadily.
  const read = async (index: number): Promise<ArrayBuffer> => {
    const blob = await getChunkBlob(index);
    if (!blob) throw new Error('unknown');
    return blob.arrayBuffer();
  };
  let pending: Promise<ArrayBuffer> | null =
    startIndex < chunkCount ? read(startIndex) : null;

  for (let index = startIndex; index < chunkCount; index++) {
    const buf = await pending!;
    pending = index + 1 < chunkCount ? read(index + 1) : null;
    // A failed lookahead must not surface as an unhandled rejection if the
    // loop aborts first; the next iteration re-throws it properly.
    pending?.catch(() => undefined);
    peer.sendMessage({ t: 'chunk-start', index, byteLength: buf.byteLength });
    for (let offset = 0; offset < buf.byteLength; offset += WIRE_FRAME_SIZE) {
      const end = Math.min(buf.byteLength, offset + WIRE_FRAME_SIZE);
      await peer.sendBinary(buf.slice(offset, end));
      enqueued += end - offset;
      report();
    }
  }
  peer.sendMessage({ t: 'transfer-complete', chunkCount });
}

/**
 * Receiving half: accumulates binary frames into the chunk announced by the
 * last `chunk-start`. Pure state machine — testable without a DataChannel.
 */
export interface ChunkAssembler {
  start(index: number, byteLength: number): void;
  /** Returns the finished chunk when the last expected frame arrives. */
  push(frame: ArrayBuffer): { index: number; blob: Blob } | null;
  /** Forget a half-received chunk (a reconnect re-sends it whole). */
  reset(): void;
}

export function createChunkAssembler(): ChunkAssembler {
  let index = -1;
  let expected = 0;
  let received = 0;
  let parts: ArrayBuffer[] = [];

  return {
    start(nextIndex, byteLength) {
      if (index !== -1) throw new Error('unknown');
      index = nextIndex;
      expected = byteLength;
      received = 0;
      parts = [];
    },
    push(frame) {
      if (index === -1) throw new Error('unknown');
      parts.push(frame);
      received += frame.byteLength;
      if (received < expected) return null;
      if (received > expected) throw new Error('unknown');
      const chunk = { index, blob: new Blob(parts) };
      index = -1;
      parts = [];
      return chunk;
    },
    reset() {
      index = -1;
      expected = 0;
      received = 0;
      parts = [];
    },
  };
}

/** Where a receiving transfer persists what it has received so far. */
export interface TransferStore {
  /**
   * Prepare (or reuse) local storage for this container and return its file
   * id. MUST be idempotent: a resumed transfer re-announces the same head and
   * has to land on the same file, keeping the chunks already stored.
   */
  begin(head: ContainerHead, headBytes: Uint8Array): Promise<string>;
  write(fileId: string, index: number, blob: Blob): Promise<void>;
  /** Mark the container whole; the ciphertext is now usable. */
  finish(fileId: string, chunkCount: number): Promise<void>;
}

export interface TransferEvents {
  /** The container head arrived (first connection only). */
  onHead?(head: ContainerHead, fileId: string, headB64: string): void;
  onProgress?(receivedChunks: number, chunkCount: number): void;
  /** Every chunk is stored and the container is marked complete. */
  onComplete?(fileId: string, head: ContainerHead): void;
}

export interface ReceiveTransfer {
  /** Contiguous chunks already stored — where a reconnect must resume. */
  readonly receivedChunks: number;
  readonly fileId: string | null;
  readonly head: ContainerHead | null;
  readonly complete: boolean;
  /** Drop the half-received chunk; call before resuming on a fresh channel. */
  resetPartial(): void;
  /** True when the message belonged to the transfer protocol. */
  handleMessage(message: DataChannelMessage): Promise<boolean>;
  handleBinary(bytes: ArrayBuffer): Promise<void>;
}

/**
 * Receiver-side transfer state machine. Completion is driven by the DATA (the
 * last chunk landing), not by the `transfer-complete` marker, so a marker that
 * arrives after a resumed run — or not at all — can neither fake nor block a
 * finished file. A marker that finds the file short throws
 * `transfer_incomplete`, the signal to reconnect and resume.
 *
 * Callers must serialise: every method is async and the wire is ordered.
 */
export function createReceiveTransfer(
  store: TransferStore,
  parseHead: (bytes: Uint8Array) => ContainerHead,
  base64: (b64: string) => Uint8Array,
  events: TransferEvents = {},
): ReceiveTransfer {
  const assembler = createChunkAssembler();
  let fileId: string | null = null;
  let head: ContainerHead | null = null;
  let headB64: string | null = null;
  let receivedChunks = 0;
  let complete = false;

  const finishIfWhole = async (): Promise<void> => {
    if (!head || !fileId || complete) return;
    if (receivedChunks < head.header.chunkCount) return;
    complete = true;
    await store.finish(fileId, head.header.chunkCount);
    events.onComplete?.(fileId, head);
  };

  return {
    get receivedChunks() {
      return receivedChunks;
    },
    get fileId() {
      return fileId;
    },
    get head() {
      return head;
    },
    get complete() {
      return complete;
    },

    resetPartial() {
      assembler.reset();
    },

    async handleMessage(message) {
      if (message.t === 'meta') {
        // A resumed transfer re-announces the same head: keep the chunks we
        // already stored instead of starting a second, empty file.
        if (headB64 === message.headB64) return true;
        if (headB64) throw new Error('header_mismatch');
        const headBytes = base64(message.headB64);
        const parsed = parseHead(headBytes);
        headB64 = message.headB64;
        head = parsed;
        fileId = await store.begin(parsed, headBytes);
        events.onHead?.(parsed, fileId, message.headB64);
        events.onProgress?.(receivedChunks, parsed.header.chunkCount);
        return true;
      }
      if (message.t === 'chunk-start') {
        // The sender may re-send a chunk we already have (an older sender
        // ignores `hello`): accept it, the store just overwrites.
        if (message.index > receivedChunks) throw new Error('transfer_incomplete');
        assembler.start(message.index, message.byteLength);
        return true;
      }
      if (message.t === 'transfer-complete') {
        if (!complete) throw new Error('transfer_incomplete');
        return true;
      }
      return false;
    },

    async handleBinary(bytes) {
      const chunk = assembler.push(bytes);
      if (!chunk || !fileId || !head) return;
      await store.write(fileId, chunk.index, chunk.blob);
      if (chunk.index === receivedChunks) receivedChunks += 1;
      events.onProgress?.(receivedChunks, head.header.chunkCount);
      await finishIfWhole();
    },
  };
}
