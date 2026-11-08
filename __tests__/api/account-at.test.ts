// @vitest-environment node
/**
 * A Babylon account at the end of a day: every read pinned to the day's ledger
 * state, LSUs valued at the validator's rate THEN, claim NFTs split into
 * unstaking or claimable by the epoch THEN.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/services/gateway/bases', async (orig) => ({ ...(await orig<typeof import('@/services/gateway/bases')>()), gatewayPost: post }));
vi.mock('@/services/gateway/client', () => ({ withRetry: (f: () => unknown) => f() }));

import { dayIsReadable, readAccountAtDay } from '@/services/gateway/accountAt';

const ACC = 'account_rdx1test';
const LSU = 'resource_rdx1lsu';
const CLAIM = 'resource_rdx1claim';
const nft = (id: string, amount: string, epoch: string) => ({
  non_fungible_id: id,
  data: { programmatic_json: { fields: [{ field_name: 'claim_epoch', value: epoch }, { field_name: 'claim_amount', value: amount }] } },
});

beforeEach(() => {
  post.mockReset();
  post.mockImplementation(async (_n: string, path: string, body: Record<string, unknown>) => {
    if (path === '/state/entity/details' && (body.addresses as string[])[0] === ACC) {
      return {
        ledger_state: { state_version: 500, epoch: 100, proposer_round_timestamp: '2024-06-30T23:59:59Z' },
        items: [{
          address: ACC,
          fungible_resources: { items: [{ resource_address: LSU, vaults: { items: [{ amount: '10' }] } }] },
          non_fungible_resources: { items: [{ resource_address: CLAIM, vaults: { items: [{ items: ['#1#', '#2#'] }] } }] },
        }],
      };
    }
    if (path === '/state/validators/list') {
      return { validators: { items: [{ address: 'validator_rdx1v', stake_vault: { balance: '300' }, state: { stake_unit_resource_address: LSU, claim_token_resource_address: CLAIM }, metadata: { items: [{ key: 'name', value: { typed: { value: 'Node' } } }] } }] } };
    }
    if (path === '/state/entity/details') return { items: [{ address: LSU, details: { total_supply: '200' } }] };
    if (path === '/state/non-fungible/data') return { non_fungible_ids: [nft('#1#', '7', '150'), nft('#2#', '3', '90')] };
    throw new Error(`unexpected ${path}`);
  });
});

describe('readAccountAtDay', () => {
  it('pins every read to the day and values the stake then', async () => {
    const r = await readAccountAtDay(ACC, '2024-06-30', 'mainnet');
    expect(post.mock.calls[0][2]).toMatchObject({ at_ledger_state: { timestamp: '2024-06-30T23:59:59.999Z' } });
    for (const call of post.mock.calls.slice(1)) expect(call[2]).toMatchObject({ at_ledger_state: { state_version: 500 } });
    // 10 LSU at 300 XRD / 200 LSU; the claim unlocking at epoch 150 > 100 is unstaking, the one at 90 claimable.
    expect(r.stakingRows).toEqual([{ validatorAddress: 'validator_rdx1v', validatorName: 'Node', validatorIcon: '', xrdInStake: 15, xrdInUnstake: 7, xrdInClaim: 3, unstakes: [{ amount: 7, epoch: 150 }] }]);
    expect(r.entity).toMatchObject({ address: ACC, ledger_state: { state_version: 500 } });
  });

  it('reads today at the current state, since its end is still to come', async () => {
    await readAccountAtDay(ACC, new Date().toISOString().slice(0, 10), 'mainnet');
    expect(post.mock.calls[0][2]).not.toHaveProperty('at_ledger_state');
  });
});

describe('dayIsReadable', () => {
  it('accepts Babylon days up to today and nothing else', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(dayIsReadable('2023-09-28', now)).toBe(true);
    expect(dayIsReadable('2026-11-08', now)).toBe(true);
    expect(dayIsReadable('2023-09-27', now)).toBe(false);
    expect(dayIsReadable('2026-11-09', now)).toBe(false);
    expect(dayIsReadable('2024-13-01', now)).toBe(false);
    expect(dayIsReadable('yesterday', now)).toBe(false);
  });
});
