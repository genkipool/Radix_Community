import { describe, expect, it } from 'vitest';

import { fetchLockerActivity } from '@/features/console/lib/locker-lookup';

const LOCKER = 'locker_x';
const event = (name: string, claimant?: string) => ({
  name,
  emitter: { entity: { entity_address: LOCKER } },
  data: { fields: claimant ? [{ field_name: 'claimant', value: claimant }] : [] },
});

const tx = (fungible: Array<[string, string]>, events: ReturnType<typeof event>[] = [], nft?: { added?: string[]; removed?: string[] }) => ({
  balance_changes: {
    fungible_balance_changes: [
      ...fungible.map(([resource_address, balance_change]) => ({ entity_address: LOCKER, resource_address, balance_change })),
      // Someone else's change in the same transaction is not the locker's.
      { entity_address: 'account_other', resource_address: 'resource_a', balance_change: '-999' },
    ],
    non_fungible_balance_changes: nft ? [{ entity_address: LOCKER, resource_address: 'resource_nft', ...nft }] : [],
  },
  receipt: { events },
});

describe('fetchLockerActivity', () => {
  it('adds up what went in and out of the locker, and reads who it stored for', async () => {
    const items = [
      tx([['resource_a', '350.5']], [event('StoreEvent', 'account_1'), event('StoreEvent', 'account_2')]),
      tx([['resource_a', '-100.25'], ['resource_b', '-5']], [event('ClaimEvent'), event('RecoverEvent')]),
      tx([['resource_b', '5']], [event('StoreEvent', 'account_1')], { added: ['#1#', '#2#', '#3#'] }),
      tx([], [], { removed: ['#1#'] }),
    ];
    const post = async <T,>(): Promise<T> => ({ items, next_cursor: null }) as T;

    const activity = await fetchLockerActivity(post, LOCKER);
    expect(activity.fungibles).toEqual({ 'resource_a': '250.25' });
    expect(activity.nonFungibles).toEqual({ 'resource_nft': 2 });
    expect(activity).toMatchObject({ claimants: 2, stores: 3, claims: 1, recoveries: 1, transactions: 4, truncated: false });
  });

  it('stops after the page limit and says the history was cut', async () => {
    let calls = 0;
    const post = async <T,>(): Promise<T> => {
      calls++;
      return { items: [tx([['resource_a', '1']])], next_cursor: 'more' } as T;
    };
    const activity = await fetchLockerActivity(post, LOCKER, 2);
    expect(calls).toBe(2);
    expect(activity.truncated).toBe(true);
  });
});
