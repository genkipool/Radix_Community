import { describe, expect, it } from 'vitest';

import { findLedgerEntities } from '@/features/console/lib/ledger-entities';

const ACCOUNT = 'account_tdx_2_1example';
const MY_POOL = 'pool_tdx_2_1mine';
const NET_POOL = 'pool_tdx_2_1network';
const MY_LOCKER = 'locker_tdx_2_1mine';

/** A fake Gateway: the account stream touches a pool and a locker, the class stream another pool. */
function fakeGateway(fail: string[] = []) {
  const calls: Record<string, unknown>[] = [];
  const post = async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
    calls.push({ path, ...body });
    if (path === '/stream/transactions') {
      const filter = body.affected_global_entities_filter as string[] | undefined;
      const cls = (body.manifest_class_filter as { class: string } | undefined)?.class;
      if (cls && fail.includes(cls)) throw new Error('rate limited');
      const entities = filter ? [ACCOUNT, MY_POOL, MY_LOCKER, 'resource_tdx_2_1x'] : cls ? [NET_POOL, MY_POOL] : [];
      return { items: [{ affected_global_entities: entities }], next_cursor: null } as T;
    }
    const addresses = body.addresses as string[];
    return {
      items: addresses.map((address) => ({
        address,
        metadata: { items: address === NET_POOL ? [{ key: 'name', value: { typed: { value: 'Network pool' } } }] : [] },
      })),
    } as T;
  };
  return { post, calls };
}

describe('findLedgerEntities', () => {
  it('lists what the accounts touched first, then pools active on the network', async () => {
    const { post } = fakeGateway();
    const found = await findLedgerEntities(post, { accounts: [ACCOUNT], kinds: ['pool', 'locker'] });
    expect(found.slice(0, 2).map((e) => [e.address, e.kind, e.mine])).toEqual(
      expect.arrayContaining([
        [MY_LOCKER, 'locker', true],
        [MY_POOL, 'pool', true],
      ]),
    );
    expect(found[2]).toMatchObject({ address: NET_POOL, kind: 'pool', mine: false });
    expect(found.find((e) => e.address === NET_POOL)?.name).toBe('Network pool');
  });

  it('only asks for lockers when only lockers are wanted', async () => {
    const { post, calls } = fakeGateway();
    const found = await findLedgerEntities(post, { accounts: [ACCOUNT], kinds: ['locker'] });
    expect(found.map((e) => e.address)).toEqual([MY_LOCKER]);
    expect(calls.some((c) => c.manifest_class_filter)).toBe(false);
  });

  it('skips the network-wide reads with networkPages 0 (the server caches those)', async () => {
    const { post, calls } = fakeGateway();
    const found = await findLedgerEntities(post, { accounts: [ACCOUNT], kinds: ['pool', 'locker'], networkPages: 0 });
    expect(found.map((e) => e.mine)).toEqual([true, true]);
    expect(calls.some((c) => c.manifest_class_filter)).toBe(false);
  });

  it('finds only network activity with no accounts', async () => {
    const { post } = fakeGateway();
    const found = await findLedgerEntities(post, { accounts: [], kinds: ['pool'] });
    expect(found.map((e) => [e.address, e.mine])).toEqual([
      [NET_POOL, false],
      [MY_POOL, false],
    ]);
  });

  it('keeps what other sources found when one fails', async () => {
    const { post } = fakeGateway(['PoolContribution', 'PoolRedemption']);
    const found = await findLedgerEntities(post, { accounts: [ACCOUNT], kinds: ['pool'] });
    expect(found.map((e) => e.address)).toEqual([MY_POOL]);
  });
});
