// @vitest-environment node
/**
 * Adding liquidity through DEX components, on a real Radix Engine (resim).
 *
 * The package in fixtures/dex-mocks has the blueprint names, methods and state
 * fields of Ociswap's BasicPool, Pool (Flex) and PrecisionPool and of
 * DefiPlaza's PlazaPair, so these runs check the console's manifests against
 * the engine: the calls commit, the pool units or position NFTs arrive, the
 * native pools refuse users (only the component may contribute), and the
 * Precision positions pay their fees and close.
 */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { addLiquidityManifest, compareAddressBytes, fullRangeTicks, type DexPool } from '@/features/console/lib/dex-pools';
import { contributeManifest, redeemManifest } from '@/features/console/lib/pool-manifests';
import { claimFeesManifest, removePositionsManifest } from '@/features/console/lib/precision-manifests';
import type { PoolState } from '@/features/console/lib/pool-lookup';
import { RESIM, ResimLedger, expectCommitted, type ResimAccount } from '../helpers/resim';

const PACKAGE_WASM = join(__dirname, '../fixtures/dex-mocks/build/dex_mocks.wasm');

/** Only the fields the manifests read; the ledger lookup is covered with a fake Gateway elsewhere. */
const poolStub = (address: string, poolUnit: string, resources: string[]): PoolState =>
  ({ address, poolUnit, resources, kind: 'two', reserves: {} }) as unknown as PoolState;

describe.skipIf(!RESIM)('DEX liquidity on resim', () => {
  let ledger: ResimLedger;
  let user: ResimAccount;
  let pkg = '';
  let x = '';
  let y = '';

  beforeAll(() => {
    ledger = new ResimLedger();
    user = ledger.newAccount();
    ledger.use(user);
    pkg = ledger.exec('publish', PACKAGE_WASM).match(/New Package: (package_sim1\w+)/)?.[1] ?? '';
    const a = ledger.newToken('1000000', 'Alpha');
    const b = ledger.newToken('1000000', 'Beta');
    [x, y] = [a, b].sort(compareAddressBytes);
  }, 120_000);

  afterAll(() => ledger?.dispose());

  /** Calls a blueprint function and returns the new entities, in the order resim lists them. */
  function instantiate(blueprint: string, args: string, before = '') {
    const run = ledger.run(`${before}CALL_FUNCTION\n    Address("${pkg}")\n    "${blueprint}"\n    "instantiate"\n    ${args}\n;\nCALL_METHOD\n    Address("${user.address}")\n    "deposit_batch"\n    Expression("ENTIRE_WORKTOP")\n;\n`, user.address);
    expectCommitted(run);
    return run.newEntities;
  }

  const send = (manifest: string) => {
    const run = ledger.run(manifest, user.address);
    expectCommitted(run, manifest);
    return run;
  };

  const units = (resource: string) => Number(ledger.balance(user.address, resource));
  /** The NFT ids the account holds of one collection (its owner badge is another). */
  const nftIds = (resource: string) => {
    const after = ledger.show(user.address).split(`${resource}:`)[1] ?? '';
    return new Set([...after.split(/resource_sim1/)[0].matchAll(/#(\d+)#/g)].map((m) => `#${m[1]}#`));
  };

  for (const blueprint of ['BasicPool', 'Pool'] as const) {
    it(`${blueprint}: adds both tokens through the component, refuses a direct contribute, redeems`, () => {
      const created = instantiate(blueprint, `Address("${x}")\n    Address("${y}")`);
      const component = created.find((e) => e.startsWith('component_'))!;
      const pool = created.find((e) => e.startsWith('pool_'))!;
      const poolUnit = created.find((e) => e.startsWith('resource_'))!;
      const dex: DexPool = { kind: blueprint === 'BasicPool' ? 'ociswap-basic' : 'ociswap-flex', component, x, y, pool: poolStub(pool, poolUnit, [x, y]) };

      send(addLiquidityManifest({ account: user.address, dex, amounts: { [x]: '100', [y]: '400' } }));
      expect(units(poolUnit)).toBeGreaterThan(0);
      // Second time the pool takes the reserves' ratio and gives the excess back.
      const xBefore = units(x);
      send(addLiquidityManifest({ account: user.address, dex, amounts: { [x]: '10', [y]: '100' } }));
      expect(xBefore - units(x)).toBeCloseTo(10, 6);

      // The native pool answers only to the component: a user's contribute is refused.
      const direct = ledger.run(contributeManifest({ account: user.address, pool, kind: 'two', manager: null, contributions: [{ resource: x, amount: '1' }, { resource: y, amount: '4' }] }), user.address);
      expect(direct.committed).toBe(false);

      const held = units(poolUnit);
      send(redeemManifest({ account: user.address, pool, poolUnit, amount: String(held) }));
      expect(units(poolUnit)).toBe(0);
    });
  }

  it('PlazaPair: one token to its side, co-liquidity only when that side is short', () => {
    const created = instantiate('PlazaPair', `Address("${x}")\n    Address("${y}")`);
    const component = created.find((e) => e.startsWith('component_'))!;
    const pools = created.filter((e) => e.startsWith('pool_'));
    const unitsOf = created.filter((e) => e.startsWith('resource_'));
    const dex: DexPool = {
      kind: 'defiplaza',
      component,
      x,
      y,
      basePool: poolStub(pools[0], unitsOf[0], [x, y]),
      quotePool: poolStub(pools[1], unitsOf[1], [y, x]),
      shortage: 'Equilibrium',
    };

    send(addLiquidityManifest({ account: user.address, dex, amounts: { [x]: '50' }, side: 'base' }));
    send(addLiquidityManifest({ account: user.address, dex, amounts: { [y]: '20' }, side: 'quote' }));
    const baseUnits = unitsOf.find((u) => units(u) === 50) ?? unitsOf.find((u) => units(u) > 0);
    expect(baseUnits).toBeTruthy();

    // Mark the base side short (it now holds quote tokens too): a lone base deposit is refused.
    send(`CALL_METHOD\n    Address("${user.address}")\n    "withdraw"\n    Address("${y}")\n    Decimal("5")\n;\nTAKE_FROM_WORKTOP\n    Address("${y}")\n    Decimal("5")\n    Bucket("other")\n;\nCALL_METHOD\n    Address("${component}")\n    "set_shortage"\n    false\n    Bucket("other")\n;\n`);
    const short = { ...dex, shortage: 'BaseShortage' as const };
    const alone = ledger.run(addLiquidityManifest({ account: user.address, dex: short, amounts: { [x]: '10' }, side: 'base' }), user.address);
    expect(alone.committed).toBe(false);
    send(addLiquidityManifest({ account: user.address, dex: short, amounts: { [x]: '10', [y]: '1' }, side: 'base' }));
  });

  it('PrecisionPool: a range position, its fees claimed without closing it, then withdrawn', () => {
    const created = instantiate(
      'PrecisionPool',
      `Address("${x}")\n    Address("${y}")\n    PreciseDecimal("1")\n    10u32\n    Bucket("seed_x")\n    Bucket("seed_y")`,
      `CALL_METHOD\n    Address("${user.address}")\n    "withdraw"\n    Address("${x}")\n    Decimal("1")\n;\nTAKE_FROM_WORKTOP\n    Address("${x}")\n    Decimal("1")\n    Bucket("seed_x")\n;\nCALL_METHOD\n    Address("${user.address}")\n    "withdraw"\n    Address("${y}")\n    Decimal("1")\n;\nTAKE_FROM_WORKTOP\n    Address("${y}")\n    Decimal("1")\n    Bucket("seed_y")\n;\n`,
    );
    const component = created.find((e) => e.startsWith('component_'))!;
    const lpResource = created.find((e) => e.startsWith('resource_'))!;
    const dex: DexPool = { kind: 'ociswap-precision', component, x, y, lpResource, priceSqrt: 1, tickSpacing: 10 };

    // A range around the price takes both tokens; a range wholly above takes only x (y goes as an empty bucket).
    send(addLiquidityManifest({ account: user.address, dex, amounts: { [x]: '100', [y]: '100' }, range: { left: -1000, right: 1000 } }));
    send(addLiquidityManifest({ account: user.address, dex, amounts: { [x]: '30' }, range: { left: 100, right: 2000 } }));
    send(addLiquidityManifest({ account: user.address, dex, amounts: { [x]: '20', [y]: '20' }, range: fullRangeTicks(10) }));
    expect(nftIds(lpResource)).toEqual(new Set(['#1#', '#2#', '#3#']));

    send(`CALL_METHOD\n    Address("${user.address}")\n    "withdraw"\n    Address("${x}")\n    Decimal("9")\n;\nTAKE_FROM_WORKTOP\n    Address("${x}")\n    Decimal("9")\n    Bucket("fx")\n;\nCALL_METHOD\n    Address("${user.address}")\n    "withdraw"\n    Address("${y}")\n    Decimal("9")\n;\nTAKE_FROM_WORKTOP\n    Address("${y}")\n    Decimal("9")\n    Bucket("fy")\n;\nCALL_METHOD\n    Address("${component}")\n    "add_fees"\n    Bucket("fx")\n    Bucket("fy")\n;\n`);

    const group = [{ pool: component, lpResource, ids: ['#1#', '#2#', '#3#'] }];
    const before = units(x);
    send(claimFeesManifest(user.address, group));
    expect(units(x) - before).toBeCloseTo(9, 4);
    // The positions stay after claiming.
    expect(nftIds(lpResource)).toEqual(new Set(['#1#', '#2#', '#3#']));

    send(removePositionsManifest(user.address, group));
    expect(nftIds(lpResource).size).toBe(0);
    // Withdrawing gave the liquidity back: what went in, less the seed, is in the account again.
    expect(units(x)).toBeGreaterThan(before);
  });
});
