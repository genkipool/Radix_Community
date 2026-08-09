/**
 * Which Gateway failures are worth a second attempt.
 *
 * Mainnet has bad seconds: a rate limit, a 502 from the edge, a socket that
 * dies mid-request. Retrying only 429s left the two commonest of those with no
 * second attempt, and one failed page was enough to turn a reload of the
 * staking or explorer view into "nothing found". A 4xx stays unretried: that
 * is the Gateway saying the request itself is wrong, and asking again only
 * loads a service that already refused.
 */
import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '@/services/gateway/client';

/** Fails `failures` times with `err`, then succeeds. Counts the attempts. */
function flaky(failures: number, err: unknown) {
  const state = { attempts: 0 };
  const fn = async () => {
    state.attempts += 1;
    if (state.attempts <= failures) throw err;
    return 'ok';
  };
  return { fn, state };
}

const httpError = (status: number) =>
  Object.assign(new Error(`Gateway ${status}`), { status });

describe('retrying a Gateway call', () => {
  it('retries a rate limit', async () => {
    const { fn, state } = flaky(1, httpError(429));
    await expect(withRetry(fn, 3)).resolves.toBe('ok');
    expect(state.attempts).toBe(2);
  });

  it('retries a server error, which it used to give up on', async () => {
    const { fn, state } = flaky(2, httpError(502));
    await expect(withRetry(fn, 3)).resolves.toBe('ok');
    expect(state.attempts).toBe(3);
  });

  it('retries a dropped connection', async () => {
    const { fn, state } = flaky(1, new TypeError('fetch failed'));
    await expect(withRetry(fn, 3)).resolves.toBe('ok');
    expect(state.attempts).toBe(2);
  });

  it('does not retry a bad request', async () => {
    const { fn, state } = flaky(1, httpError(400));
    await expect(withRetry(fn, 3)).rejects.toThrow('Gateway 400');
    expect(state.attempts).toBe(1);
  });

  it('gives up after the last attempt and reports the failure', async () => {
    const { fn, state } = flaky(99, httpError(503));
    await expect(withRetry(fn, 2)).rejects.toThrow('Gateway 503');
    expect(state.attempts).toBe(3); // the first call plus two retries
  });

  it('waits as long as a rate limit asks it to', async () => {
    vi.useFakeTimers();
    try {
      const err = Object.assign(new Error('Gateway 429'), {
        status: 429,
        headers: { 'retry-after': '2' },
      });
      const { fn, state } = flaky(1, err);
      const settled = withRetry(fn, 3);
      await vi.advanceTimersByTimeAsync(1_900);
      expect(state.attempts).toBe(1);
      await vi.advanceTimersByTimeAsync(200);
      await expect(settled).resolves.toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });
});
