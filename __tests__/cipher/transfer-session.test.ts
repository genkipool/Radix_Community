// @vitest-environment node
/**
 * End-to-end exercise of the cipher wire protocol: the real sender
 * (sendEncryptedFile) against the real receiver state machine
 * (createReceiveTransfer), over a DataChannel simulated with the same
 * semantics as the browser's — ordered delivery, an asynchronous send buffer
 * and backpressure.
 *
 * The cases that used to break a multi-chunk transfer are the point here: a
 * link lost mid-file, and a progress report made before the bytes left the
 * buffer.
 */
import { describe, expect, it } from 'vitest';
import { BUFFERED_HIGH, BUFFERED_LOW } from '@/features/p2p/constants/p2p';
import { GCM_TAG_BYTES } from '@/features/cipher/constants/cipher';
import { buildHeader, encodeContainerHead, parseContainerHeadBytes } from '@/features/cipher/lib/container';
import {
  base64ToBytes,
  createReceiveTransfer,
  sendEncryptedFile,
  type ReceiveTransfer,
  type TransferStore,
} from '@/features/cipher/lib/transfer';
import type { CipherPeer } from '@/features/cipher/lib/peer';
import type { DataChannelMessage } from '@/features/cipher/types/cipher.types';

/**
 * A 3-chunk, multi-frame container — the shape that used to fail. Chunks are
 * shrunk to 96 KiB (the format allows any chunkSize; only the header must
 * agree with itself) so the test moves a few hundred KB instead of megabytes.
 */
const TEST_CHUNK_SIZE = 96 * 1024;
const FILE_SIZE = TEST_CHUNK_SIZE * 2 + 4096;

function buildTestContainer() {
  const base = buildHeader({
    fileSalt: 'a'.repeat(64),
    baseIv: 'b'.repeat(16),
    fileSize: FILE_SIZE,
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    senderAccount: 'account_tdx_2_1test',
    senderPublicKey: 'c'.repeat(64),
    networkId: 2,
    dAppDefinitionAddress: 'account_tdx_2_1dapp',
    origin: 'https://example.test',
  });
  const header = {
    ...base,
    chunkSize: TEST_CHUNK_SIZE,
    chunkCount: Math.ceil(FILE_SIZE / TEST_CHUNK_SIZE),
  };
  const { bytes: headBytes } = encodeContainerHead(header);
  // Chunk ciphertext: plaintext slice + GCM tag, exactly as encryptToSink writes.
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < header.chunkCount; index += 1) {
    const start = index * TEST_CHUNK_SIZE;
    const plain = Math.min(FILE_SIZE, start + TEST_CHUNK_SIZE) - start;
    const bytes = new Uint8Array(plain + GCM_TAG_BYTES);
    // Deterministic filler, so the reassembled bytes can be compared exactly.
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (index * 7 + i) % 251;
    chunks.push(bytes);
  }
  return { header, headBytes, chunks };
}

interface Wire {
  peer: CipherPeer;
  /** Bytes actually delivered to the far end. */
  delivered: number;
  /** Kill the channel, as a lost connection does mid-transfer. */
  drop(): void;
  /** Resolves once every queued item has been delivered (or the wire died). */
  settled(): Promise<void>;
}

/**
 * Ordered, asynchronous channel. Items are handed over one macrotask at a
 * time, so `bufferedAmount` behaves like the browser's: what `send()` accepted
 * is NOT what the peer has.
 */
function createWire(
  onMessage: (message: DataChannelMessage) => void,
  onBinary: (bytes: ArrayBuffer) => void,
): Wire {
  const queue: Array<() => void> = [];
  const sizes: number[] = [];
  let buffered = 0;
  let open = true;
  let pumping = false;
  let waiters: Array<() => void> = [];

  const wake = () => {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  };
  const idle = () =>
    new Promise<void>((resolve) => {
      waiters.push(resolve);
    });

  const pump = async () => {
    if (pumping) return;
    pumping = true;
    while (open && queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!open) break;
      const deliver = queue.shift()!;
      buffered -= sizes.shift()!;
      deliver();
      wake();
    }
    pumping = false;
    wake();
  };

  const enqueue = (bytes: number, deliver: () => void) => {
    buffered += bytes;
    sizes.push(bytes);
    queue.push(deliver);
    void pump();
  };

  const peer: CipherPeer = {
    sendMessage(message) {
      if (!open) return;
      const json = JSON.stringify(message);
      enqueue(json.length, () => onMessage(JSON.parse(json) as DataChannelMessage));
    },
    async sendBinary(bytes) {
      if (!open) throw new Error('peer_disconnected');
      if (buffered > BUFFERED_HIGH) {
        while (open && buffered > BUFFERED_LOW) await idle();
      }
      if (!open) throw new Error('peer_disconnected');
      const copy = bytes.slice(0);
      enqueue(copy.byteLength, () => {
        wire.delivered += copy.byteLength;
        onBinary(copy);
      });
    },
    bufferedAmount() {
      return buffered;
    },
    async flush() {
      if (!open) throw new Error('peer_disconnected');
      while (open && buffered > 0) await idle();
      if (!open) throw new Error('peer_disconnected');
    },
    close() {
      open = false;
      wake();
    },
  };

  const wire: Wire = {
    peer,
    delivered: 0,
    drop() {
      open = false;
      queue.length = 0;
      sizes.length = 0;
      buffered = 0;
      wake();
    },
    async settled() {
      while (open && (queue.length > 0 || pumping)) await idle();
    },
  };
  return wire;
}

/** In-memory stand-in for the receiver's IndexedDB. */
function createMemoryStore() {
  const chunks = new Map<number, Blob>();
  let complete = false;
  let begins = 0;
  const store: TransferStore = {
    async begin() {
      begins += 1;
      return 'file-1';
    },
    async write(_fileId, index, blob) {
      chunks.set(index, blob);
    },
    async finish() {
      complete = true;
    },
  };
  return {
    store,
    chunks,
    begins: () => begins,
    isComplete: () => complete,
    async bytes(): Promise<Uint8Array> {
      const ordered = [...chunks.entries()].sort((a, b) => a[0] - b[0]);
      const parts = await Promise.all(ordered.map(([, blob]) => blob.arrayBuffer()));
      const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const part of parts) {
        out.set(new Uint8Array(part), offset);
        offset += part.byteLength;
      }
      return out;
    },
  };
}

/**
 * Wire a receiver to a channel exactly as the hook does: every event through
 * one promise chain, in arrival order.
 */
function attach(transfer: ReceiveTransfer) {
  const errors: unknown[] = [];
  let queue: Promise<void> = Promise.resolve();
  const run = (task: () => Promise<unknown>) => {
    queue = queue.then(() => task().then(() => undefined)).catch((e) => {
      errors.push(e);
    });
  };
  return {
    errors,
    drain: () => queue,
    onMessage: (message: DataChannelMessage) => run(() => transfer.handleMessage(message)),
    onBinary: (bytes: ArrayBuffer) => run(() => transfer.handleBinary(bytes)),
  };
}

describe('cipher transfer over a simulated DataChannel', () => {
  it('delivers a multi-chunk container byte for byte', async () => {
    const { header, headBytes, chunks } = buildTestContainer();
    expect(header.chunkCount).toBe(3);

    const memory = createMemoryStore();
    const transfer = createReceiveTransfer(
      memory.store,
      parseContainerHeadBytes,
      base64ToBytes,
    );
    const sink = attach(transfer);
    const wire = createWire(sink.onMessage, sink.onBinary);

    await sendEncryptedFile(
      wire.peer,
      headBytes,
      header.chunkCount,
      async (index) => new Blob([chunks[index] as Uint8Array<ArrayBuffer>]),
      { totalBytes: FILE_SIZE + header.chunkCount * GCM_TAG_BYTES },
    );
    await wire.peer.flush();
    await wire.settled();
    await sink.drain();

    expect(sink.errors).toEqual([]);
    expect(transfer.complete).toBe(true);
    expect(transfer.receivedChunks).toBe(3);
    expect(memory.isComplete()).toBe(true);

    const expected = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      expected.set(chunk, offset);
      offset += chunk.length;
    }
    expect(await memory.bytes()).toEqual(expected);
  });

  it('never reports progress for bytes still sitting in the send buffer', async () => {
    const { header, headBytes, chunks } = buildTestContainer();
    const totalBytes = FILE_SIZE + header.chunkCount * GCM_TAG_BYTES;
    const memory = createMemoryStore();
    const transfer = createReceiveTransfer(memory.store, parseContainerHeadBytes, base64ToBytes);
    const sink = attach(transfer);
    const wire = createWire(sink.onMessage, sink.onBinary);

    const reports: number[] = [];
    await sendEncryptedFile(
      wire.peer,
      headBytes,
      header.chunkCount,
      async (index) => new Blob([chunks[index] as Uint8Array<ArrayBuffer>]),
      {
        totalBytes,
        onProgress: (fraction) => {
          reports.push(fraction);
          // The claim must never run ahead of what the peer actually has.
          expect(fraction * totalBytes).toBeLessThanOrEqual(wire.delivered + 1);
        },
      },
    );
    // 100% is the caller's to declare, after flush() and the receiver's receipt.
    expect(Math.max(...reports)).toBeLessThanOrEqual(0.99);
    expect(reports).toEqual([...reports].sort((a, b) => a - b));
  });

  it('resumes on a fresh channel from the chunks already stored', async () => {
    const { header, headBytes, chunks } = buildTestContainer();
    const totalBytes = FILE_SIZE + header.chunkCount * GCM_TAG_BYTES;
    const memory = createMemoryStore();
    const transfer = createReceiveTransfer(memory.store, parseContainerHeadBytes, base64ToBytes);

    // Round 1: the link dies as soon as the first chunk has landed.
    const first = attach(transfer);
    const wire1 = createWire(first.onMessage, first.onBinary);
    const sending = sendEncryptedFile(
      wire1.peer,
      headBytes,
      header.chunkCount,
      async (index) => new Blob([chunks[index] as Uint8Array<ArrayBuffer>]),
      { totalBytes },
    ).catch(() => undefined);
    while (transfer.receivedChunks < 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    wire1.drop();
    await sending;
    await first.drain();
    expect(first.errors).toEqual([]);
    expect(transfer.complete).toBe(false);

    // Round 2: same receiver, new channel, resuming where it stopped.
    transfer.resetPartial();
    const resumeFrom = transfer.receivedChunks;
    expect(resumeFrom).toBeGreaterThan(0);
    const second = attach(transfer);
    const wire2 = createWire(second.onMessage, second.onBinary);
    await sendEncryptedFile(
      wire2.peer,
      headBytes,
      header.chunkCount,
      async (index) => new Blob([chunks[index] as Uint8Array<ArrayBuffer>]),
      { startIndex: resumeFrom, totalBytes },
    );
    await wire2.peer.flush();
    await wire2.settled();
    await second.drain();

    expect(second.errors).toEqual([]);
    expect(transfer.complete).toBe(true);
    // The head was announced twice but only ever stored once.
    expect(memory.begins()).toBe(1);
    const expected = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      expected.set(chunk, offset);
      offset += chunk.length;
    }
    expect(await memory.bytes()).toEqual(expected);
  });

  it('asks to resume — not to fail — when the completion marker finds gaps', async () => {
    const { header, headBytes } = buildTestContainer();
    const memory = createMemoryStore();
    const transfer = createReceiveTransfer(memory.store, parseContainerHeadBytes, base64ToBytes);

    await transfer.handleMessage({
      t: 'meta',
      headB64: Buffer.from(headBytes).toString('base64'),
    });
    await expect(
      transfer.handleMessage({ t: 'transfer-complete', chunkCount: header.chunkCount }),
    ).rejects.toThrow('transfer_incomplete');
    // A chunk announced beyond what we hold is a gap, not a protocol error.
    await expect(
      transfer.handleMessage({ t: 'chunk-start', index: 2, byteLength: 10 }),
    ).rejects.toThrow('transfer_incomplete');
  });
});
