/**
 * Streaming decryption: reads the container chunk by chunk (slice()) and
 * writes plaintext to a sink, so memory stays flat for any file size. A wrong
 * key or any tampering surfaces as Error('decrypt_failed') from the GCM tag.
 */
import { GCM_TAG_BYTES } from '../constants/cipher';
import type { CipherHeader, ContainerHead } from '../types/cipher.types';
import {
  chunkAad,
  chunkIv,
  encryptedChunkRange,
  encryptedDataSize,
  parseContainerHead,
} from './container';
import { importAesKey } from './keys';

export interface DecryptSink {
  write(bytes: Uint8Array): Promise<void> | void;
  close(): Promise<void> | void;
}

/** Collects plaintext parts in memory-light Blob form. */
export function createBlobSink(mimeType: string): DecryptSink & {
  result(): Blob;
} {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let blob: Blob | null = null;
  return {
    write(bytes: Uint8Array) {
      parts.push(bytes as Uint8Array<ArrayBuffer>);
    },
    close() {
      blob = new Blob(parts as BlobPart[], { type: mimeType || 'application/octet-stream' });
      parts.length = 0;
    },
    result() {
      if (!blob) throw new Error('unknown');
      return blob;
    },
  };
}

/** Streams plaintext straight to disk via the File System Access API. */
export async function createFileSystemSink(
  handle: FileSystemFileHandle,
): Promise<DecryptSink> {
  const writable = await handle.createWritable();
  return {
    write: (bytes) => writable.write(bytes as unknown as BufferSource),
    close: () => writable.close(),
  };
}

/**
 * Decrypt a chunk already extracted from a container. Exposed for receivers
 * that hold chunks individually (IndexedDB) rather than one contiguous Blob.
 */
export async function decryptChunkBytes(
  key: CryptoKey,
  header: CipherHeader,
  headerHash: string,
  index: number,
  cipherBytes: Uint8Array,
): Promise<Uint8Array> {
  try {
    const plain = await crypto.subtle.decrypt(
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
      cipherBytes as BufferSource,
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error('decrypt_failed');
  }
}

/**
 * Decrypt a full .radixenc Blob into `sink`. Returns the parsed head so the
 * caller can name/type the output. Throws Error('invalid_container') on a
 * malformed or truncated file and Error('decrypt_failed') on a bad key/tag.
 */
export async function decryptContainer(
  source: Blob,
  keyBits: Uint8Array,
  sink: DecryptSink,
  onProgress?: (fraction: number) => void,
): Promise<ContainerHead> {
  const head = await parseContainerHead(source);
  const { header, headerHash, dataOffset } = head;
  if (source.size !== dataOffset + encryptedDataSize(header)) {
    throw new Error('invalid_container');
  }

  const key = await importAesKey(keyBits);
  for (let index = 0; index < header.chunkCount; index++) {
    const { start, end } = encryptedChunkRange(header, dataOffset, index);
    const cipherBytes = await source
      .slice(start, end)
      .arrayBuffer()
      .catch(() => {
        throw new Error('file_read');
      });
    const plain = await decryptChunkBytes(
      key,
      header,
      headerHash,
      index,
      new Uint8Array(cipherBytes),
    );
    await sink.write(plain);
    onProgress?.((index + 1) / header.chunkCount);
  }
  await sink.close();
  return head;
}
