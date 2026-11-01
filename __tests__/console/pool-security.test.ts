// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { PoolState } from '@/features/console/lib/pool-lookup';
import { poolFindings, type PoolSecurityInput } from '@/features/console/lib/pool-security';
import { entityRoles } from '@/features/console/lib/role-lookup';

const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const TOKEN = 'resource_rdx1t5kmyj54jt85malva7fxdrnpvgfgs623yt7ywdaval25vrdlmnwe97';
const OTHER = 'resource_rdx1t52pvtk5wfhltchwh3rkzls2x0r98fw9cjhpyrf3vsykhkuwrf7jg8';
const BADGE = 'resource_rdx1t4dekrf58h0r28s3c93z92w3jt5ngx87jzd63mgc597zmf3534rxfv';
const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';
const POOL = 'pool_rdx1c47jlmd9stptfy2a7e39wnjfechu72q9ggus29x0mqf98m8xt70rx2';
const UNIT = 'resource_rdx1t5q26nr5t02pzf40tp9z999ex7d84szldnpqg8e459jyvztrxhqqls';
const COMPONENT = 'component_rdx1cz8p5lc8vmj96hdguy02hkfq4z5xyxf9k759dj8ym8exj8x8zgmw9p';
const DAPP = 'account_rdx12x2ecj3kp4mhq9u34xrdh7njzyz0ewcz4szv0jw5jksxxssnjh7z6z';

const DENY = { type: 'DenyAll' };
const ALLOW = { type: 'AllowAll' };
const badgeRule = (resource = BADGE) => ({
  type: 'Protected',
  access_rule: { type: 'ProofRule', proof_rule: { type: 'Require', requirement: { type: 'Resource', resource } } },
});

const entry = (module: string, name: string, rule: unknown) => ({
  role_key: { module, name },
  assignment: { resolution: 'Explicit', explicit_rule: rule },
  updater_roles: name.endsWith('_updater') ? [{ module, name }] : [{ module, name: `${name}_updater` }],
});

/** A resource's details: every role DenyAll but withdraw/deposit, unless overridden. */
function resource({ supply = '1000', symbol = '', locked = [] as string[], roles = {} as Record<string, unknown> } = {}) {
  const names = ['minter', 'burner', 'freezer', 'recaller', 'withdrawer', 'depositor'];
  const open = (n: string) => n === 'withdrawer' || n === 'depositor';
  return {
    details: {
      total_supply: supply,
      role_assignments: {
        owner: { rule: DENY, updater: 'None' },
        entries: [
          ...names.flatMap((n) => [entry('Main', n, roles[n] ?? (open(n) ? ALLOW : DENY)), entry('Main', `${n}_updater`, roles[`${n}_updater`] ?? DENY)]),
          entry('Metadata', 'metadata_setter', roles.metadata_setter ?? DENY),
          entry('Metadata', 'metadata_setter_updater', DENY),
        ],
      },
    },
    explicit_metadata: {
      items: [
        ...(symbol ? [{ key: 'symbol', is_locked: locked.includes('symbol'), value: { typed: { value: symbol } } }] : []),
        ...['name', 'icon_url'].map((key) => ({ key, is_locked: locked.includes(key), value: { typed: { value: key } } })),
      ],
    },
  };
}

/** A pool's details with a manager rule and a metadata setter. */
function poolDetails(manager: unknown, { setter = badgeRule() as unknown, locked = [] as string[] } = {}) {
  return {
    details: {
      role_assignments: {
        owner: { rule: badgeRule(), updater: 'Owner' },
        entries: [
          { role_key: { module: 'Main', name: 'pool_manager_role' }, assignment: { resolution: 'Explicit', explicit_rule: manager }, updater_roles: [] },
          entry('Metadata', 'metadata_setter', setter),
          entry('Metadata', 'metadata_setter_updater', DENY),
        ],
      },
    },
    explicit_metadata: { items: ['name', 'icon_url'].map((key) => ({ key, is_locked: locked.includes(key), value: { typed: { value: key } } })) },
  };
}

function input(manager: PoolState['manager'], details: Record<string, unknown>, extra: Partial<PoolSecurityInput> = {}): PoolSecurityInput {
  const rawManager =
    manager.type === 'allowAll'
      ? ALLOW
      : manager.type === 'resource'
        ? badgeRule(manager.resource)
        : {
            type: 'Protected',
            access_rule: {
              type: 'ProofRule',
              proof_rule: { type: 'Require', requirement: { type: 'NonFungible', non_fungible: { resource_address: CALLER, local_id: { simple_rep: '[m]' } } } },
            },
          };
  const pool = (details[POOL] as ReturnType<typeof poolDetails>) ?? poolDetails(rawManager);
  const state: PoolState = {
    address: POOL,
    kind: 'two',
    resources: [XRD, TOKEN],
    reserves: { [XRD]: '10', [TOKEN]: '10' },
    poolUnit: UNIT,
    manager,
    owner: { type: 'resource', resource: BADGE },
    ownerUpdatable: true,
    tags: [],
    roles: entityRoles(pool),
  };
  return {
    state,
    details: { [POOL]: pool, [UNIT]: resource({ locked: ['name', 'symbol', 'icon_url'] }), [TOKEN]: resource({ symbol: 'HUG' }), ...details },
    callers: { '[m]': COMPONENT },
    knownTokens: { HUG: TOKEN, XRD },
    ...extra,
  };
}

const ids = (findings: ReturnType<typeof poolFindings>) => findings.map((f) => f.id);
const caller = { type: 'nonFungible', resource: CALLER, localId: '[m]' } as const;

describe('poolFindings', () => {
  it('reads a DEX pool run by a verified dApp whose component nobody owns as safe', () => {
    const findings = poolFindings(
      input(caller, {
        [COMPONENT]: { details: { two_way_linked_dapp_address: DAPP, role_assignments: { owner: { rule: DENY, updater: 'None' } } } },
        [DAPP]: { explicit_metadata: { items: [{ key: 'name', value: { typed: { value: 'Ociswap' } } }] } },
      }),
    );
    expect(findings.filter((f) => f.severity === 'danger' || f.severity === 'warning')).toEqual([]);
    expect(findings).toContainEqual({ id: 'managerVerified', severity: 'ok', component: COMPONENT, dapp: DAPP, name: 'Ociswap' });
    expect(ids(findings)).toEqual(expect.arrayContaining(['controllerNobody', 'rolesFixed']));
  });

  it('points at an unverified manager component and the badge that controls it', () => {
    const findings = poolFindings(input(caller, { [COMPONENT]: { details: { role_assignments: { owner: { rule: badgeRule(OTHER), updater: 'Owner' } } } } }));
    expect(ids(findings)).toEqual(expect.arrayContaining(['managerUnverified']));
    expect(findings).toContainEqual({ id: 'controllerBadge', severity: 'info', component: COMPONENT, badge: OTHER });
  });

  it('puts an AllowAll manager first', () => {
    const findings = poolFindings(input({ type: 'allowAll' }, {}));
    expect(findings[0]).toEqual({ id: 'drainable', severity: 'danger' });
  });

  it('flags a mintable badge and the manager taking reserves out', () => {
    const findings = poolFindings(
      input({ type: 'resource', resource: BADGE }, { [BADGE]: resource({ supply: '1', roles: { minter: badgeRule() } }) }, {
        managerMoves: { count: 3, withdrawn: { [TOKEN]: '9' }, deposited: {}, lastAt: '2026-10-27T10:00:00Z' },
      }),
    );
    expect(ids(findings).slice(0, 2)).toEqual(['badgeMintable', 'managerMoves']);
  });

  it('ignores reserve moves on a DEX pool: they are its swaps', () => {
    const findings = poolFindings(input(caller, {}, { managerMoves: { count: 98, withdrawn: {}, deposited: {}, lastAt: null } }));
    expect(ids(findings)).not.toContain('managerMoves');
  });

  it('calls out a reserve that takes the symbol of a known token', () => {
    const findings = poolFindings(input(caller, { [TOKEN]: resource({ symbol: 'OCI' }) }, { knownTokens: { OCI: OTHER } }));
    expect(findings[0]).toEqual({ id: 'impersonation', severity: 'danger', resource: TOKEN, symbol: 'OCI', genuine: OTHER });
  });

  it('calls out a fake XRD even without a token list', () => {
    const findings = poolFindings(input(caller, { [TOKEN]: resource({ symbol: 'xrd' }) }, { knownTokens: {} }));
    expect(findings[0]).toMatchObject({ id: 'impersonation', resource: TOKEN, symbol: 'xrd' });
  });

  it('lists what a reserve issuer can do, and nothing for XRD', () => {
    const findings = poolFindings(
      input(caller, {
        [TOKEN]: resource({ symbol: 'HUG', roles: { recaller: badgeRule(), withdrawer: badgeRule(), minter: badgeRule(), metadata_setter: badgeRule() } }),
      }),
    );
    expect(findings.filter((f) => 'resource' in f).map((f) => [f.id, 'resource' in f && f.resource])).toEqual([
      ['reserveRecallable', TOKEN],
      ['reserveWithdrawRestricted', TOKEN],
      ['reserveMintable', TOKEN],
      ['reserveRenamable', TOKEN],
    ]);
  });

  it('says whether the pool can be renamed', () => {
    const open = poolFindings(input(caller, {}));
    expect(ids(open)).toContain('profileChangeable');
    const locked = poolFindings(input(caller, { [POOL]: poolDetails(badgeRule(), { locked: ['name', 'icon_url'] }) }));
    expect(ids(locked)).toContain('profileLocked');
    const nobody = poolFindings(input(caller, { [POOL]: poolDetails(badgeRule(), { setter: DENY }) }));
    expect(ids(nobody)).toContain('profileLocked');
  });

  it('notes a single account holding most units', () => {
    expect(poolFindings(input(caller, {}, { topShare: 0.97 }))).toContainEqual({ id: 'concentration', severity: 'info', share: 0.97 });
    expect(ids(poolFindings(input(caller, {}, { topShare: 0.3 })))).not.toContain('concentration');
  });
});
