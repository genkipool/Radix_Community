import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/redis', () => ({ getRedis: () => null }));
vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn() }));

import { isPastMaxStaleAge, MAX_STALE_AGE_MS } from '@/services/gateway/validators';

const NOW = 1_800_000_000_000;

describe('isPastMaxStaleAge', () => {
  it('serves a copy refreshed within the last half hour', () => {
    expect(MAX_STALE_AGE_MS).toBe(30 * 60 * 1000);
    expect(isPastMaxStaleAge(NOW - 5 * 60 * 1000, NOW)).toBe(false);
    expect(isPastMaxStaleAge(NOW - MAX_STALE_AGE_MS, NOW)).toBe(false);
  });

  it('rebuilds a copy left over from a quiet spell, or one with no timestamp', () => {
    expect(isPastMaxStaleAge(NOW - MAX_STALE_AGE_MS - 1, NOW)).toBe(true);
    expect(isPastMaxStaleAge(NOW - 9 * 60 * 60 * 1000, NOW)).toBe(true);
    expect(isPastMaxStaleAge(undefined, NOW)).toBe(true);
  });
});
