import { describe, expect, it } from 'vitest';
import {
  heldBadgeFor,
  isDrainable,
  parseAccessRule,
  parsePoolState,
  redemptionValue,
} from '@/features/console/lib/pool-lookup';

const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const TOKEN = 'resource_rdx1tkexampletokenxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const UNIT = 'resource_rdx1tkexamplepoolunitxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const BADGE = 'resource_rdx1tkexamplebadgexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const badgeRule = {
  type: 'Protected',
  access_rule: {
    type: 'ProofRule',
    proof_rule: { type: 'Require', requirement: { type: 'Resource', resource: BADGE } },
  },
};

/** Gateway entity details as /state/entity/details returns them for a pool. */
const poolDetails = (manager: unknown, owner: unknown, ownerUpdater = 'None') => ({
  address: 'pool_rdx1cexamplepoolxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  fungible_resources: {
    items: [
      { resource_address: TOKEN, vaults: { items: [{ amount: '10' }] } },
      { resource_address: XRD, vaults: { items: [{ amount: '1.5' }] } },
    ],
  },
  metadata: {
    items: [
      { key: 'pool_unit', value: { typed: { type: 'GlobalAddress', value: UNIT } } },
      { key: 'pool_resources', value: { typed: { type: 'GlobalAddressArray', values: [XRD, TOKEN] } } },
    ],
  },
  details: {
    type: 'Component',
    blueprint_name: 'TwoResourcePool',
    role_assignments: {
      owner: { rule: owner, updater: ownerUpdater },
      entries: [
        {
          role_key: { module: 'Main', name: 'pool_manager_role' },
          assignment: { resolution: 'Explicit', explicit_rule: manager },
        },
        { role_key: { module: 'Metadata', name: 'metadata_setter' }, assignment: { resolution: 'Owner' } },
      ],
    },
  },
});

describe('parsePoolState', () => {
  it('reads a drainable pool exactly as the console template used to create them', () => {
    const state = parsePoolState(poolDetails({ type: 'AllowAll' }, { type: 'AllowAll' }))!;
    expect(state.kind).toBe('two');
    expect(state.resources).toEqual([XRD, TOKEN]);
    expect(state.reserves).toEqual({ [XRD]: '1.5', [TOKEN]: '10' });
    expect(state.poolUnit).toBe(UNIT);
    expect(state.manager).toEqual({ type: 'allowAll' });
    expect(state.ownerUpdatable).toBe(false);
    expect(isDrainable(state)).toBe(true);
  });

  it('reads a badge-guarded pool', () => {
    const state = parsePoolState(poolDetails(badgeRule, badgeRule, 'Owner'))!;
    expect(state.manager).toEqual({ type: 'resource', resource: BADGE });
    expect(state.owner).toEqual({ type: 'resource', resource: BADGE });
    expect(state.ownerUpdatable).toBe(true);
    expect(isDrainable(state)).toBe(false);
  });

  it('resolves a manager role delegated to the owner', () => {
    const details = poolDetails(badgeRule, badgeRule);
    details.details.role_assignments.entries[0].assignment = { resolution: 'Owner' } as never;
    expect(parsePoolState(details)!.manager).toEqual({ type: 'resource', resource: BADGE });
  });

  it('returns null for anything that is not a native pool', () => {
    const details = poolDetails(badgeRule, badgeRule);
    details.details.blueprint_name = 'Account';
    expect(parsePoolState(details)).toBeNull();
  });
});

describe('parseAccessRule', () => {
  it('reads a single non-fungible requirement', () => {
    expect(
      parseAccessRule({
        type: 'Protected',
        access_rule: {
          type: 'ProofRule',
          proof_rule: {
            type: 'Require',
            requirement: { type: 'NonFungible', non_fungible: { resource_address: BADGE, local_id: { simple_rep: '#1#' } } },
          },
        },
      }),
    ).toEqual({ type: 'nonFungible', resource: BADGE, localId: '#1#' });
  });

  it('keeps composite rules readable but not actionable', () => {
    expect(parseAccessRule({ type: 'Protected', access_rule: { type: 'AnyOf', access_rules: [] } })).toEqual({ type: 'other' });
  });
});

describe('heldBadgeFor', () => {
  it('finds a fungible badge', () => {
    expect(heldBadgeFor({ type: 'resource', resource: BADGE }, [{ resourceAddress: BADGE }], [])).toEqual({ resource: BADGE });
  });

  it('names a non-fungible id when the badge resource is an NFT', () => {
    expect(
      heldBadgeFor({ type: 'resource', resource: BADGE }, [], [{ resourceAddress: BADGE, ids: ['#7#'] }]),
    ).toEqual({ resource: BADGE, localId: '#7#' });
  });

  it('requires the exact id for a single-NFT rule', () => {
    const rule = { type: 'nonFungible' as const, resource: BADGE, localId: '#1#' };
    expect(heldBadgeFor(rule, [], [{ resourceAddress: BADGE, ids: ['#2#'] }])).toBeNull();
    expect(heldBadgeFor(rule, [], [{ resourceAddress: BADGE, ids: ['#1#', '#2#'] }])).toEqual({ resource: BADGE, localId: '#1#' });
  });

  it('never claims a badge for AllowAll or composite rules', () => {
    expect(heldBadgeFor({ type: 'allowAll' }, [{ resourceAddress: BADGE }], [])).toBeNull();
    expect(heldBadgeFor({ type: 'other' }, [{ resourceAddress: BADGE }], [])).toBeNull();
  });
});

describe('redemptionValue', () => {
  it('pays the pro-rata share of every reserve', () => {
    expect(redemptionValue({ a: '100', b: '50' }, 10, 100)).toEqual({ a: 10, b: 5 });
  });

  it('is zero with no supply', () => {
    expect(redemptionValue({ a: '100' }, 10, 0)).toEqual({ a: 0 });
  });
});
