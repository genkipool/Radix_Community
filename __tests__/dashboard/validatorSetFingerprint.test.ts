import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/redis', () => ({ getRedis: () => null }));
vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import {
  validatorSetFingerprint,
  type FingerprintSource,
} from '@/services/gateway/validatorSetFingerprint';

const validator = (address: string, overrides: Partial<FingerprintSource> & { name?: string; stake?: string } = {}) => {
  const { name = 'Validator', stake = '100', ...rest } = overrides;
  return {
    address,
    state: { is_registered: true, accepts_delegated_stake: true, public_key: { key_hex: `02${address}` } },
    effective_fee_factor: { current: { fee_factor: '0.02' } },
    metadata: { items: [{ key: 'name', value: { typed: { value: name } } }] },
    active_in_epoch: { stake },
    ...rest,
  } as FingerprintSource;
};

const base = [validator('a'), validator('b')];
const fingerprint = validatorSetFingerprint(base);

describe('validatorSetFingerprint', () => {
  it('does not depend on the order the Gateway pages come in', () => {
    expect(validatorSetFingerprint([base[1], base[0]])).toBe(fingerprint);
  });

  it('moves when a validator is created', () => {
    expect(validatorSetFingerprint([...base, validator('c')])).not.toBe(fingerprint);
  });

  it('moves when a validator registers, opens delegation, changes fee or renames', () => {
    const variants: FingerprintSource[] = [
      validator('a', { state: { is_registered: false, accepts_delegated_stake: true, public_key: { key_hex: '02a' } } }),
      validator('a', { state: { is_registered: true, accepts_delegated_stake: false, public_key: { key_hex: '02a' } } }),
      validator('a', { effective_fee_factor: { current: { fee_factor: '0.05' } } }),
      validator('a', { name: 'GENKIPOOL' }),
    ];
    for (const changed of variants) {
      expect(validatorSetFingerprint([changed, base[1]])).not.toBe(fingerprint);
    }
  });

  it('ignores stake, which moves every epoch and is what the caches are for', () => {
    expect(validatorSetFingerprint([validator('a', { stake: '999999' }), base[1]])).toBe(fingerprint);
  });
});
