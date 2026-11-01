// @vitest-environment node
/**
 * get_pool_positions and build_dex_manifest against a fake ledger: the same
 * lookups and manifests as the console, the simulation's result in the
 * answer, and a warning when the DEX does not list the component.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalCallerId } from '@/features/console/lib/caller-badge';

const ACCOUNT = 'account_rdx128mcqjmkdye3ntafvle70utz20ju2zscr6kwnrk7pe0vxhjxrx6h89';
const PRECISION = 'component_rdx1cpwwhuxpe2npedx0axkj4nae8uv5222r0syjtu5fxuaxaj78rf30v9';
const LP = 'resource_rdx1ngffpg3d3le29c9ajtjw0dxt9utjckujfr0nrg48lp05j30yfpvj6r';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const TOKEN = 'resource_rdx1t42hpqvsk4t42l6aw09hwphd2axvetp6gvas9ztue0p30f4hzdwxrp';
const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';
const OWN_POOL = 'pool_rdx1c5hm2rt67scp22pq6tpkfg6cd22g0wwz88065wsy9gdfnd86sv3t4t';

const minter = {
  role_assignments: {
    owner: { rule: { type: 'DenyAll' }, updater: 'None' },
    entries: [
      {
        role_key: { module: 'Main', name: 'minter' },
        assignment: {
          resolution: 'Explicit',
          explicit_rule: {
            type: 'Protected',
            access_rule: {
              type: 'ProofRule',
              proof_rule: { type: 'Require', requirement: { type: 'NonFungible', non_fungible: { resource_address: CALLER, local_id: { simple_rep: globalCallerId(PRECISION) } } } },
            },
          },
        },
        updater_roles: [],
      },
    ],
  },
};

const ENTITIES: Record<string, unknown> = {
  [PRECISION]: {
    address: PRECISION,
    details: {
      blueprint_name: 'PrecisionPool',
      state: { fields: [{ field_name: 'price_sqrt', value: '1' }, { field_name: 'tick_spacing', value: '60' }, { field_name: 'lp_manager', value: LP }] },
    },
    fungible_resources: { items: [{ resource_address: XRD }, { resource_address: TOKEN }] },
  },
  [LP]: { address: LP, details: minter, explicit_metadata: { items: [{ key: 'pool', value: { typed: { value: PRECISION } } }, { key: 'name', value: { typed: { value: 'Ociswap LP REDDICKS/XRD' } } }] } },
  [OWN_POOL]: {
    address: OWN_POOL,
    details: { blueprint_name: 'TwoResourcePool', role_assignments: { owner: { rule: { type: 'DenyAll' } }, entries: [] } },
  },
};

const gatewayPost = vi.fn(async (_network: string, path: string, body: Record<string, unknown>) => {
  if (path === '/stream/transactions') return { items: [{ affected_global_entities: [OWN_POOL] }] };
  if (path === '/state/non-fungible/data') {
    // #4# spans the price (tick 0), #7# sits wholly above it.
    const bounds: Record<string, [string, string]> = { '#4#': ['-600', '600'], '#7#': ['600', '1200'] };
    return {
      non_fungible_ids: (body.non_fungible_ids as string[]).map((id) => ({
        non_fungible_id: id,
        data: { programmatic_json: { fields: [{ field_name: 'left_bound', value: bounds[id][0] }, { field_name: 'right_bound', value: bounds[id][1] }] } },
      })),
    };
  }
  return { items: (body.addresses as string[]).filter((a) => ENTITIES[a]).map((a) => ENTITIES[a]) };
});
vi.mock('@/services/gateway/bases', () => ({ gatewayPost: (n: string, p: string, b: Record<string, unknown>) => gatewayPost(n, p, b) }));
vi.mock('@/services/gateway/entities', () => ({
  fetchEntityDetailsLive: async () => ({
    address: ACCOUNT,
    non_fungible_resources: { items: [{ resource_address: LP, vaults: { items: [{ items: ['#4#', '#7#'], total_count: 2 }] } }] },
    fungible_resources: { items: [] },
  }),
}));
const listing = vi.fn(async (): Promise<unknown> => ({ dex: 'ociswap', component: PRECISION, name: 'REDDICKS/XRD', aprByPool: {}, apr: 0.17 }));
vi.mock('@/services/gateway/dexListings', () => ({ getDexListing: () => listing() }));
vi.mock('@/features/console/services/transactionPreview', () => ({
  previewTransaction: async (manifest: string) => ({
    status: 'Succeeded',
    errorMessage: null,
    feeXrd: 0.5,
    logs: [],
    balanceChanges: manifest.includes('claim_fees')
      ? [{ entityAddress: ACCOUNT, resourceAddress: TOKEN, amount: '331.1' }, { entityAddress: ACCOUNT, resourceAddress: XRD, amount: '143.2' }]
      : [{ entityAddress: ACCOUNT, resourceAddress: LP, amount: '-2' }, { entityAddress: ACCOUNT, resourceAddress: XRD, amount: '1800' }],
  }),
}));
vi.mock('@/services/ret', async (original) => ({ ...(await original<object>()), staticallyValidateManifest: async () => ({ valid: true }) }));

const { getMcpRegistry } = await import('@/services/mcp/tools');
const call = (name: string, args: Record<string, unknown>) => getMcpRegistry().call(name, { network: 'mainnet', ...args }, { origin: 'https://example.test' });

beforeEach(() => {
  listing.mockClear();
});

describe('DEX MCP tools', () => {
  it('are registered', () => {
    const names = getMcpRegistry().list().map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['get_pool_positions', 'build_dex_manifest']));
  });

  it('builds a fee claim for every position held, with the simulated payout', async () => {
    const res = await call('build_dex_manifest', { operation: 'claim_fees', account: ACCOUNT, pool: PRECISION });
    expect(res.isError).toBeUndefined();
    const out = res.structuredContent as { manifest: string; listed: boolean; simulation: { received: Record<string, number> } };
    expect(out.manifest).toContain('"claim_fees"');
    expect(out.manifest).toContain('NonFungibleLocalId("#4#"), NonFungibleLocalId("#7#")');
    expect(out.listed).toBe(true);
    expect(out.simulation.received[TOKEN]).toBeCloseTo(331.1);
  });

  it('refuses ids the account does not hold', async () => {
    const res = await call('build_dex_manifest', { operation: 'withdraw_positions', account: ACCOUNT, pool: PRECISION, ids: ['#9#'] });
    expect(res.content[0].text).toMatch(/does not hold #9#/);
  });

  it('warns when the DEX does not list the component', async () => {
    listing.mockResolvedValueOnce(null);
    const res = await call('build_dex_manifest', { operation: 'add', account: ACCOUNT, pool: PRECISION, amounts: { [XRD]: '10', [TOKEN]: '10' } });
    expect(res.content[0].text).toMatch(/does not list this component/);
    expect(res.content[0].text).toMatch(/i32/);
  });

  it('sends an own pool to build_pool_manifest', async () => {
    const res = await call('build_dex_manifest', { operation: 'add', account: ACCOUNT, pool: OWN_POOL, amounts: {} });
    expect(res.content[0].text).toMatch(/not run by a supported DEX/);
  });

  it('lists the Precision positions with fees and withdrawal', async () => {
    const res = await call('get_pool_positions', { account: ACCOUNT });
    const out = res.structuredContent as { precision: Array<{ ids: string[]; feesNow: Record<string, number>; ranges: Array<{ id: string; status: string }> }> };
    expect(out.precision).toHaveLength(1);
    expect(out.precision[0].ids).toEqual(['#4#', '#7#']);
    expect(out.precision[0].feesNow[XRD]).toBeCloseTo(143.2);
    expect(out.precision[0].ranges.map((r) => r.status)).toEqual(['in', 'below']);
    expect(res.content[0].text).toMatch(/#7# OUT OF RANGE \(price below, earns no fees\)/);
  });
});
