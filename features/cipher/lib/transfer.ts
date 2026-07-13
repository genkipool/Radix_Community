/**
 * Application protocol on top of the DataChannel: JSON control messages plus
 * raw binary frames. Each encrypted chunk is announced with `chunk-start`
 * (index + byte length) and then streamed in WIRE_FRAME_SIZE frames; the
 * channel is ordered and reliable, so no per-frame header is needed.
 */
import { WIRE_FRAME_SIZE } from '../constants/cipher';
import type { CipherPeer } from './peer';

export { base64ToBytes, bytesToBase64 } from '@/features/p2p/lib/encoding';
import { bytesToBase64 } from '@/features/p2p/lib/encoding';

/**
 * Stream every encrypted chunk to the peer. `getChunkBlob` pulls chunks one
 * at a time (from IndexedDB), so memory stays flat for any file size.
 */
export async function sendEncryptedFile(
  peer: CipherPeer,
  headBytes: Uint8Array,
  chunkCount: number,
  getChunkBlob: (index: number) => Promise<Blob | undefined>,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  peer.sendMessage({ t: 'meta', headB64: bytesToBase64(headBytes) });
  for (let index = 0; index < chunkCount; index++) {
    const blob = await getChunkBlob(index);
    if (!blob) throw new Error('unknown');
    const buf = await blob.arrayBuffer();
    peer.sendMessage({ t: 'chunk-start', index, byteLength: buf.byteLength });
    for (let offset = 0; offset < buf.byteLength; offset += WIRE_FRAME_SIZE) {
      await peer.sendBinary(
        buf.slice(offset, Math.min(buf.byteLength, offset + WIRE_FRAME_SIZE)),
      );
    }
    onProgress?.((index + 1) / chunkCount);
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
  };
}
