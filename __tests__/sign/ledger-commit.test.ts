import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The date a signature is printed with and the transaction id printed beside it
 * must be the SAME event. They used to be two lookups — a timestamp authority's
 * clock on the certificate, the ledger's on the explorer — and the signed PDF
 * ended up stating a time the transaction it points at contradicts.
 *
 * `ledgerCommit` is the single read behind both, so the pair cannot drift.
 */
const gatewayPost = vi.fn();
vi.mock('@/services/gateway/bases', () => ({
  gatewayPost: (...args: unknown[]) => gatewayPost(...args),
}));

const { ledgerCommit, ledgerTimestamp } = await import(
  '@/features/sign/lib/onchain-custody'
);

const STATE_VERSION = 812_345;
const CONFIRMED_AT = '2026-07-19T17:17:44.359Z';
const INTENT_HASH = 'txid_tdx_2_1mint00000000000000000000000000';

beforeEach(() => {
  gatewayPost.mockReset();
  // Always a real implementation: a mock left unimplemented between tests
  // returns undefined, which is a different failure from the one under test.
  gatewayPost.mockImplementation(async () => ({}));
});

describe('the commit behind a signature', () => {
  it('reads the time and the transaction id from one and the same item', async () => {
    gatewayPost.mockImplementation(async () => ({
      items: [
        {
          state_version: STATE_VERSION,
          confirmed_at: CONFIRMED_AT,
          intent_hash: INTENT_HASH,
        },
      ],
    }));
    expect(await ledgerCommit('stokenet', STATE_VERSION)).toEqual({
      confirmedAt: CONFIRMED_AT,
      intentHash: INTENT_HASH,
    });
    expect(await ledgerTimestamp('stokenet', STATE_VERSION)).toBe(CONFIRMED_AT);
  });

  it('falls back to the round timestamp when the commit time is absent', async () => {
    gatewayPost.mockImplementation(async () => ({
      items: [
        {
          state_version: STATE_VERSION,
          round_timestamp: CONFIRMED_AT,
          intent_hash: INTENT_HASH,
        },
      ],
    }));
    expect((await ledgerCommit('stokenet', STATE_VERSION)).confirmedAt).toBe(
      CONFIRMED_AT,
    );
  });

  it('reports nothing when the stream came back at another version', async () => {
    // Answering with a neighbouring transaction would date a signature from an
    // event that is not its own, and link the certificate to it.
    gatewayPost.mockImplementation(async () => ({
      items: [
        {
          state_version: STATE_VERSION + 1,
          confirmed_at: CONFIRMED_AT,
          intent_hash: INTENT_HASH,
        },
      ],
    }));
    expect(await ledgerCommit('stokenet', STATE_VERSION)).toEqual({
      confirmedAt: null,
      intentHash: null,
    });
  });

  it('reports nothing on a gateway failure or an unusable version', async () => {
    gatewayPost.mockImplementation(async () => {
      throw new Error('gateway down');
    });
    expect(await ledgerCommit('stokenet', STATE_VERSION)).toEqual({
      confirmedAt: null,
      intentHash: null,
    });
    expect(gatewayPost).toHaveBeenCalledTimes(1);
    // A version that cannot exist is not even asked about.
    expect(await ledgerCommit('stokenet', 0)).toEqual({
      confirmedAt: null,
      intentHash: null,
    });
    expect(gatewayPost).toHaveBeenCalledTimes(1);
  });
});
