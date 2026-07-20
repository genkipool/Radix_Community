// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  createChunkAssembler,
} from '@/features/cipher/lib/transfer';
import { parseSessionHash, randomRoomId } from '@/features/cipher/lib/session-url';

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes, including >32 KiB payloads', () => {
    const bytes = new Uint8Array(100_000);
    crypto.getRandomValues(bytes.subarray(0, 65536));
    crypto.getRandomValues(bytes.subarray(65536));
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('rejects malformed base64', () => {
    expect(() => base64ToBytes('%%%')).toThrow('invalid_container');
  });
});

describe('chunk assembler', () => {
  it('reassembles a chunk from multiple frames in order', () => {
    const assembler = createChunkAssembler();
    assembler.start(3, 10);
    expect(assembler.push(new Uint8Array([1, 2, 3, 4]).buffer)).toBeNull();
    expect(assembler.push(new Uint8Array([5, 6, 7]).buffer)).toBeNull();
    const done = assembler.push(new Uint8Array([8, 9, 10]).buffer);
    expect(done?.index).toBe(3);
    expect(done?.blob.size).toBe(10);
  });

  it('rejects frames without a chunk-start and overflow', () => {
    const assembler = createChunkAssembler();
    expect(() => assembler.push(new ArrayBuffer(1))).toThrow();
    assembler.start(0, 2);
    expect(() => assembler.push(new ArrayBuffer(3))).toThrow();
  });

  it('rejects a second start before the first chunk completes', () => {
    const assembler = createChunkAssembler();
    assembler.start(0, 4);
    expect(() => assembler.start(1, 4)).toThrow();
  });
});

describe('session url', () => {
  it('generates 32-hex room ids and parses its own hashes', () => {
    const roomId = randomRoomId();
    expect(roomId).toMatch(/^[0-9a-f]{32}$/);
    expect(parseSessionHash(`#m=receive&r=${roomId}`)).toEqual({
      mode: 'receive',
      roomId,
    });
    expect(parseSessionHash(`#m=unlock&r=${roomId}`)).toEqual({
      mode: 'unlock',
      roomId,
    });
  });

  it('rejects unknown modes, short ids and empty hashes', () => {
    expect(parseSessionHash('#m=other&r=' + 'a'.repeat(32))).toBeNull();
    expect(parseSessionHash('#m=receive&r=abc')).toBeNull();
    expect(parseSessionHash('')).toBeNull();
    expect(parseSessionHash('#foo=bar')).toBeNull();
  });
});
