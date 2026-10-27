// @vitest-environment node
/**
 * get_component_info and the shared gatherers, against a fake Gateway: the
 * MCP prints the console's English sentences, from the same data functions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/features/console/locales/en.json';
import { globalCallerId } from '@/features/console/lib/caller-badge';

const COMPONENT = 'component_rdx1cqvxkaazmpnvg3f9ufc5n2msv6x7ztjdusdm06lhtf5n7wr8guggg5';
const OWNER = 'component_rdx1cqy7sq3mxj2whhlqlryy05hzs96m0ajnv23e7j7vanmdwwlccnmz68';
const PACKAGE = 'package_rdx1p5l6dp3slnh9ycd7gk700czwlck9tujn0zpdnd0efw09n2zdnn0lzx';
const POOL = 'pool_rdx1c47jlmd9stptfy2a7e39wnjfechu72q9ggus29x0mqf98m8xt70rx2';
const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';

const callerRule = (id: string) => ({
  type: 'Protected',
  access_rule: {
    type: 'ProofRule',
    proof_rule: { type: 'Require', requirement: { type: 'NonFungible', non_fungible: { resource_address: CALLER, local_id: { simple_rep: id } } } },
  },
});
const ownerId = globalCallerId(OWNER)!;
const componentId = globalCallerId(COMPONENT)!;

/** The ledger as the Gateway would answer for a DEX pair component and the pool it manages. */
const ENTITIES: Record<string, unknown> = {
  [COMPONENT]: {
    address: COMPONENT,
    details: {
      type: 'Component',
      package_address: PACKAGE,
      blueprint_name: 'PlazaPair',
      blueprint_version: '1.0.0',
      royalty_config: { is_enabled: false },
      role_assignments: {
        owner: { rule: callerRule(ownerId), updater: 'None' },
        entries: [{ role_key: { module: 'Metadata', name: 'metadata_setter' }, assignment: { resolution: 'Owner' }, updater_roles: [] }],
      },
    },
    explicit_metadata: { items: [] },
  },
  [PACKAGE]: { address: PACKAGE, details: { type: 'Package', role_assignments: { owner: { rule: { type: 'DenyAll' }, updater: 'None' } } } },
  [POOL]: {
    address: POOL,
    details: {
      role_assignments: {
        owner: { rule: callerRule(componentId), updater: 'None' },
        entries: [{ role_key: { module: 'Main', name: 'pool_manager_role' }, assignment: { resolution: 'Explicit', explicit_rule: callerRule(componentId) }, updater_roles: [] }],
      },
    },
  },
};

const gatewayPost = vi.fn(async (_network: string, path: string, body: Record<string, unknown>) => {
  if (path === '/state/entity/details') {
    return { items: (body.addresses as string[]).filter((a) => ENTITIES[a]).map((a) => ENTITIES[a]) };
  }
  if (path === '/stream/transactions') {
    const filter = (body.affected_global_entities_filter as string[])[0];
    const created = filter === COMPONENT ? [COMPONENT, POOL, OWNER] : [OWNER, COMPONENT];
    return body.order === 'Asc'
      ? { items: [{ confirmed_at: '2023-11-24T13:49:22Z', affected_global_entities: created }] }
      : { items: [{ confirmed_at: '2026-10-27T09:09:06Z' }] };
  }
  if (path === '/state/package/page/blueprints') {
    return { items: [{ royalty_config: { is_enabled: true, method_rules: [{ method_name: 'swap', royalty_amount: { amount: '1', unit: 'XRD' } }] } }] };
  }
  throw new Error(`unexpected ${path}`);
});
vi.mock('@/services/gateway/bases', () => ({ gatewayPost: (n: string, p: string, b: Record<string, unknown>) => gatewayPost(n, p, b) }));

const { getMcpRegistry } = await import('@/services/mcp/tools');
const call = (args: Record<string, unknown>) => getMcpRegistry().call('get_component_info', { network: 'mainnet', ...args }, { origin: 'https://example.test' });

beforeEach(() => {
  gatewayPost.mockClear();
});

describe('get_component_info', () => {
  it('is registered', () => {
    expect(getMcpRegistry().list().map((t) => t.name)).toContain('get_component_info');
  });

  it('prints the console sentences, the owner component and what it controls', async () => {
    const res = await call({ component: COMPONENT });
    expect(res.isError).toBeUndefined();
    const text = res.content[0].text;
    const findings = en.console.componentInfo.security.findings;
    expect(text).toContain(`${findings.ownerComponent} ${OWNER}`);
    expect(text).toContain(`${findings.controls} ${POOL}`);
    expect(text).toContain(findings.packageRoyaltiesOne);
    expect(text).toContain('Permissions:');
    expect(res.structuredContent).toMatchObject({
      component: COMPONENT,
      blueprint: 'PlazaPair 1.0.0',
      ownerCaller: OWNER,
      controls: [POOL],
      packageRoyaltyBlueprints: 1,
      createdAt: '2023-11-24T13:49:22Z',
      lastActivityAt: '2026-10-27T09:09:06Z',
    });
  });

  it('reports an address that is not a component in its own section', async () => {
    const res = await call({ component: [COMPONENT, 'component_rdx1cz8p5lc8vmj96hdguy02hkfq4z5xyxf9k759dj8ym8exj8x8zgmw9p'] });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('is not a component on mainnet');
  });

  it('rejects an address of another network before asking the Gateway', async () => {
    const res = await call({ component: 'component_tdx_2_1cqvxkaazmpnvg3f9ufc5n2msv6x7ztjdusdm06lhtf5n7wr8guggg5' });
    expect(res.content[0].text).toMatch(/invalid|network/i);
    expect(gatewayPost).not.toHaveBeenCalled();
  });
});
