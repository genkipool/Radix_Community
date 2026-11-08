import { describe, expect, it } from 'vitest';
import { olympiaValidatorConfig, olympiaValidatorMetadata } from '@/features/dashboard/explorador/olympia/OlympiaValidatorCard';
import type { OlympiaValidator } from '@/types/olympia';
import type { OlympiaDict } from '@/features/dashboard/explorador/olympia/dict';

const validator = (v: Partial<OlympiaValidator>): OlympiaValidator => ({
  address: 'rv1qtest', name: 'Node', url: 'https://example.org', feePercent: 2, isRegistered: true, allowDelegation: true,
  owner: 'rdx1qspowner', publicKey: '02'.padEnd(66, 'a'), totalStakedXrd: 1, delegators: 1, topDelegators: [],
  rewards: { delegatorsXrd: 0, ownerFeeXrd: 0, years: [] }, ...v,
});
const tt = { role_resolution_owner: 'Owner', role_resolution_allow_all: 'Allow All' };
const o = { role_node_key: 'Node key' } as unknown as OlympiaDict;

describe('Olympia validator tabs', () => {
  it('shows its name and web as unlocked metadata', () => {
    const items = olympiaValidatorMetadata(validator({}));
    expect(items.map((m) => m.key)).toEqual(['name', 'info_url']);
    expect(items.some((m) => m.is_locked)).toBe(false);
    expect(olympiaValidatorMetadata(validator({ name: null, url: null }))).toEqual([]);
  });

  it('gives changes to the node key, the fee to the owner, and staking to anyone while delegation is open', () => {
    const roles = olympiaValidatorConfig(validator({}), tt, o);
    expect(roles.find((r) => r.name === 'validator_update')).toMatchObject({ resolution: 'Node key', ruleAddress: '02'.padEnd(66, 'a') });
    expect(roles.find((r) => r.name === 'fee_receiver')).toMatchObject({ resolution: 'Owner', ruleAddress: 'rdx1qspowner' });
    expect(roles.find((r) => r.name === 'stake')?.resolution).toBe('Allow All');
  });

  it('keeps staking to the owner when delegation is closed', () => {
    const stake = olympiaValidatorConfig(validator({ allowDelegation: false }), tt, o).find((r) => r.name === 'stake');
    expect(stake).toMatchObject({ resolution: 'Owner', ruleAddress: 'rdx1qspowner' });
  });
});

describe('Olympia validator stake activity', async () => {
  const { lastDays, byMonth } = await import('@/features/dashboard/explorador/olympia/OlympiaValidatorCard');
  const activity = [
    { day: '2023-07-10', stake: 5, unstake: 0 },
    { day: '2023-09-27', stake: 100, unstake: 20 },
    { day: '2023-09-28', stake: 0, unstake: 7 },
  ];

  it('gives the last 30 days of Olympia, every day present', () => {
    const days = lastDays(activity, 30);
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toEqual({ date: '2023-09-28', stake: 0, unstake: 7, claim: 0 });
    expect(days.at(-2)).toMatchObject({ date: '2023-09-27', stake: 100, unstake: 20 });
    expect(days[0]).toMatchObject({ date: '2023-08-30', stake: 0, unstake: 0 });
  });

  it('adds up months from the first movement to the end of Olympia, empty months included', () => {
    const months = byMonth(activity);
    expect(months.map((m) => m.date.slice(0, 7))).toEqual(['2023-07', '2023-08', '2023-09']);
    expect(months[1]).toMatchObject({ stake: 0, unstake: 0 });
    expect(months[2]).toMatchObject({ stake: 100, unstake: 27 });
  });
});
