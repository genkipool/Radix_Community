// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { entityRoles } from '@/features/console/lib/role-lookup';

const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';
const BADGE = 'resource_rdx1t4dekrf58h0r28s3c93z92w3jt5ngx87jzd63mgc597zmf3534rxfv';
const caller = (id: string) => ({
  type: 'Protected',
  access_rule: {
    type: 'ProofRule',
    proof_rule: {
      type: 'Require',
      requirement: { type: 'NonFungible', non_fungible: { resource_address: CALLER, local_id: { simple_rep: id } } },
    },
  },
});
const badge = {
  type: 'Protected',
  access_rule: { type: 'ProofRule', proof_rule: { type: 'Require', requirement: { type: 'Resource', resource: BADGE } } },
};
const role = (module: string, name: string, assignment: Record<string, unknown>, updaters: string[]) => ({
  role_key: { module, name },
  assignment,
  updater_roles: updaters.map((u) => ({ module, name: u })),
});
const viaOwner = { resolution: 'Owner' };
const explicit = (rule: unknown) => ({ resolution: 'Explicit', explicit_rule: rule });

/** The shape the Gateway returns for a DEX pool (DefiPlaza, mainnet), trimmed to a few roles. */
const dexPool = {
  details: {
    role_assignments: {
      owner: { rule: caller('[owner]'), updater: 'None' },
      entries: [
        role('Main', 'pool_manager_role', explicit(caller('[manager]')), []),
        role('Metadata', 'metadata_setter', viaOwner, ['metadata_setter_updater']),
        role('Metadata', 'metadata_setter_updater', viaOwner, ['metadata_setter_updater']),
        role('Royalty', 'royalty_claimer', viaOwner, ['royalty_claimer_updater']),
        role('Royalty', 'royalty_claimer_updater', viaOwner, ['royalty_claimer_updater']),
      ],
    },
  },
};

describe('entityRoles', () => {
  it('lists the owner first, then every module in the Gateway order', () => {
    const roles = entityRoles(dexPool);
    expect(roles.map((r) => `${r.module}:${r.name}`)).toEqual([
      'Owner:owner',
      'Main:pool_manager_role',
      'Metadata:metadata_setter',
      'Metadata:metadata_setter_updater',
      'Royalty:royalty_claimer',
      'Royalty:royalty_claimer_updater',
    ]);
  });

  it('resolves roles that defer to the owner to the owner rule', () => {
    const setter = entityRoles(dexPool).find((r) => r.name === 'metadata_setter')!;
    expect(setter.viaOwner).toBe(true);
    expect(setter.rule).toEqual({ type: 'nonFungible', resource: CALLER, localId: '[owner]' });
  });

  it('marks a role with no updater, and an owner with updater None, as fixed', () => {
    const roles = entityRoles(dexPool);
    expect(roles.find((r) => r.name === 'pool_manager_role')!.fixed).toBe(true);
    expect(roles.find((r) => r.name === 'owner')!.fixed).toBe(true);
    // Its updater is the owner, which a component can still exercise.
    expect(roles.find((r) => r.name === 'metadata_setter')!.fixed).toBe(false);
  });

  it('treats a role as fixed once every updater is DenyAll', () => {
    const locked = {
      details: {
        role_assignments: {
          owner: { rule: badge, updater: 'Owner' },
          entries: [
            role('Main', 'minter', explicit(badge), ['minter_updater']),
            role('Main', 'minter_updater', explicit({ type: 'DenyAll' }), ['minter_updater']),
          ],
        },
      },
    };
    const roles = entityRoles(locked);
    expect(roles.find((r) => r.name === 'owner')!.fixed).toBe(false);
    expect(roles.find((r) => r.name === 'minter')!).toMatchObject({ rule: { type: 'resource', resource: BADGE }, viaOwner: false, fixed: true });
  });

  it('returns nothing for an entity without role assignments', () => {
    expect(entityRoles({ details: {} })).toEqual([]);
  });
});
