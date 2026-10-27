// @vitest-environment node
/**
 * DEX pools: the ledger lookup only trusts a component that really runs the
 * pool, the amounts and price ranges follow the pool, and the manifests take
 * nothing that could break out of a literal.
 */
import { describe, expect, it } from 'vitest';

import { globalCallerId } from '@/features/console/lib/caller-badge';
import {
  addLiquidityManifest,
  compareAddressBytes,
  fullRangeTicks,
  MAX_TICK,
  pairedAmount,
  precisionPairedAmount,
  rangeSides,
  rangeTicks,
  resolveDexPool,
  tickToPrice,
  toDecimalString,
  type DexPool,
} from '@/features/console/lib/dex-pools';
import { findPoolUnitPositions, unitValueChange } from '@/features/console/lib/pool-positions';

const ACCOUNT = 'account_rdx128mcqjmkdye3ntafvle70utz20ju2zscr6kwnrk7pe0vxhjxrx6h89';
const DEX = 'component_rdx1cz8p5lc8vmj96hdguy02hkfq4z5xyxf9k759dj8ym8exj8x8zgmw9p';
const IMPOSTOR = 'component_rdx1cqvxkaazmpnvg3f9ufc5n2msv6x7ztjdusdm06lhtf5n7wr8guggg5';
const POOL = 'pool_rdx1c5hm2rt67scp22pq6tpkfg6cd22g0wwz88065wsy9gdfnd86sv3t4t';
const UNIT = 'resource_rdx1t5362v5zqsf7ywr8g7zlww9ys0cvp7c0eyf4fu8dvgk0krhge8jtgu';
const FAKE_UNIT = 'resource_rdx1tkc32nfsvwnt7ysq2sdgyq6w2g4s69w86yzk8zwegf7pcvya905ctv';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const TOKEN = 'resource_rdx1t5xv44c0u99z096q00mv74emwmxwjw26m98lwlzq6ddlpe9f5cuc7s';
const CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';

const callerRule = (component: string) => ({
  type: 'Protected',
  access_rule: {
    type: 'ProofRule',
    proof_rule: { type: 'Require', requirement: { type: 'NonFungible', non_fungible: { resource_address: CALLER, local_id: { simple_rep: globalCallerId(component) } } } },
  },
});

const poolEntity = (address: string, manager: string, unit: string, reserves: Record<string, string>) => ({
  address,
  details: {
    blueprint_name: 'TwoResourcePool',
    role_assignments: {
      owner: { rule: callerRule(manager), updater: 'None' },
      entries: [{ role_key: { module: 'Main', name: 'pool_manager_role' }, assignment: { resolution: 'Explicit', explicit_rule: callerRule(manager) }, updater_roles: [] }],
    },
  },
  metadata: {
    items: [
      { key: 'pool_resources', value: { typed: { values: Object.keys(reserves) } } },
      { key: 'pool_unit', value: { typed: { value: unit } } },
    ],
  },
  fungible_resources: { items: Object.entries(reserves).map(([resource_address, amount]) => ({ resource_address, amount })) },
});

const componentEntity = (address: string, blueprint: string, fields: Record<string, string>) => ({
  address,
  details: { blueprint_name: blueprint, state: { fields: Object.entries(fields).map(([field_name, value]) => ({ field_name, value })) } },
});

function gateway(entities: Record<string, unknown>, firstTx: string[] = [DEX, POOL]) {
  return async <T,>(path: string, body: Record<string, unknown>) => {
    if (path === '/stream/transactions') return { items: [{ affected_global_entities: firstTx }] } as T;
    return { items: (body.addresses as string[]).filter((a) => entities[a]).map((a) => entities[a]) } as T;
  };
}

describe('resolveDexPool', () => {
  const basic = componentEntity(DEX, 'BasicPool', { x_address: TOKEN, y_address: XRD, liquidity_pool: POOL });

  it('finds the Ociswap component behind a native pool it runs', async () => {
    const post = gateway({ [POOL]: poolEntity(POOL, DEX, UNIT, { [TOKEN]: '1000', [XRD]: '50' }), [DEX]: basic });
    const dex = await resolveDexPool(post, POOL);
    expect(dex).toMatchObject({ kind: 'ociswap-basic', component: DEX, x: TOKEN, y: XRD });
    expect(dex?.kind === 'ociswap-basic' && dex.pool.poolUnit).toBe(UNIT);
    // From the component as well.
    expect((await resolveDexPool(post, DEX))?.kind).toBe('ociswap-basic');
  });

  it('refuses a component that names a pool it does not run', async () => {
    const impostor = componentEntity(IMPOSTOR, 'BasicPool', { x_address: TOKEN, y_address: XRD, liquidity_pool: POOL });
    const post = gateway({ [POOL]: poolEntity(POOL, DEX, UNIT, { [TOKEN]: '1', [XRD]: '1' }), [IMPOSTOR]: impostor });
    expect(await resolveDexPool(post, IMPOSTOR)).toBeNull();
  });

  it('refuses an own pool and an unknown blueprint', async () => {
    const own = poolEntity(POOL, DEX, UNIT, { [TOKEN]: '1', [XRD]: '1' });
    expect(await resolveDexPool(gateway({ [POOL]: own }, [POOL]), POOL)).toBeNull();
    const other = componentEntity(DEX, 'Governance', {});
    expect(await resolveDexPool(gateway({ [POOL]: own, [DEX]: other }), POOL)).toBeNull();
  });

  it('reads a DefiPlaza pair, both side pools and the shortage', async () => {
    const quotePool = 'pool_rdx1c4547fnprjhlp2m27aycmf8rzrkrfzcck58jt2706r85gpcaeapz7k';
    const pair = {
      ...componentEntity(DEX, 'PlazaPair', { base_address: XRD, quote_address: TOKEN, base_pool: POOL, quote_pool: quotePool }),
    };
    pair.details.state.fields.push({ field_name: 'state', fields: [{ field_name: 'shortage', variant_name: 'BaseShortage' }] } as never);
    const post = gateway({
      [DEX]: pair,
      [POOL]: poolEntity(POOL, DEX, UNIT, { [XRD]: '10', [TOKEN]: '1' }),
      [quotePool]: poolEntity(quotePool, DEX, FAKE_UNIT, { [TOKEN]: '5', [XRD]: '0' }),
    });
    expect(await resolveDexPool(post, quotePool)).toMatchObject({ kind: 'defiplaza', x: XRD, y: TOKEN, shortage: 'BaseShortage' });
  });

  it('reads a Precision pool: its tokens in byte order, price and tick spacing', async () => {
    const precision = {
      ...componentEntity(DEX, 'PrecisionPool', { price_sqrt: '0.81', tick_spacing: '60', lp_manager: FAKE_UNIT }),
      fungible_resources: { items: [{ resource_address: XRD }, { resource_address: TOKEN }, { resource_address: XRD }] },
    };
    const dex = await resolveDexPool(gateway({ [DEX]: precision }), DEX);
    const [x, y] = [XRD, TOKEN].sort(compareAddressBytes);
    expect(dex).toMatchObject({ kind: 'ociswap-precision', x, y, priceSqrt: 0.81, tickSpacing: 60, lpResource: FAKE_UNIT });
  });
});

describe('amounts and ranges', () => {
  it('pairs an amount at the reserves ratio', () => {
    expect(pairedAmount({ a: '100', b: '400' }, 'a', 'b', 10)).toBe(40);
    expect(pairedAmount({ a: '0', b: '400' }, 'a', 'b', 10)).toBe(0);
  });

  it('writes engine decimals without exponents', () => {
    expect(toDecimalString(1e-7, 8)).toBe('0.0000001');
    expect(toDecimalString(1234.5)).toBe('1234.5');
    expect(toDecimalString(-1)).toBe('0');
  });

  it('fits a price range to the tick grid and the allowed bounds', () => {
    const range = rangeTicks(0.5, 2, 60)!;
    expect(Math.abs(range.left % 60)).toBe(0);
    expect(range.right % 60).toBe(0);
    expect(tickToPrice(range.left)).toBeLessThanOrEqual(0.5);
    expect(tickToPrice(range.right)).toBeGreaterThanOrEqual(2);
    expect(rangeTicks(2, 1, 60)).toBeNull();
    const full = fullRangeTicks(60);
    expect(full.right).toBeLessThanOrEqual(MAX_TICK);
    expect(full.right % 60).toBe(0);
  });

  it('pairs a Precision amount both ways, and knows one-sided ranges', () => {
    const range = { left: -6000, right: 6000 };
    const y = precisionPairedAmount(1, range, 'x', 100);
    expect(precisionPairedAmount(1, range, 'y', y)).toBeCloseTo(100, 6);
    expect(rangeSides(1, { left: 100, right: 2000 })).toEqual({ x: true, y: false });
    expect(rangeSides(1, { left: -2000, right: -100 })).toEqual({ x: false, y: true });
    expect(precisionPairedAmount(1, { left: 100, right: 2000 }, 'x', 100)).toBe(0);
  });
});

describe('addLiquidityManifest', () => {
  const pool = { address: POOL, poolUnit: UNIT, resources: [TOKEN, XRD], reserves: {} } as never;
  const basic: DexPool = { kind: 'ociswap-basic', component: DEX, x: TOKEN, y: XRD, pool };

  it('sends both tokens to an Ociswap pool', () => {
    const m = addLiquidityManifest({ account: ACCOUNT, dex: basic, amounts: { [TOKEN]: '10', [XRD]: '2' } });
    expect(m).toContain('"add_liquidity"\n    Bucket("x_tokens")\n    Bucket("y_tokens")');
    expect(addLiquidityManifest({ account: ACCOUNT, dex: basic, amounts: { [TOKEN]: '10' } })).toBe('');
  });

  it('sends one side to DefiPlaza, with co-liquidity only when given', () => {
    const plaza: DexPool = { kind: 'defiplaza', component: DEX, x: XRD, y: TOKEN, basePool: pool, quotePool: pool, shortage: 'Equilibrium' };
    expect(addLiquidityManifest({ account: ACCOUNT, dex: plaza, amounts: { [XRD]: '5' }, side: 'base' })).toContain('Enum<0u8>()');
    expect(addLiquidityManifest({ account: ACCOUNT, dex: plaza, amounts: { [XRD]: '5', [TOKEN]: '1' }, side: 'base' })).toContain('Enum<1u8>(Bucket("co_liquidity"))');
  });

  it('writes Precision ticks as i32 and an empty bucket for the side a range does not take', () => {
    const precision: DexPool = { kind: 'ociswap-precision', component: DEX, x: TOKEN, y: XRD, lpResource: FAKE_UNIT, priceSqrt: 1, tickSpacing: 60 };
    const m = addLiquidityManifest({ account: ACCOUNT, dex: precision, amounts: { [TOKEN]: '10' }, range: { left: 120, right: 1200 } });
    expect(m).toContain('120i32\n    1200i32');
    expect(m).toContain(`TAKE_ALL_FROM_WORKTOP\n    Address("${XRD}")`);
    expect(() => addLiquidityManifest({ account: ACCOUNT, dex: precision, amounts: { [TOKEN]: '1' }, range: { left: -MAX_TICK - 60, right: 0 } })).toThrow();
  });

  it('rejects anything that could break out of a literal', () => {
    expect(() => addLiquidityManifest({ account: ACCOUNT, dex: basic, amounts: { [TOKEN]: '1") ;', [XRD]: '1' } })).toThrow(/amount/);
    expect(() => addLiquidityManifest({ account: ACCOUNT, dex: { ...basic, component: `${DEX}")` }, amounts: { [TOKEN]: '1', [XRD]: '1' } })).toThrow(/component/);
    expect(() => addLiquidityManifest({ account: `${ACCOUNT}x`, dex: basic, amounts: { [TOKEN]: '1', [XRD]: '1' } })).toThrow(/account/);
  });
});

describe('pool unit positions', () => {
  const unitEntity = (address: string, pool: string, supply: string) => ({
    address,
    details: { total_supply: supply },
    explicit_metadata: { items: [{ key: 'pool', value: { typed: { value: pool } } }] },
  });

  it('counts a unit only when its pool names it back, valued at the reserves', async () => {
    const post = gateway({
      [UNIT]: unitEntity(UNIT, POOL, '100'),
      [FAKE_UNIT]: unitEntity(FAKE_UNIT, POOL, '100'),
      [POOL]: poolEntity(POOL, DEX, UNIT, { [TOKEN]: '1000', [XRD]: '50' }),
    });
    const found = await findPoolUnitPositions(post, [
      { resourceAddress: UNIT, amount: '10' },
      { resourceAddress: FAKE_UNIT, amount: '10' },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].value).toEqual({ [TOKEN]: 100, [XRD]: 5 });
  });

  it('measures how a unit grew, from the ledger then and now', async () => {
    const post = async <T,>(_path: string, body: Record<string, unknown>) => {
      const past = !!body.at_ledger_state;
      const reserves = past ? { [TOKEN]: '1000', [XRD]: '100' } : { [TOKEN]: '1100', [XRD]: '110' };
      const items = [poolEntity(POOL, DEX, UNIT, reserves), unitEntity(UNIT, POOL, '100')];
      return { items: items.filter((i) => (body.addresses as string[]).includes(i.address)) } as T;
    };
    const change = await unitValueChange(post, POOL, UNIT, 30);
    expect(change?.growth).toBeCloseTo(0.1, 6);
    expect(change?.annualized).toBeGreaterThan(0.1);
  });
});
