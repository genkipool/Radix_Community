// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { entityOrigin, globalCallerId } from '@/features/console/lib/caller-badge';
import { componentFindings, royaltyMethods } from '@/features/console/lib/component-security';

const COMPONENT = 'component_rdx1cqvxkaazmpnvg3f9ufc5n2msv6x7ztjdusdm06lhtf5n7wr8guggg5';
const OWNER_COMPONENT = 'component_rdx1cqy7sq3mxj2whhlqlryy05hzs96m0ajnv23e7j7vanmdwwlccnmz68';
const PACKAGE = 'package_rdx1p5l6dp3slnh9ycd7gk700czwlck9tujn0zpdnd0efw09n2zdnn0lzx';
const BADGE = 'resource_rdx1t4dekrf58h0r28s3c93z92w3jt5ngx87jzd63mgc597zmf3534rxfv';
const TOKEN = 'resource_rdx1t5kmyj54jt85malva7fxdrnpvgfgs623yt7ywdaval25vrdlmnwe97';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const DAPP = 'account_rdx12x2ecj3kp4mhq9u34xrdh7njzyz0ewcz4szv0jw5jksxxssnjh7z6z';
const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';
const POOL = 'pool_rdx1c47jlmd9stptfy2a7e39wnjfechu72q9ggus29x0mqf98m8xt70rx2';

const DENY = { type: 'DenyAll' };
const ALLOW = { type: 'AllowAll' };
const badgeRule = (resource = BADGE) => ({
  type: 'Protected',
  access_rule: { type: 'ProofRule', proof_rule: { type: 'Require', requirement: { type: 'Resource', resource } } },
});
const callerRule = (id: string) => ({
  type: 'Protected',
  access_rule: {
    type: 'ProofRule',
    proof_rule: { type: 'Require', requirement: { type: 'NonFungible', non_fungible: { resource_address: CALLER, local_id: { simple_rep: id } } } },
  },
});
const role = (module: string, name: string, rule: unknown | 'owner', updaters: string[] = []) => ({
  role_key: { module, name },
  assignment: rule === 'owner' ? { resolution: 'Owner' } : { resolution: 'Explicit', explicit_rule: rule },
  updater_roles: updaters.map((u) => ({ module, name: u })),
});

function component({
  owner = badgeRule() as unknown,
  entries = [] as unknown[],
  dapp = '',
  royalty = undefined as unknown,
  locked = [] as string[],
} = {}) {
  return {
    address: COMPONENT,
    details: {
      type: 'Component',
      package_address: PACKAGE,
      blueprint_name: 'PlazaPair',
      two_way_linked_dapp_address: dapp || undefined,
      royalty_config: royalty,
      role_assignments: { owner: { rule: owner, updater: 'Owner' }, entries },
    },
    explicit_metadata: { items: ['name', 'icon_url'].map((key) => ({ key, is_locked: locked.includes(key) })) },
  };
}

/** A resource's details with every role DenyAll unless given. */
const resource = (roles: Record<string, unknown> = {}, supply = '1') => ({
  details: {
    total_supply: supply,
    role_assignments: {
      owner: { rule: DENY, updater: 'None' },
      entries: ['minter', 'recaller', 'freezer'].flatMap((n) => [role('Main', n, roles[n] ?? DENY, [`${n}_updater`]), role('Main', `${n}_updater`, DENY, [`${n}_updater`])]),
    },
  },
});

const ids = (f: ReturnType<typeof componentFindings>) => f.map((x) => x.id);

describe('royaltyMethods', () => {
  it('counts the methods with a royalty, only when royalties are on', () => {
    expect(royaltyMethods({ is_enabled: false })).toBe(0);
    expect(
      royaltyMethods({
        is_enabled: true,
        method_rules: [
          { method_name: 'swap', royalty_amount: { amount: '0.1', unit: 'XRD' } },
          { method_name: 'quote', royalty_amount: { amount: '0', unit: 'XRD' } },
          { method_name: 'free' },
        ],
      }),
    ).toBe(1);
  });
});

describe('componentFindings', () => {
  it('puts an owner anyone can act as first', () => {
    expect(componentFindings({ address: COMPONENT, details: component({ owner: ALLOW }) })[0]).toEqual({ id: 'ownerAnyone', severity: 'danger' });
  });

  it('says nobody can act as the owner when it is DenyAll', () => {
    expect(ids(componentFindings({ address: COMPONENT, details: component({ owner: DENY }) }))).toContain('ownerNobody');
  });

  it('names the owner component a caller rule points at', () => {
    const findings = componentFindings({ address: COMPONENT, details: component({ owner: callerRule('[o]') }), ownerCallers: { '[o]': OWNER_COMPONENT } });
    expect(findings).toContainEqual({ id: 'ownerComponent', severity: 'info', controller: OWNER_COMPONENT });
  });

  it('checks the owner badge like a pool manager badge', () => {
    const findings = componentFindings({
      address: COMPONENT,
      details: component(),
      ownerBadgeDetails: resource({ minter: badgeRule() }, '3'),
    });
    expect(ids(findings).slice(0, 2)).toEqual(['ownerBadgeMintable', 'ownerBadgeSupply']);
    expect(findings).toContainEqual({ id: 'ownerBadge', severity: 'info', badge: BADGE });
    expect(componentFindings({ address: COMPONENT, details: component({ owner: badgeRule(XRD) }) })[0]).toEqual({ id: 'ownerXrd', severity: 'danger' });
  });

  it('flags a role of its own that lets everyone in, not one that defers to the owner', () => {
    const findings = componentFindings({
      address: COMPONENT,
      details: component({ entries: [role('Main', 'admin', ALLOW), role('Main', 'operator', 'owner')] }),
    });
    expect(findings).toContainEqual({ id: 'roleAnyone', severity: 'info', role: 'admin' });
    expect(findings.filter((f) => f.id === 'roleAnyone')).toHaveLength(1);
  });

  it('warns about held tokens their issuer can recall or freeze, never XRD', () => {
    const findings = componentFindings({
      address: COMPONENT,
      details: component(),
      holdings: [
        { resource: TOKEN, details: resource({ recaller: badgeRule(), freezer: badgeRule() }) },
        { resource: XRD, details: resource({ recaller: badgeRule() }) },
      ],
    });
    expect(findings.filter((f) => 'resource' in f)).toEqual([
      { id: 'holdsRecallable', severity: 'warning', resource: TOKEN },
      { id: 'holdsFreezable', severity: 'warning', resource: TOKEN },
    ]);
  });

  it('reports royalties, who can change them and the package', () => {
    const findings = componentFindings({
      address: COMPONENT,
      details: component({
        royalty: { is_enabled: true, method_rules: [{ method_name: 'swap', royalty_amount: { amount: '1', unit: 'USD' } }] },
        entries: [role('Royalty', 'royalty_setter', 'owner', ['royalty_setter_updater']), role('Royalty', 'royalty_setter_updater', 'owner', ['royalty_setter_updater'])],
      }),
      packageRoyaltyBlueprints: 2,
    });
    expect(findings).toEqual(
      expect.arrayContaining([
        { id: 'royaltiesOn', severity: 'info', methods: 1 },
        { id: 'royaltiesChangeable', severity: 'info' },
        { id: 'packageRoyalties', severity: 'info', blueprints: 2 },
        { id: 'packageImmutable', severity: 'ok', pkg: PACKAGE },
      ]),
    );
  });

  it('tells a verified dApp from none, and locked metadata from changeable', () => {
    const setter = [role('Metadata', 'metadata_setter', 'owner', ['metadata_setter_updater']), role('Metadata', 'metadata_setter_updater', 'owner', ['metadata_setter_updater'])];
    const verified = componentFindings({ address: COMPONENT, details: component({ dapp: DAPP, entries: setter, locked: ['name', 'icon_url'] }), dappName: 'Ociswap' });
    expect(verified).toEqual(expect.arrayContaining([{ id: 'verified', severity: 'ok', dapp: DAPP, name: 'Ociswap' }, { id: 'metadataLocked', severity: 'ok' }]));
    const unverified = componentFindings({ address: COMPONENT, details: component({ entries: setter }) });
    expect(ids(unverified)).toEqual(expect.arrayContaining(['unverified', 'metadataChangeable']));
  });

  it('lists what it controls and points out a new component', () => {
    const findings = componentFindings({
      address: COMPONENT,
      details: component(),
      controls: [POOL, COMPONENT],
      createdAt: '2026-10-25T10:00:00Z',
      now: Date.parse('2026-10-27T12:00:00Z'),
    });
    expect(findings).toEqual(expect.arrayContaining([{ id: 'controls', severity: 'info', entities: [POOL] }, { id: 'young', severity: 'info', days: 2 }]));
    expect(ids(componentFindings({ address: COMPONENT, details: component(), createdAt: '2024-01-01T00:00:00Z' }))).not.toContain('young');
  });
});

describe('entityOrigin', () => {
  it('reads the first and latest transactions and keeps the entities that answer to the component', async () => {
    const id = globalCallerId(COMPONENT)!;
    const calls: string[] = [];
    const post = async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
      calls.push(path);
      if (path === '/stream/transactions') {
        return (body.order === 'Asc'
          ? { items: [{ confirmed_at: '2023-11-24T13:49:22Z', affected_global_entities: [COMPONENT, POOL, TOKEN, DAPP] }] }
          : { items: [{ confirmed_at: '2026-10-27T09:09:06Z' }] }) as T;
      }
      // The pool's manager is the component; the token answers to someone else.
      return {
        items: [
          { address: POOL, details: { role_assignments: { owner: { rule: DENY }, entries: [role('Main', 'pool_manager_role', callerRule(id))] } } },
          { address: TOKEN, details: { role_assignments: { owner: { rule: badgeRule() }, entries: [] } } },
        ],
      } as T;
    };
    expect(await entityOrigin(post, COMPONENT)).toEqual({
      createdAt: '2023-11-24T13:49:22Z',
      lastActivityAt: '2026-10-27T09:09:06Z',
      controls: [POOL],
    });
    expect(calls.filter((c) => c === '/state/entity/details')).toHaveLength(1);
  });
});
