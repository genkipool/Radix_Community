// @vitest-environment node
/**
 * The agenda's "recent" tab reads who you have actually dealt with.
 *
 * The first attempt asked the Gateway for transactions filtered by the whole
 * wallet at once, and `affected_global_entities_filter` narrows to transactions
 * touching EVERY address listed, so it answered with nothing. One request per
 * account, merged, is what the explorer's own address search does.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gatewayPost = vi.fn();
vi.mock('@/services/gateway/bases', () => ({
  gatewayPost: (...args: unknown[]) => gatewayPost(...args),
}));

const { fetchRecentAddresses } = await import(
  '@/features/wallet/services/recentAddresses'
);

const MINE_A = 'account_tdx_2_1mine_a';
const MINE_B = 'account_tdx_2_1mine_b';
const FRIEND = 'account_tdx_2_1friend';
const OTHER = 'account_tdx_2_1other';

const tx = (at: string, entities: string[]) => ({
  confirmed_at: at,
  affected_global_entities: entities,
});

beforeEach(() => gatewayPost.mockReset());

describe('recent addresses', () => {
  it('asks once per account, never for all of them together', async () => {
    gatewayPost.mockResolvedValue({ items: [] });
    await fetchRecentAddresses({
      network: 'stokenet',
      accounts: [MINE_A, MINE_B],
    });
    expect(gatewayPost).toHaveBeenCalledTimes(2);
    for (const call of gatewayPost.mock.calls) {
      const body = call[2] as { affected_global_entities_filter: string[] };
      expect(body.affected_global_entities_filter).toHaveLength(1);
    }
  });

  it('keeps counterparties, drops your own accounts and non-accounts', async () => {
    gatewayPost.mockResolvedValue({
      items: [
        tx('2026-07-20T10:00:00Z', [
          MINE_A,
          FRIEND,
          'resource_tdx_2_1xrd',
          'component_tdx_2_1pool',
        ]),
      ],
    });
    const recent = await fetchRecentAddresses({
      network: 'stokenet',
      accounts: [MINE_A],
    });
    expect(recent.map((r) => r.address)).toEqual([FRIEND]);
  });

  it('orders by the most recent contact and counts repeats', async () => {
    gatewayPost.mockResolvedValue({
      items: [
        tx('2026-07-01T10:00:00Z', [MINE_A, FRIEND]),
        tx('2026-07-20T10:00:00Z', [MINE_A, OTHER]),
        tx('2026-07-05T10:00:00Z', [MINE_A, FRIEND]),
      ],
    });
    const recent = await fetchRecentAddresses({
      network: 'stokenet',
      accounts: [MINE_A],
    });
    expect(recent.map((r) => r.address)).toEqual([OTHER, FRIEND]);
    expect(recent.find((r) => r.address === FRIEND)?.count).toBe(2);
    // The newest of the two sightings is the one shown.
    expect(recent.find((r) => r.address === FRIEND)?.lastSeen.toISOString()).toBe(
      '2026-07-05T10:00:00.000Z',
    );
  });

  it('merges the same counterparty seen from two of your accounts', async () => {
    // One reply per account, each seeing the same counterparty.
    gatewayPost
      .mockResolvedValueOnce({ items: [tx('2026-07-20T10:00:00Z', [MINE_A, FRIEND])] })
      .mockResolvedValueOnce({ items: [tx('2026-07-21T10:00:00Z', [MINE_B, FRIEND])] });
    const recent = await fetchRecentAddresses({
      network: 'stokenet',
      accounts: [MINE_A, MINE_B],
    });
    expect(gatewayPost).toHaveBeenCalledTimes(2);
    expect(recent).toHaveLength(1);
    expect(recent[0].count).toBe(2);
    // Merged under the newest sighting of the two.
    expect(recent[0].lastSeen.toISOString()).toBe('2026-07-21T10:00:00.000Z');
  });

  it('asks only for the window requested, and caps the list', async () => {
    gatewayPost.mockResolvedValue({
      items: Array.from({ length: 80 }, (_, i) =>
        tx('2026-07-20T10:00:00Z', [MINE_A, `account_tdx_2_1n${i}`]),
      ),
    });
    const recent = await fetchRecentAddresses({
      network: 'stokenet',
      accounts: [MINE_A],
      days: 7,
      limit: 50,
    });
    expect(recent).toHaveLength(50);
    const body = gatewayPost.mock.calls[0][2] as {
      from_ledger_state: { timestamp: string };
    };
    const days = (Date.now() - Date.parse(body.from_ledger_state.timestamp)) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('says nothing when the wallet has no accounts, without calling out', async () => {
    expect(await fetchRecentAddresses({ network: 'stokenet', accounts: [] })).toEqual([]);
    expect(gatewayPost).not.toHaveBeenCalled();
  });
});
