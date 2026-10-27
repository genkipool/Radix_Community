// @vitest-environment node
/**
 * Ociswap Precision positions: only collections the ledger ties to a real
 * PrecisionPool count, and the manifests take nothing that could break out
 * of a literal.
 */
import { describe, expect, it } from 'vitest';

import { globalCallerId } from '@/features/console/lib/caller-badge';
import { claimFeesManifest, removePositionsManifest } from '@/features/console/lib/precision-manifests';
import { ociswapComponentListing, pairListing } from '@/features/console/lib/dex-listings';
import { findPrecisionPositions, rangeStatus } from '@/features/console/lib/precision-positions';

const ACCOUNT = 'account_rdx128mcqjmkdye3ntafvle70utz20ju2zscr6kwnrk7pe0vxhjxrx6h89';
const POOL = 'component_rdx1cpwwhuxpe2npedx0axkj4nae8uv5222r0syjtu5fxuaxaj78rf30v9';
const LP = 'resource_rdx1ngffpg3d3le29c9ajtjw0dxt9utjckujfr0nrg48lp05j30yfpvj6r';
/** A collection that claims the real pool in its metadata but was minted by someone else. */
const FAKE_LP = 'resource_rdx1ntxckp625puv2a6t2jvrlw5wf3tvzcpx3tv69qcavmvmcdzhzmsr75';
/** Another component, standing in for one that is not a PrecisionPool. */
const OTHER = 'component_rdx1cqvxkaazmpnvg3f9ufc5n2msv6x7ztjdusdm06lhtf5n7wr8guggg5';
const OTHER_LP = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';
const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';

const minterOf = (component: string) => ({
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
              proof_rule: {
                type: 'Require',
                requirement: { type: 'NonFungible', non_fungible: { resource_address: CALLER, local_id: { simple_rep: globalCallerId(component) } } },
              },
            },
          },
        },
        updater_roles: [],
      },
    ],
  },
});
const meta = (pool: string, name: string) => ({ items: [{ key: 'pool', value: { typed: { value: pool } } }, { key: 'name', value: { typed: { value: name } } }] });

const ENTITIES: Record<string, unknown> = {
  [LP]: { address: LP, details: minterOf(POOL), explicit_metadata: meta(POOL, 'Ociswap LP REDDICKS/XRD') },
  [FAKE_LP]: { address: FAKE_LP, details: minterOf(OTHER), explicit_metadata: meta(POOL, 'Ociswap LP fake') },
  [OTHER_LP]: { address: OTHER_LP, details: minterOf(OTHER), explicit_metadata: meta(OTHER, 'Not a precision pool') },
  // price_sqrt 1.01 → price 1.0201 → tick 199.
  [POOL]: {
    address: POOL,
    details: { blueprint_name: 'PrecisionPool', state: { fields: [{ field_name: 'price_sqrt', value: '1.01' }, { field_name: 'lp_manager', value: LP }] } },
  },
  [OTHER]: { address: OTHER, details: { blueprint_name: 'PlazaPair', state: { fields: [{ field_name: 'lp_manager', value: OTHER_LP }] } } },
};
/** Position NFT data as the Gateway returns it: #4# spans the price, #7# sits wholly below it. */
const BOUNDS: Record<string, [number, number]> = { '#4#': [-600, 600], '#7#': [-1200, -600] };
const nftData = (id: string) => ({
  non_fungible_id: id,
  is_burned: false,
  data: {
    programmatic_json: {
      fields: [
        { field_name: 'liquidity', kind: 'PreciseDecimal', value: '10' },
        { field_name: 'left_bound', kind: 'I32', value: String(BOUNDS[id][0]) },
        { field_name: 'right_bound', kind: 'I32', value: String(BOUNDS[id][1]) },
      ],
    },
  },
});
const post = async <T,>(path: string, body: Record<string, unknown>) =>
  (path === '/state/non-fungible/data'
    ? { non_fungible_ids: (body.non_fungible_ids as string[]).filter((id) => BOUNDS[id]).map(nftData) }
    : { items: (body.addresses as string[]).filter((a) => ENTITIES[a]).map((a) => ENTITIES[a]) }) as T;

describe('findPrecisionPositions', () => {
  it('keeps only collections minted by a PrecisionPool that names them as its LP', async () => {
    const found = await findPrecisionPositions(post, [
      { resourceAddress: LP, ids: ['#4#', '#7#'] },
      { resourceAddress: FAKE_LP, ids: ['#1#'] },
      { resourceAddress: OTHER_LP, ids: ['#1#'] },
    ]);
    expect(found).toEqual([
      {
        pool: POOL,
        lpResource: LP,
        name: 'Ociswap LP REDDICKS/XRD',
        iconUrl: undefined,
        ids: ['#4#', '#7#'],
        currentTick: 199,
        ranges: { '#4#': { left: -600, right: 600 }, '#7#': { left: -1200, right: -600 } },
      },
    ]);
  });

  it('tells a position in range from one the price has left', () => {
    expect(rangeStatus(199, { left: -600, right: 600 })).toBe('in');
    expect(rangeStatus(199, { left: -1200, right: -600 })).toBe('above');
    expect(rangeStatus(199, { left: 600, right: 1200 })).toBe('below');
    // Ociswap counts the left bound in and the right bound out.
    expect(rangeStatus(-600, { left: -600, right: 600 })).toBe('in');
    expect(rangeStatus(600, { left: -600, right: 600 })).toBe('above');
  });

  it('asks nothing when the account holds no NFTs', async () => {
    expect(await findPrecisionPositions(() => Promise.reject(new Error('no call expected')), [])).toEqual([]);
  });
});

describe('precision manifests', () => {
  const group = { pool: POOL, lpResource: LP, ids: ['#4#', '#7#'] };

  it('claims fees with a proof, keeping the NFTs', () => {
    const m = claimFeesManifest(ACCOUNT, [group]);
    expect(m).toContain('"create_proof_of_non_fungibles"');
    expect(m).toContain('"claim_fees"');
    expect(m).not.toContain('withdraw_non_fungibles');
    expect(m).toContain('NonFungibleLocalId("#4#"), NonFungibleLocalId("#7#")');
  });

  it('withdraws positions by handing the NFTs to the pool', () => {
    const m = removePositionsManifest(ACCOUNT, [group]);
    expect(m).toContain('"withdraw_non_fungibles"');
    expect(m).toContain('"remove_liquidity"');
    expect(m).toContain('Expression("ENTIRE_WORKTOP")');
  });

  it('is empty without positions', () => {
    expect(claimFeesManifest(ACCOUNT, [])).toBe('');
    expect(removePositionsManifest(ACCOUNT, [{ ...group, ids: [] }])).toBe('');
  });

  it('rejects anything that could break out of a literal', () => {
    expect(() => claimFeesManifest(ACCOUNT, [{ ...group, ids: ['#1#") ; CALL_METHOD'] }])).toThrow(/NFT id/);
    expect(() => claimFeesManifest(ACCOUNT, [{ ...group, pool: `${POOL}")` }])).toThrow(/component/);
    expect(() => removePositionsManifest(`${ACCOUNT}x`, [group])).toThrow(/account/);
    expect(() => removePositionsManifest(ACCOUNT, [{ ...group, lpResource: 'resource_tdx_2_1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf' }])).toThrow();
  });
});

describe('DEX listings', () => {
  const reply = (status: number, body: unknown) => async () => ({ ok: status < 400, status, json: async () => body });

  it('reads an Ociswap pool, its name and 7-day APR', async () => {
    expect(await ociswapComponentListing(reply(200, { address: POOL, name: 'REDDICKS/XRD', apr: { '7d': '0.17' } }), POOL)).toEqual({
      dex: 'ociswap',
      component: POOL,
      name: 'REDDICKS/XRD',
      aprByPool: {},
      apr: 0.17,
    });
  });

  it('treats a 404 or another component as not listed', async () => {
    expect(await ociswapComponentListing(reply(404, { error: 'Pool not found' }), POOL)).toBeNull();
    expect(await ociswapComponentListing(reply(200, { address: OTHER }), POOL)).toBeNull();
  });

  it('fails on other errors instead of saying not listed', async () => {
    await expect(ociswapComponentListing(reply(500, {}), POOL)).rejects.toThrow(/500/);
  });

  it('finds a DefiPlaza pair by its component or either side pool, with each side\'s APY', () => {
    const pairs = [{ address: OTHER, basePool: 'pool_base', quotePool: 'pool_quote', baseAPY: 0.17, quoteAPY: 0.09 }];
    const byPool = pairListing(pairs, 'defiplaza', 'pool_quote');
    expect(byPool).toMatchObject({ dex: 'defiplaza', component: OTHER, aprByPool: { pool_base: 0.17, pool_quote: 0.09 } });
    expect(pairListing(pairs, 'defiplaza', OTHER)?.component).toBe(OTHER);
    expect(pairListing(pairs, 'defiplaza', POOL)).toBeNull();
  });
});
