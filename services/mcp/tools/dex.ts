/**
 * services/mcp/tools/dex.ts
 *
 * Liquidity in pools a DEX runs, the same as the console's "Your pool
 * positions" and "Add to a DEX" sections, built from the same functions:
 *
 * - get_pool_positions: what an account has in pools (native units with their
 *   value and yield, Ociswap Precision positions with their fees);
 * - build_dex_manifest: add liquidity through the DEX component, or claim the
 *   fees of / withdraw Precision positions, with what the account would
 *   receive simulated on the ledger.
 */
import { z } from 'zod';

import { mapHoldings } from '@/features/console/lib/account-holdings';
import { isPositiveDecimal } from '@/features/console/lib/decimal';
import { addLiquidityManifest, fullRangeTicks, rangeTicks, resolveDexPool, type DexPool } from '@/features/console/lib/dex-pools';
import type { DexListing } from '@/features/console/lib/dex-listings';
import { findPoolUnitPositions, unitValueChange } from '@/features/console/lib/pool-positions';
import { claimFeesManifest, removePositionsManifest } from '@/features/console/lib/precision-manifests';
import { findPrecisionPositions, rangeStatus, type PrecisionPosition } from '@/features/console/lib/precision-positions';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import { previewTransaction } from '@/features/console/services/transactionPreview';
import { gatewayPost } from '@/services/gateway/bases';
import { getDexListing } from '@/services/gateway/dexListings';
import { fetchEntityDetailsLive } from '@/services/gateway/entities';
import { staticallyValidateManifest } from '@/services/ret';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection } from '../cli';
import { signingSteps } from '../dapp';
import { defineMcpTool } from '../registry';
import { assertAddressOnNetwork } from './console';
import { localeSchema, networkSchema } from './schemas';

const DEX_NAMES = { ociswap: 'Ociswap', defiplaza: 'DefiPlaza', reddicks: 'Reddicks' } as const;
const KIND_NAMES: Record<DexPool['kind'], string> = {
  'ociswap-basic': 'Ociswap Basic',
  'ociswap-flex': 'Ociswap Flex',
  'ociswap-precision': 'Ociswap Precision',
  defiplaza: 'DefiPlaza',
};

const pct = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(3)} %`;
const amounts = (values: Record<string, number>) =>
  Object.entries(values)
    .map(([resource, value]) => `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${resource}`)
    .join(', ') || 'nothing';

/** What the account receives in a simulated transaction, per resource (LP NFTs it hands over left out). */
async function received(manifest: string, account: string, network: 'mainnet' | 'stokenet', exclude: string[] = []) {
  const result = await previewTransaction(manifest, network);
  const out: Record<string, number> = {};
  for (const change of result.balanceChanges) {
    if (change.entityAddress !== account || exclude.includes(change.resourceAddress) || Number(change.amount) <= 0) continue;
    out[change.resourceAddress] = (out[change.resourceAddress] ?? 0) + Number(change.amount);
  }
  return { status: result.status, error: result.errorMessage, received: out };
}

const listingText = (listing: DexListing | null, network: string) =>
  network !== 'mainnet' ? 'unverified (no DEX has a Stokenet API)' : listing ? `listed by ${DEX_NAMES[listing.dex]}` : 'NOT listed by any supported DEX';

/** Each position's range against the pool's current tick ('unknown' when either cannot be read). */
const rangesOf = (p: PrecisionPosition) =>
  p.ids.map((id) => ({
    id,
    ...(p.ranges[id] ?? { left: null, right: null }),
    status: p.currentTick !== null && p.ranges[id] ? rangeStatus(p.currentTick, p.ranges[id]) : ('unknown' as const),
  }));

export const getPoolPositionsTool = defineMcpTool({
  name: 'get_pool_positions',
  title: 'Read pool positions',
  description:
    'Everything an account has in pools, as the console\'s "Your pool positions" section shows it: every native pool unit it holds (only when the unit and its pool name each other on the ledger) with what the units redeem for now, the share of the pool, which DEX lists the pool and the APR it reports, and how one unit\'s value changed over 7 and 30 days (geometric mean of its tokens, read from the ledger as it was then); and every Ociswap Precision position (concentrated-liquidity NFTs, only collections minted by a real PrecisionPool that names them) with the fees it can claim now and what withdrawing returns, both simulated with the real transactions, and whether each position is in range (out of range — price below or above its tick bounds — it earns no fees until the price comes back; withdrawing and adding with a new range is the fix). Use build_dex_manifest to act on them, build_pool_manifest "redeem" for native units.',
  category: 'console',
  inputSchema: z.object({
    account: z.string().describe('Account address (account_…)'),
    network: networkSchema,
  }),
  handler: async ({ account, network }, ctx) => {
    assertAddressOnNetwork('account', account, network);
    const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
    const holdings = mapHoldings((await fetchEntityDetailsLive(account, network)) as Record<string, unknown>);
    const [units, precision] = await Promise.all([
      findPoolUnitPositions(post, holdings.fungibles),
      findPrecisionPositions(post, holdings.nonFungibles),
    ]);

    const unitRows = await Promise.all(
      units.map(async (u) => {
        const [listing, week, month] = await Promise.all([
          getDexListing(network, u.pool.address).catch(() => null),
          unitValueChange(post, u.pool.address, u.pool.poolUnit, 7),
          unitValueChange(post, u.pool.address, u.pool.poolUnit, 30),
        ]);
        return { ...u, listing, week, month, apr: listing ? listing.aprByPool[u.pool.address] ?? listing.apr : null };
      }),
    );
    const precisionRows = await Promise.all(
      precision.map(async (p) => {
        const group = [{ pool: p.pool, lpResource: p.lpResource, ids: p.ids }];
        const [listing, fees, withdraw] = await Promise.all([
          getDexListing(network, p.pool).catch(() => null),
          received(claimFeesManifest(account, group), account, network, [p.lpResource]),
          received(removePositionsManifest(account, group), account, network, [p.lpResource]),
        ]);
        return { ...p, listing, fees, withdraw };
      }),
    );

    return {
      text: cliRender(
        cliBanner(`Radix pool positions · ${units.length + precision.length}`),
        cliSection(`Native pool units · ${unitRows.length}`),
        unitRows.length
          ? unitRows
              .map((u) =>
                cliKeyValues([
                  ['Pool', `${u.name || u.pool.address} (${u.pool.address})`],
                  ['Units', `${u.units} (${u.supply > 0 ? ((u.units / u.supply) * 100).toFixed(4) : 0} % of the pool)`],
                  ['Worth now', amounts(u.value)],
                  ['DEX', listingText(u.listing, network)],
                  ...(u.apr !== null ? ([['DEX APR', `${(u.apr * 100).toFixed(2)} %`]] as Array<[string, string]>) : []),
                  ['Unit value, 7 days', u.week ? `${pct(u.week.growth)} (${pct(u.week.annualized)} a year)` : 'no data'],
                  ['Unit value, 30 days', u.month ? `${pct(u.month.growth)} (${pct(u.month.annualized)} a year)` : 'no data'],
                ]),
              )
              .join('\n\n')
          : 'None.',
        cliSection(`Ociswap Precision positions · ${precisionRows.length}`),
        precisionRows.length
          ? precisionRows
              .map((p) =>
                cliKeyValues([
                  ['Pool', `${p.name || p.pool} (${p.pool})`],
                  ['Positions', `${p.ids.length}: ${p.ids.join(', ')} of ${p.lpResource}`],
                  ['Range', rangesOf(p).map((r) => `${r.id} ${r.status === 'in' ? 'in range' : r.status === 'unknown' ? 'unknown' : `OUT OF RANGE (price ${r.status}, earns no fees)`}`).join('; ')],
                  ['DEX', listingText(p.listing, network)],
                  ['Fees to claim now', p.fees.status === 'Succeeded' ? amounts(p.fees.received) : `simulation failed: ${p.fees.error}`],
                  ['Withdrawing returns', p.withdraw.status === 'Succeeded' ? amounts(p.withdraw.received) : `simulation failed: ${p.withdraw.error}`],
                ]),
              )
              .join('\n\n')
          : 'None.',
        cliNext([
          'build_dex_manifest "claim_fees" / "withdraw_positions" for Precision positions; "add" to add more to a DEX pool',
          'build_pool_manifest "redeem" to take native pool units out',
          `Same view in the console (wallet required): ${ctx.origin}/en/console/pool-positions?account=${account}`,
        ]),
      ),
      structured: {
        account,
        units: unitRows.map((u) => ({
          pool: u.pool.address,
          poolUnit: u.pool.poolUnit,
          name: u.name || null,
          units: u.units,
          supply: u.supply,
          value: u.value,
          dex: u.listing?.dex ?? null,
          dexComponent: u.listing?.component ?? null,
          apr: u.apr,
          change7d: u.week ? { growth: u.week.growth, annualized: u.week.annualized } : null,
          change30d: u.month ? { growth: u.month.growth, annualized: u.month.annualized } : null,
        })),
        precision: precisionRows.map((p) => ({
          pool: p.pool,
          lpResource: p.lpResource,
          name: p.name || null,
          ids: p.ids,
          currentTick: p.currentTick,
          ranges: rangesOf(p),
          listed: p.listing !== null,
          feesNow: p.fees.status === 'Succeeded' ? p.fees.received : null,
          withdrawReturns: p.withdraw.status === 'Succeeded' ? p.withdraw.received : null,
        })),
      },
    };
  },
});

const OPERATIONS = ['add', 'claim_fees', 'withdraw_positions'] as const;

export const buildDexManifestTool = defineMcpTool({
  name: 'build_dex_manifest',
  title: 'Build DEX liquidity manifest',
  description:
    'Builds one transaction on a pool a DEX runs. "add": liquidity through the DEX component, for Ociswap Basic and Flex (both tokens, in the reserves\' ratio; the excess comes back), DefiPlaza (one token, its "side"; the other token too only when that side is in shortage) and Ociswap Precision (a price range: "range" full, or minPrice/maxPrice in y per x; you receive a position NFT). A DEX-run native pool refuses build_pool_manifest "contribute" (only its component may contribute), so use this. "claim_fees": the fees of Precision positions, keeping them. "withdraw_positions": closes Precision positions (liquidity + pending fees, the NFTs burn). The DEX is read from the ledger and the component must really run the pool; whether the DEX itself lists it is checked on mainnet (no DEX has a Stokenet API): if it is NOT listed, tell the user plainly before they sign. Returns the manifest and what the account would receive, simulated.',
  category: 'console',
  inputSchema: z.object({
    operation: z.enum(OPERATIONS).describe('What to do'),
    account: z.string().describe('Account that signs and receives'),
    pool: z.string().describe('Native pool (pool_…) a DEX runs, or the DEX component (component_…), e.g. a Precision pool'),
    amounts: z.record(z.string(), z.string()).optional().describe('add: { resource: amount }. Ociswap Basic/Flex: both tokens. DefiPlaza: the side\'s token (+ the other in shortage). Precision: the tokens the range takes.'),
    side: z.enum(['base', 'quote']).optional().describe('add, DefiPlaza only: the side the liquidity goes to (default base)'),
    range: z
      .union([z.literal('full'), z.object({ minPrice: z.number().positive(), maxPrice: z.number().positive() })])
      .optional()
      .describe('add, Precision only: "full" (default) or a price range in y per x'),
    ids: z.array(z.string()).optional().describe('claim_fees / withdraw_positions: position NFT ids; default every position the account holds in that pool'),
    network: networkSchema,
    locale: localeSchema,
  }),
  handler: async (input, ctx) => {
    const { operation, account, network, locale } = input;
    assertAddressOnNetwork('account', account, network);
    const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
    const dex = await resolveDexPool(post, input.pool);
    if (!dex) throw new Error(`${input.pool} is not run by a supported DEX (Ociswap Basic, Flex or Precision, DefiPlaza). For an own pool use build_pool_manifest.`);
    const listing = await getDexListing(network, dex.component).catch(() => null);
    const notes: Array<[string, string]> = [
      ['DEX', `${KIND_NAMES[dex.kind]} · ${dex.component}`],
      ['Listing', listingText(listing, network)],
    ];

    let manifest = '';
    if (operation === 'add') {
      const given = input.amounts ?? {};
      for (const [resource, amount] of Object.entries(given)) {
        if (resource !== dex.x && resource !== dex.y) throw new Error(`${resource} is not one of the pool's tokens: ${dex.x}, ${dex.y}.`);
        if (!isPositiveDecimal(amount)) throw new Error(`Invalid amount "${amount}".`);
      }
      let range: { left: number; right: number } | undefined;
      if (dex.kind === 'ociswap-precision') {
        range =
          !input.range || input.range === 'full'
            ? fullRangeTicks(dex.tickSpacing)
            : rangeTicks(input.range.minPrice, input.range.maxPrice, dex.tickSpacing) ?? undefined;
        if (!range) throw new Error('The price range is not valid: minPrice must be below maxPrice.');
        notes.push(['Current price', `${dex.priceSqrt ** 2} ${dex.y} per ${dex.x}`], ['Range (ticks)', `${range.left} to ${range.right}`]);
      }
      if (dex.kind === 'defiplaza') notes.push(['Side', `${input.side ?? 'base'} (shortage: ${dex.shortage})`]);
      manifest = addLiquidityManifest({ account, dex, amounts: given, side: input.side ?? 'base', range });
      if (!manifest) throw new Error('Missing amounts: see the "amounts" description for what this pool takes.');
    } else {
      if (dex.kind !== 'ociswap-precision') throw new Error(`"${operation}" is for Ociswap Precision positions; for native pool units use build_pool_manifest "redeem".`);
      const holdings = mapHoldings((await fetchEntityDetailsLive(account, network)) as Record<string, unknown>);
      const held = holdings.nonFungibles.find((n) => n.resourceAddress === dex.lpResource)?.ids ?? [];
      const ids = input.ids?.length ? input.ids : held;
      const missing = ids.filter((id) => !held.includes(id));
      if (!ids.length) throw new Error(`The account holds no positions of ${dex.component}.`);
      if (missing.length) throw new Error(`The account does not hold ${missing.join(', ')}.`);
      const group = [{ pool: dex.component, lpResource: dex.lpResource, ids }];
      manifest = operation === 'claim_fees' ? claimFeesManifest(account, group) : removePositionsManifest(account, group);
      notes.push(['Positions', ids.join(', ')]);
    }

    manifest = manifest.trim();
    const [validation, simulation] = await Promise.all([
      staticallyValidateManifest(manifest, network),
      received(manifest, account, network, dex.kind === 'ociswap-precision' && operation !== 'add' ? [dex.lpResource] : []),
    ]);
    if (network === 'mainnet' && !listing) notes.push(['⚠ Warning', 'the DEX does not list this component: confirm with the user before signing']);

    return {
      text: cliRender(
        cliBanner(`Radix DEX · ${operation}`),
        cliCode(manifest),
        cliKeyValues([
          ...notes,
          ['Account', account],
          ['Network', network],
          ['Simulation', simulation.status === 'Succeeded' ? `succeeds; the account receives ${amounts(simulation.received)}` : `FAILS: ${simulation.error}`],
          ['Static validation', validation.valid ? 'VALID' : `INVALID: ${validation.error}`],
        ]),
        cliNext([
          ...signingSteps(ctx.origin, network, locale, validation),
          `Console form: ${ctx.origin}/${locale}/console/${operation === 'add' ? 'pool-dex-add' : 'pool-positions'}?${operation === 'add' ? `pool=${input.pool}&` : ''}account=${account}`,
        ]),
      ),
      structured: {
        manifest,
        network,
        operation,
        dex: dex.kind,
        component: dex.component,
        listed: listing !== null,
        valid: validation.valid,
        simulation: { status: simulation.status, error: simulation.error, received: simulation.received },
      },
    };
  },
});

export const dexTools = [getPoolPositionsTool, buildDexManifestTool];
