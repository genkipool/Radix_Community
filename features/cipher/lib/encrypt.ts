/**
 * Streaming encryption: the source Blob is read chunk by chunk via slice(), so
 * memory stays flat regardless of file size. Encrypted chunks are handed to a
 * sink (IndexedDB, a DataChannel, …) supplied by the caller.
 */
import { GCM_TAG_BYTES } from '../constants/cipher';
import type { CipherHeader } from '../types/cipher.types';
import { chunkAad, chunkIv, plainChunkRange } from './container';

export type EncryptedChunkSink = (
  index: number,
  bytes: Uint8Array,
) => Promise<void> | void;

/**
 * Encrypt `source` chunk by chunk into `writeChunk`. Progress is reported as a
 * fraction in [0, 1]. Throws Error('file_read') if the source can't be read.
 */
export async function encryptToSink(
  source: Blob,
  key: CryptoKey,
  header: CipherHeader,
  headerHash: string,
  writeChunk: EncryptedChunkSink,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  for (let index = 0; index < header.chunkCount; index++) {
    const { start, end } = plainChunkRange(header, index);
    const plain = await source
      .slice(start, end)
      .arrayBuffer()
      .catch(() => {
        throw new Error('file_read');
      });
    if (plain.byteLength !== end - start) throw new Error('file_read');

    const cipher = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: chunkIv(header.baseIv, index) as BufferSource,
        additionalData: chunkAad(
          headerHash,
          index,
          index === header.chunkCount - 1,
        ) as BufferSource,
        tagLength: GCM_TAG_BYTES * 8,
      },
      key,
      plain,
    );
    await writeChunk(index, new Uint8Array(cipher));
    onProgress?.((index + 1) / header.chunkCount);
  }
}
