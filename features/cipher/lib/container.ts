/**
 * The .radixenc container format:
 *
 *   offset 0        magic "RDXENC01"            (8 bytes ASCII)
 *   offset 8        header length               (uint32 BE, ≤ MAX_HEADER_BYTES)
 *   offset 12       header JSON (canonical)     (headerLength bytes UTF-8)
 *   offset 12+len   chunk 0 … chunk N-1         (chunkSize + 16-byte GCM tag each)
 *
 * Per-chunk IV = baseIv (8 bytes) || chunk index (uint32 BE) — never reused
 * because the key (via fileSalt) is unique per file. Per-chunk AAD binds the
 * header hash, the chunk index and a last-chunk flag, so reordering,
 * cross-file substitution, truncation and header tampering all fail the tag.
 */
import { blake2b256Hex, canonicalJSON } from '@/features/sign/lib/hash';
import {
  CHUNK_SIZE,
  CIPHER_CONTEXT,
  CIPHER_MAGIC,
  GCM_TAG_BYTES,
  MAX_HEADER_BYTES,
} from '../constants/cipher';
import type { CipherHeader, ContainerHead } from '../types/cipher.types';

export interface BuildHeaderInput {
  fileSalt: string;
  baseIv: string;
  fileSize: number;
  fileName: string;
  mimeType: string;
  senderAccount: string;
  senderPublicKey: string;
  networkId: number;
  dAppDefinitionAddress: string;
  origin: string;
}

/** Chunks needed for a file; an empty file still gets one (empty) chunk so the
 *  container always carries at least one authenticated tag. */
export function chunkCountFor(fileSize: number, chunkSize = CHUNK_SIZE): number {
  return fileSize === 0 ? 1 : Math.ceil(fileSize / chunkSize);
}

export function buildHeader(input: BuildHeaderInput): CipherHeader {
  return {
    v: 1,
    context: CIPHER_CONTEXT,
    alg: 'AES-256-GCM',
    kdf: 'HKDF-SHA256',
    fileSalt: input.fileSalt,
    baseIv: input.baseIv,
    chunkSize: CHUNK_SIZE,
    chunkCount: chunkCountFor(input.fileSize),
    fileSize: input.fileSize,
    fileName: input.fileName,
    mimeType: input.mimeType,
    senderAccount: input.senderAccount,
    senderPublicKey: input.senderPublicKey,
    curve: 'curve25519',
    networkId: input.networkId,
    dAppDefinitionAddress: input.dAppDefinitionAddress,
    origin: input.origin,
    createdAt: new Date().toISOString(),
  };
}

/** Serialise magic + length + canonical header JSON; hash covers the JSON bytes. */
export function encodeContainerHead(header: CipherHeader): {
  bytes: Uint8Array;
  headerHash: string;
} {
  const json = new TextEncoder().encode(canonicalJSON(header));
  if (json.length > MAX_HEADER_BYTES) throw new Error('invalid_container');
  const bytes = new Uint8Array(12 + json.length);
  bytes.set(new TextEncoder().encode(CIPHER_MAGIC), 0);
  new DataView(bytes.buffer).setUint32(8, json.length, false);
  bytes.set(json, 12);
  return { bytes, headerHash: blake2b256Hex(json) };
}

function isCipherHeader(value: unknown): value is CipherHeader {
  if (!value || typeof value !== 'object') return false;
  const h = value as Record<string, unknown>;
  return (
    h.v === 1 &&
    h.context === CIPHER_CONTEXT &&
    h.alg === 'AES-256-GCM' &&
    h.kdf === 'HKDF-SHA256' &&
    typeof h.fileSalt === 'string' &&
    /^[0-9a-f]{64}$/.test(h.fileSalt) &&
    typeof h.baseIv === 'string' &&
    /^[0-9a-f]{16}$/.test(h.baseIv) &&
    typeof h.chunkSize === 'number' &&
    h.chunkSize > 0 &&
    typeof h.fileSize === 'number' &&
    h.fileSize >= 0 &&
    typeof h.chunkCount === 'number' &&
    h.chunkCount === chunkCountFor(h.fileSize as number, h.chunkSize as number) &&
    typeof h.fileName === 'string' &&
    typeof h.mimeType === 'string' &&
    typeof h.senderAccount === 'string' &&
    typeof h.senderPublicKey === 'string' &&
    h.curve === 'curve25519' &&
    typeof h.networkId === 'number' &&
    typeof h.dAppDefinitionAddress === 'string' &&
    typeof h.origin === 'string' &&
    typeof h.createdAt === 'string'
  );
}

/** Parse and validate a container head from raw bytes (≥ the full head). */
export function parseContainerHeadBytes(bytes: Uint8Array): ContainerHead {
  if (bytes.length < 12) throw new Error('invalid_container');
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== CIPHER_MAGIC) throw new Error('invalid_container');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(8, false);
  if (headerLength === 0 || headerLength > MAX_HEADER_BYTES) {
    throw new Error('invalid_container');
  }
  if (bytes.length < 12 + headerLength) throw new Error('invalid_container');
  const json = bytes.subarray(12, 12 + headerLength);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(json));
  } catch {
    throw new Error('invalid_container');
  }
  if (!isCipherHeader(parsed)) throw new Error('invalid_container');
  return {
    header: parsed,
    headerHash: blake2b256Hex(json),
    dataOffset: 12 + headerLength,
  };
}

/** Read just the head of a container Blob (never loads the ciphertext). */
export async function parseContainerHead(source: Blob): Promise<ContainerHead> {
  const headSlice = await source
    .slice(0, 12 + MAX_HEADER_BYTES)
    .arrayBuffer()
    .catch(() => {
      throw new Error('file_read');
    });
  return parseContainerHeadBytes(new Uint8Array(headSlice));
}

/** Total ciphertext bytes following the head. */
export function encryptedDataSize(header: CipherHeader): number {
  return header.fileSize + header.chunkCount * GCM_TAG_BYTES;
}

/** Plaintext byte range of chunk `index` within the original file. */
export function plainChunkRange(
  header: CipherHeader,
  index: number,
): { start: number; end: number } {
  const start = index * header.chunkSize;
  return { start, end: Math.min(header.fileSize, start + header.chunkSize) };
}

/** Ciphertext byte range of chunk `index` within the container. */
export function encryptedChunkRange(
  header: CipherHeader,
  dataOffset: number,
  index: number,
): { start: number; end: number } {
  const { start, end } = plainChunkRange(header, index);
  const encStart = dataOffset + start + index * GCM_TAG_BYTES;
  return { start: encStart, end: encStart + (end - start) + GCM_TAG_BYTES };
}

/** 96-bit IV for chunk `index`: baseIv (8 bytes) || index (uint32 BE). */
export function chunkIv(baseIvHex: string, index: number): Uint8Array {
  const iv = new Uint8Array(12);
  for (let i = 0; i < 8; i++) {
    iv[i] = parseInt(baseIvHex.slice(i * 2, i * 2 + 2), 16);
  }
  new DataView(iv.buffer).setUint32(8, index, false);
  return iv;
}

/** AAD for chunk `index`: headerHash (32 bytes) || index (uint32) || isLast. */
export function chunkAad(
  headerHashHex: string,
  index: number,
  isLast: boolean,
): Uint8Array {
  const aad = new Uint8Array(37);
  for (let i = 0; i < 32; i++) {
    aad[i] = parseInt(headerHashHex.slice(i * 2, i * 2 + 2), 16);
  }
  new DataView(aad.buffer).setUint32(32, index, false);
  aad[36] = isLast ? 1 : 0;
  return aad;
}
