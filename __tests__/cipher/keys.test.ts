// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildChallengePayload,
  deriveCipherChallenge,
  deriveFileKeyBits,
  hexToBytes,
  toHex,
} from '@/features/cipher/lib/keys';

const SALT = 'ab'.repeat(32);
const SIGNATURE = 'cd'.repeat(64);

describe('cipher challenge', () => {
  it('is deterministic and independent of key insertion order', () => {
    const a = deriveCipherChallenge(buildChallengePayload(SALT, 1));
    const b = deriveCipherChallenge({
      networkId: 1,
      fileSalt: SALT,
      context: 'radix-cipher-v1',
      v: 1,
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes with salt and network', () => {
    const base = deriveCipherChallenge(buildChallengePayload(SALT, 1));
    expect(deriveCipherChallenge(buildChallengePayload('ef'.repeat(32), 1))).not.toBe(base);
    expect(deriveCipherChallenge(buildChallengePayload(SALT, 2))).not.toBe(base);
  });
});

describe('deriveFileKeyBits', () => {
  it('derives 32 deterministic bytes', async () => {
    const a = await deriveFileKeyBits(SIGNATURE, SALT);
    const b = await deriveFileKeyBits(SIGNATURE, SALT);
    expect(a).toHaveLength(32);
    expect(toHex(a)).toBe(toHex(b));
  });

  it('differs when the signature or the salt differ', async () => {
    const base = toHex(await deriveFileKeyBits(SIGNATURE, SALT));
    expect(toHex(await deriveFileKeyBits('ee'.repeat(64), SALT))).not.toBe(base);
    expect(toHex(await deriveFileKeyBits(SIGNATURE, 'ef'.repeat(32)))).not.toBe(base);
  });
});

describe('hexToBytes', () => {
  it('round-trips with toHex and rejects malformed input', () => {
    expect(toHex(hexToBytes('00ff10'))).toBe('00ff10');
    expect(() => hexToBytes('abc')).toThrow('invalid_container');
    expect(() => hexToBytes('zz')).toThrow('invalid_container');
  });
});
