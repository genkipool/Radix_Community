// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildHeader,
  chunkCountFor,
  encodeContainerHead,
  encryptedChunkRange,
  encryptedDataSize,
  parseContainerHead,
  parseContainerHeadBytes,
} from '@/features/cipher/lib/container';
import { encryptToSink } from '@/features/cipher/lib/encrypt';
import {
  createBlobSink,
  decryptChunkBytes,
  decryptContainer,
} from '@/features/cipher/lib/decrypt';
import { deriveFileKeyBits, importAesKey } from '@/features/cipher/lib/keys';
import { CHUNK_SIZE } from '@/features/cipher/constants/cipher';
import type { CipherHeader } from '@/features/cipher/types/cipher.types';

const SALT = '11'.repeat(32);
const SIGNATURE = '22'.repeat(64);

function makeHeader(fileSize: number): CipherHeader {
  return buildHeader({
    fileSalt: SALT,
    baseIv: '33'.repeat(8),
    fileSize,
    fileName: 'contrato.pdf',
    mimeType: 'application/pdf',
    senderAccount: 'account_rdx1qsp0000000000000000000000000000000000000000000000',
    senderPublicKey: '44'.repeat(32),
    networkId: 1,
    dAppDefinitionAddress: 'account_rdx1dapp',
    origin: 'https://example.test',
  });
}

/** Encrypt `plain` into a full container and return its bytes + head. */
async function encryptWhole(plain: Uint8Array) {
  const header = makeHeader(plain.length);
  const { bytes: head, headerHash } = encodeContainerHead(header);
  const key = await importAesKey(await deriveFileKeyBits(SIGNATURE, SALT));
  const chunks: Uint8Array[] = [];
  await encryptToSink(
    new Blob([plain as Uint8Array<ArrayBuffer>]),
    key,
    header,
    headerHash,
    (index, bytes) => {
      chunks[index] = bytes;
    },
  );
  const container = new Blob(
    [head, ...chunks] as BlobPart[],
    { type: 'application/octet-stream' },
  );
  return { header, headerHash, head, chunks, container, key };
}

async function decryptWhole(container: Blob) {
  const sink = createBlobSink('application/pdf');
  const head = await decryptContainer(
    container,
    await deriveFileKeyBits(SIGNATURE, SALT),
    sink,
  );
  return { head, plain: new Uint8Array(await sink.result().arrayBuffer()) };
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += 65536) {
    crypto.getRandomValues(out.subarray(offset, Math.min(length, offset + 65536)));
  }
  return out;
}

describe('container head', () => {
  it('encodes and parses back the same header', async () => {
    const header = makeHeader(1234);
    const { bytes, headerHash } = encodeContainerHead(header);
    const parsed = parseContainerHeadBytes(bytes);
    expect(parsed.header).toEqual(header);
    expect(parsed.headerHash).toBe(headerHash);
    expect(parsed.dataOffset).toBe(bytes.length);

    const fromBlob = await parseContainerHead(new Blob([bytes as Uint8Array<ArrayBuffer>]));
    expect(fromBlob.header).toEqual(header);
  });

  it('rejects a bad magic, truncation and tampered JSON', () => {
    const { bytes } = encodeContainerHead(makeHeader(10));
    const badMagic = bytes.slice();
    badMagic[0] ^= 0xff;
    expect(() => parseContainerHeadBytes(badMagic)).toThrow('invalid_container');
    expect(() => parseContainerHeadBytes(bytes.slice(0, 10))).toThrow('invalid_container');

    const badJson = bytes.slice();
    badJson[13] ^= 0xff;
    expect(() => parseContainerHeadBytes(badJson)).toThrow('invalid_container');
  });

  it('computes chunk counts, including the empty file', () => {
    expect(chunkCountFor(0)).toBe(1);
    expect(chunkCountFor(1)).toBe(1);
    expect(chunkCountFor(CHUNK_SIZE)).toBe(1);
    expect(chunkCountFor(CHUNK_SIZE + 1)).toBe(2);
  });
});

// Multi-MiB WebCrypto + Blob work is slow when the whole suite runs in
// parallel; give the heavy cases room to breathe.
const HEAVY_TIMEOUT = 30_000;

describe('encrypt → decrypt roundtrip', () => {
  it('round-trips a multi-chunk file byte for byte', { timeout: HEAVY_TIMEOUT }, async () => {
    const plain = randomBytes(2 * CHUNK_SIZE + 12345);
    const { container, header } = await encryptWhole(plain);
    expect(header.chunkCount).toBe(3);

    const { head, plain: out } = await decryptWhole(container);
    expect(head.header.fileName).toBe('contrato.pdf');
    expect(out).toEqual(plain);
  });

  it('round-trips an empty file', async () => {
    const { container } = await encryptWhole(new Uint8Array(0));
    const { plain } = await decryptWhole(container);
    expect(plain).toHaveLength(0);
  });

  it('fails with the wrong key', async () => {
    const { container } = await encryptWhole(randomBytes(1000));
    const sink = createBlobSink('');
    await expect(
      decryptContainer(container, await deriveFileKeyBits('99'.repeat(64), SALT), sink),
    ).rejects.toThrow('decrypt_failed');
  });
});

describe('tamper resistance (AAD)', () => {
  it('rejects a chunk decrypted at the wrong index', { timeout: HEAVY_TIMEOUT }, async () => {
    const { chunks, header, headerHash, key } = await encryptWhole(
      randomBytes(2 * CHUNK_SIZE),
    );
    await expect(
      decryptChunkBytes(key, header, headerHash, 1, chunks[0]),
    ).rejects.toThrow('decrypt_failed');
  });

  it('rejects swapped chunks inside the container', { timeout: HEAVY_TIMEOUT }, async () => {
    const plain = randomBytes(3 * CHUNK_SIZE);
    const { container, header } = await encryptWhole(plain);
    const bytes = new Uint8Array(await container.arrayBuffer());
    const dataOffset = bytes.length - encryptedDataSize(header);
    const a = encryptedChunkRange(header, dataOffset, 0);
    const b = encryptedChunkRange(header, dataOffset, 1);
    const tmp = bytes.slice(a.start, a.end);
    bytes.set(bytes.subarray(b.start, b.end), a.start);
    bytes.set(tmp, b.start);

    const sink = createBlobSink('');
    await expect(
      decryptContainer(new Blob([bytes]), await deriveFileKeyBits(SIGNATURE, SALT), sink),
    ).rejects.toThrow('decrypt_failed');
  });

  it('rejects a truncated container', { timeout: HEAVY_TIMEOUT }, async () => {
    const { container } = await encryptWhole(randomBytes(CHUNK_SIZE + 5));
    const truncated = container.slice(0, container.size - 3);
    const sink = createBlobSink('');
    await expect(
      decryptContainer(truncated, await deriveFileKeyBits(SIGNATURE, SALT), sink),
    ).rejects.toThrow('invalid_container');
  });

  it('rejects a flipped ciphertext byte', async () => {
    const { container } = await encryptWhole(randomBytes(1000));
    const bytes = new Uint8Array(await container.arrayBuffer());
    bytes[bytes.length - 1] ^= 0x01;
    const sink = createBlobSink('');
    await expect(
      decryptContainer(new Blob([bytes]), await deriveFileKeyBits(SIGNATURE, SALT), sink),
    ).rejects.toThrow('decrypt_failed');
  });
});
