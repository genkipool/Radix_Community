import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { cacheLife, cacheTag } from 'next/cache';
import { withRetry } from '@/services/gateway/client';
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/features/dashboard/types';
import {
    BigNumber,
    lsuHoldingsXrd,
    lsulpRate,
    poolUnitPositionXrd,
    poolUnitValues,
    precisionPositionXrd,
    shapeClaimsXrd,
    type PrecisionPosition,
    type ShapePoolState,
    type XrdRates,
} from '../lib/votePowerMath';
import {
    findEpoch,
    LSULP_COMPONENT_ADDRESS,
    LSULP_RESOURCE_ADDRESS,
    VOTE_POWER_EPOCHS,
    XRD_ADDRESS,
    type VotePowerSourceConfig,
} from '../lib/votePowerPools';
import { checkedStateVersion, followCursor, requireAll, requireIds, withMissingAccounts } from '../lib/votePowerChecks';

/**
 * Voting power of accounts at a past moment, computed the way the Radix DAO
 * vote collector weighs ballots (its VotePowerSnapshot): the ledger state at
 * the snapshot, then XRD + LSUs + LSULP + XRD/LSU/LSULP inside DEX pools
 * (pool units, Ociswap precision and CaviarNine shape positions) as the
 * source epoch of that date lists them.
 *
 * The collector does not publish per-ballot power for elections, so this is
 * how the comparison weighs an election ballot. A past ledger state never
 * changes, so every Gateway read is cached for good. Requests are batched
 * (20 addresses per call) and capped at a few in flight.
 */

const PER_REQUEST = 20;
const NF_DATA_PER_REQUEST = 100;
const MAX_IN_FLIGHT = 6;
const REQUEST_TIMEOUT_MS = 8_000;
/** A snapshot this close to now may still be moving on the Gateway: not cached. */
const SETTLED_MS = 10 * 60_000;

let inFlight = 0;
const waiting: Array<() => void> = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
    if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>(resolve => waiting.push(resolve));
    inFlight++;
    try {
        return await fn();
    } finally {
        inFlight--;
        waiting.shift()?.();
    }
}

/** Gateway POST, rate limited, timed out per attempt and retried (a timeout counts as transient). */
function post<T>(network: Network, path: string, body: Record<string, unknown>): Promise<T> {
    // The caller's cancellation travels by async context: cached functions only take serializable arguments.
    const outer = cancellation.getStore();
    return withRetry(() => limited(() => {
        outer?.throwIfAborted();
        const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        return gatewayPost<T>(network, path, body, { signal: outer ? AbortSignal.any([outer, timeout]) : timeout });
    }), 4, 0, outer);
}

/** Cancellation of the current fetchSnapshotVotePowers call, if its caller gave one. */
const cancellation = new AsyncLocalStorage<AbortSignal>();

function chunk<T>(items: readonly T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

// ---------------------------------------------------------------------------
// Programmatic JSON, read as strictly as the collector's sbor-ez-mode schemas
// ---------------------------------------------------------------------------

interface Pj { kind?: string; field_name?: string; value?: unknown; variant_name?: string; fields?: Pj[]; entries?: Array<{ key?: Pj; value?: Pj }> }

class SborShapeError extends Error {}

const INT_KINDS = new Set(['U8', 'U16', 'U32', 'U64', 'U128', 'I8', 'I16', 'I32', 'I64', 'I128']);

function field(v: Pj | undefined, name: string): Pj {
    if (v?.kind !== 'Tuple') throw new SborShapeError(`not a tuple at ${name}`);
    const f = v.fields?.find(x => x.field_name === name);
    if (!f) throw new SborShapeError(`missing field ${name}`);
    return f;
}
function decimal(v: Pj | undefined): string {
    if ((v?.kind !== 'Decimal' && v?.kind !== 'PreciseDecimal') || typeof v.value !== 'string') throw new SborShapeError('not a decimal');
    return v.value;
}
function integer(v: Pj | undefined): number {
    if (!v?.kind || !INT_KINDS.has(v.kind) || typeof v.value !== 'string') throw new SborShapeError('not an integer');
    return Number(v.value);
}
function option(v: Pj | undefined): Pj | null {
    if (v?.kind !== 'Enum') throw new SborShapeError('not an option');
    if (v.variant_name === 'None' && (v.fields?.length ?? 0) === 0) return null;
    if (v.variant_name === 'Some' && v.fields?.length === 1) return v.fields[0];
    throw new SborShapeError('bad option');
}
function text(v: Pj | undefined): string {
    if (typeof v?.value !== 'string') throw new SborShapeError('not an address');
    return v.value;
}

/** Ociswap LP NFT data, or null when it does not parse (the collector skips it). */
function parsePrecisionPosition(data: Pj | undefined): PrecisionPosition | null {
    try {
        return {
            liquidity: decimal(field(data, 'liquidity')),
            leftBound: integer(field(data, 'left_bound')),
            rightBound: integer(field(data, 'right_bound')),
        };
    } catch {
        return null;
    }
}

/** CaviarNine liquidity receipt claims (tick, amount), or null when they do not parse. */
function parseShapeClaims(data: Pj | undefined): Array<[number, string]> | null {
    try {
        const map = field(data, 'liquidity_claims');
        if (map.kind !== 'Map') return null;
        return (map.entries ?? []).map(e => {
            if (!e.key || !e.value) throw new SborShapeError('bad entry');
            return [integer(e.key), decimal(e.value)];
        });
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Gateway payloads
// ---------------------------------------------------------------------------

interface FungibleItem { resource_address?: string; amount?: string }
interface NonFungibleItem { resource_address?: string; amount?: number | string }
interface EntityItem {
    address?: string;
    details?: {
        type?: string;
        total_supply?: string;
        state?: Pj;
        native_resource_details?: { kind?: string; unit_redemption_value?: Array<{ amount?: string }> };
    };
    fungible_resources?: { items?: FungibleItem[]; next_cursor?: string | null; total_count?: number | null };
    non_fungible_resources?: { items?: NonFungibleItem[]; next_cursor?: string | null; total_count?: number | null };
}
interface DetailsPage { items?: EntityItem[] }
interface Page<T> { items?: T[]; next_cursor?: string | null }

/**
 * Entity details of every address at `version`. Throws unless each one comes
 * back: the Gateway omits an entity that does not exist (yet) at that version,
 * and a cached result must never mistake that, or a short reply, for zero.
 */
async function details(network: Network, version: number, addresses: string[], what: string, extra: Record<string, unknown> = {}): Promise<EntityItem[]> {
    return requireAll(addresses, await detailsAsReturned(network, version, addresses, extra), what);
}

/** Entity details at `version`, as returned (entities missing at that version are simply absent). */
async function detailsAsReturned(network: Network, version: number, addresses: string[], extra: Record<string, unknown> = {}): Promise<EntityItem[]> {
    const pages = await Promise.all(chunk(addresses, PER_REQUEST).map(part =>
        post<DetailsPage>(network, '/state/entity/details', { addresses: part, at_ledger_state: { state_version: version }, ...extra })));
    return pages.flatMap(p => p.items ?? []);
}

/** Every Global-aggregated fungible of an entity item, following its cursor. */
function allFungibles(network: Network, version: number, item: EntityItem): Promise<FungibleItem[]> {
    return followCursor({ items: item.fungible_resources?.items ?? [], cursor: item.address ? item.fungible_resources?.next_cursor : null }, cursor =>
        post<Page<FungibleItem>>(network, '/state/entity/page/fungibles/', {
            address: item.address, aggregation_level: 'Global', cursor, at_ledger_state: { state_version: version },
        }));
}

function allNonFungibles(network: Network, version: number, item: EntityItem): Promise<NonFungibleItem[]> {
    return followCursor({ items: item.non_fungible_resources?.items ?? [], cursor: item.address ? item.non_fungible_resources?.next_cursor : null }, cursor =>
        post<Page<NonFungibleItem>>(network, '/state/entity/page/non-fungibles/', {
            address: item.address, aggregation_level: 'Global', cursor, at_ledger_state: { state_version: version },
        }));
}

/** Positive balances, as the collector's GetFungibleBalance keeps them. */
const positive = (amount: string | undefined): amount is string => amount !== undefined && new BigNumber(amount).gt(0);

// ---------------------------------------------------------------------------
// Cached reads (past ledger states never change)
// ---------------------------------------------------------------------------

async function readStateVersion(network: Network, timestamp: string): Promise<number> {
    const res = await post<{ ledger_state?: { state_version?: number; proposer_round_timestamp?: string } }>(network, '/stream/transactions', {
        limit_per_page: 1, at_ledger_state: { timestamp },
    });
    return checkedStateVersion(timestamp, res.ledger_state);
}

async function cachedStateVersion(network: Network, timestamp: string): Promise<number> {
    'use cache';
    cacheLife('max');
    cacheTag('vote-power-snapshot');
    return readStateVersion(network, timestamp);
}

/** Ledger state version at `timestamp` (the collector's GetLedgerState via /stream/transactions). */
function stateVersionAt(network: Network, timestamp: string): Promise<number> {
    return Date.parse(timestamp) < Date.now() - SETTLED_MS ? cachedStateVersion(network, timestamp) : readStateVersion(network, timestamp);
}

const epochAt = (effectiveFromMs: number): VotePowerSourceConfig =>
    VOTE_POWER_EPOCHS.find(e => e.effectiveFrom.getTime() === effectiveFromMs) ?? findEpoch(VOTE_POWER_EPOCHS, new Date(effectiveFromMs));

interface SharedState {
    rates: XrdRates;
    /** Pool-unit pools by LP resource: XRD-relevant underlying per unit. */
    poolUnits: Record<string, Array<{ resource: string; value: string }>>;
    /** Precision pool `price_sqrt` by component. */
    precisionPrice: Record<string, string>;
    /** Shape pool state by component, without bins. */
    shape: Record<string, Omit<ShapePoolState, 'bins' | 'token_x' | 'token_y'> & { binMap: string }>;
}

/** Rates and pool states at one ledger version, shared by every account. */
async function sharedStateAt(network: Network, version: number, effectiveFromMs: number): Promise<SharedState> {
    'use cache';
    cacheLife('max');
    cacheTag('vote-power-snapshot');
    const epoch = epochAt(effectiveFromMs);
    const precisionPools = [...epoch.precisionPoolsV1, ...epoch.precisionPoolsV2];

    // Validators: every LSU and its redemption value (collector's buildLsuConverterMap).
    type Validator = { metadata?: { items?: Array<{ key?: string; value?: { typed?: { type?: string; value?: string } } }> }; state?: { stake_unit_resource_address?: string } };
    const validatorsAt = (cursor?: string) => post<{ validators?: Page<Validator> }>(
        network, '/state/validators/list', { at_ledger_state: { state_version: version }, ...(cursor ? { cursor } : {}) });
    const firstValidators = await validatorsAt();
    const validators = await followCursor<Validator>(
        { items: firstValidators.validators?.items ?? [], cursor: firstValidators.validators?.next_cursor },
        async cursor => (await validatorsAt(cursor)).validators ?? {},
    );
    const lsus: string[] = [];
    for (const v of validators) {
        const meta = v.metadata?.items?.find(m => m.key === 'pool_unit' && m.value?.typed?.type === 'GlobalAddress')?.value?.typed?.value;
        const lsu = meta ?? v.state?.stake_unit_resource_address;
        if (!lsu) throw new Error('Validator without an LSU resource');
        lsus.push(lsu);
    }

    const [lsuItems, lsulpItems, poolItems, lpItems, precisionItems, shapeItems] = await Promise.all([
        details(network, version, lsus, 'LSU', { opt_ins: { native_resource_details: true } }),
        details(network, version, [LSULP_COMPONENT_ADDRESS, LSULP_RESOURCE_ADDRESS], 'LSULP'),
        details(network, version, epoch.poolUnitPools.map(p => p.poolAddress), 'pool', { aggregation_level: 'Global' }),
        details(network, version, epoch.poolUnitPools.map(p => p.lpResourceAddress), 'pool unit'),
        details(network, version, precisionPools.map(p => p.componentAddress), 'precision pool'),
        details(network, version, epoch.shapePools.map(p => p.componentAddress), 'shape pool'),
    ]);

    // Every LSU comes from a validator at this very version, so each one must read as an LSU.
    const lsuRedemption: Record<string, string> = {};
    for (const it of lsuItems) {
        const nrd = it.details?.native_resource_details;
        if (!it.address || it.details?.type !== 'FungibleResource' || nrd?.kind !== 'ValidatorLiquidStakeUnit') throw new Error('Unexpected LSU entity');
        // An LSU with nothing staked has no redemption value: worth 0, as in the collector.
        lsuRedemption[it.address] = nrd.unit_redemption_value?.[0]?.amount ?? '0';
    }

    // LSULP: dex_valuation_xrd / total_supply.
    const comp = lsulpItems.find(i => i.address === LSULP_COMPONENT_ADDRESS);
    const res = lsulpItems.find(i => i.address === LSULP_RESOURCE_ADDRESS);
    if (res?.details?.type !== 'FungibleResource' || comp?.details?.type !== 'Component' || comp.details.state?.kind !== 'Tuple') {
        throw new Error('Unexpected LSULP entity shape');
    }
    const valuation = comp.details.state.fields?.find(f => f.field_name === 'dex_valuation_xrd' && f.kind === 'Decimal');
    if (typeof valuation?.value !== 'string') throw new Error('LSULP state has no dex_valuation_xrd');
    const lsulp = lsulpRate(valuation.value, res.details.total_supply);

    const poolUnits: SharedState['poolUnits'] = {};
    for (const pool of epoch.poolUnitPools) {
        const lp = lpItems.find(i => i.address === pool.lpResourceAddress);
        if (lp?.details?.type !== 'FungibleResource') throw new Error('Unexpected pool unit entity');
        const poolItem = poolItems.find(i => i.address === pool.poolAddress) as EntityItem;
        const balances = (await allFungibles(network, version, poolItem))
            .filter(f => f.resource_address && positive(f.amount))
            .map(f => ({ resource: f.resource_address as string, amount: f.amount as string }));
        // An empty pool or one with no supply is legitimately worth 0.
        poolUnits[pool.lpResourceAddress] = poolUnitValues(balances, lp.details.total_supply ?? '0');
    }

    const precisionPrice: SharedState['precisionPrice'] = {};
    for (const it of precisionItems) {
        if (!it.address || it.details?.type !== 'Component') throw new Error('Unexpected precision pool entity');
        const state = it.details.state;
        option(field(state, 'active_tick'));
        precisionPrice[it.address] = decimal(field(state, 'price_sqrt'));
    }

    const shape: SharedState['shape'] = {};
    for (const it of shapeItems) {
        if (!it.address || it.details?.type !== 'Component') throw new Error('Unexpected shape pool entity');
        const state = it.details.state;
        integer(field(state, 'bin_span'));
        const tickIndex = field(state, 'tick_index');
        text(field(tickIndex, 'kvs'));
        const current = option(field(tickIndex, 'current'));
        let currentTick: number | undefined;
        if (current) {
            if (current.kind !== 'Tuple' || current.fields?.length !== 1) throw new SborShapeError('bad current tick');
            currentTick = integer(current.fields[0]);
        }
        shape[it.address] = {
            currentTick,
            binMap: text(field(state, 'bin_map')),
            activeX: decimal(field(state, 'active_x')),
            activeY: decimal(field(state, 'active_y')),
            activeTotalClaim: decimal(field(state, 'active_total_claim')),
        };
    }

    return { rates: { lsuRedemption, lsulpRate: lsulp }, poolUnits, precisionPrice, shape };
}

interface AccountHoldings {
    /** XRD, LSULP, LSU and pool-unit LP balances (positive only). */
    fungibles: Record<string, string>;
    /** Ociswap LP positions by LP resource. */
    precision: Record<string, PrecisionPosition[]>;
    /** CaviarNine receipts by receipt resource: each one's claims. */
    shape: Record<string, Array<Array<[number, string]>>>;
}

interface ChunkHoldings {
    accounts: Record<string, AccountHoldings>;
    /** Bins claimed by these accounts: shape component -> tick -> bin. */
    bins: Record<string, Record<string, { amount: string; totalClaim: string }>>;
}

async function nftIds(network: Network, version: number, address: string, resource: string): Promise<string[]> {
    type Vault = { vault_address?: string; items?: string[]; next_cursor?: string | null };
    const vaultsPage = (cursor?: string) => post<Page<Vault>>(network, '/state/entity/page/non-fungible-vaults/', {
        address, resource_address: resource, at_ledger_state: { state_version: version },
        opt_ins: { non_fungible_include_nfids: true }, ...(cursor ? { cursor } : {}),
    });
    const first = await vaultsPage();
    const vaults = await followCursor({ items: first.items ?? [], cursor: first.next_cursor }, vaultsPage);
    const ids: string[] = [];
    for (const vault of vaults) {
        ids.push(...await followCursor({ items: vault.items ?? [], cursor: vault.vault_address ? vault.next_cursor : null }, cursor =>
            post<Page<string>>(network, '/state/entity/page/non-fungible-vault/ids', {
                address, resource_address: resource, vault_address: vault.vault_address, cursor,
                at_ledger_state: { state_version: version },
            })));
    }
    return ids;
}

/**
 * Holdings that carry voting power for up to 20 accounts, plus the shape bins
 * they claim. `lsus` (validator LSU resources) and `binMaps` (shape component
 * -> bin map store) come from sharedStateAt at the same version.
 */
async function holdingsAt(
    network: Network,
    version: number,
    effectiveFromMs: number,
    accounts: string[],
    lsus: string[],
    binMaps: Record<string, string>,
): Promise<ChunkHoldings> {
    'use cache';
    cacheLife('max');
    cacheTag('vote-power-snapshot');
    const epoch = epochAt(effectiveFromMs);
    const lsuSet = new Set(lsus);
    const lpResources = new Set(epoch.poolUnitPools.map(p => p.lpResourceAddress));
    const precisionByLp = new Map([...epoch.precisionPoolsV1, ...epoch.precisionPoolsV2].map(p => [p.lpResourceAddress, p]));
    const shapeByReceipt = new Map(epoch.shapePools.map(p => [p.liquidity_receipt, p]));
    const counted = (r: string) => r === XRD_ADDRESS || r === LSULP_RESOURCE_ADDRESS || lsuSet.has(r) || lpResources.has(r);

    // An account created after the snapshot is absent at that version. One missing from the
    // batch is asked for alone; missing again, it held nothing then (power 0, as the collector
    // weighs it). Only an error, never a silent gap, ends the recount.
    const opts = { aggregation_level: 'Global' };
    const { items, absent } = await withMissingAccounts(
        accounts,
        await detailsAsReturned(network, version, accounts, opts),
        address => detailsAsReturned(network, version, [address], opts),
    );
    const out: ChunkHoldings = { accounts: {}, bins: {} };
    for (const address of absent) out.accounts[address] = { fungibles: {}, precision: {}, shape: {} };
    // NFT ids to read: resource -> [account, id][]
    const wanted = new Map<string, Array<[string, string]>>();

    await Promise.all(items.map(async item => {
        const address = item.address;
        if (!address) return;
        const holdings: AccountHoldings = { fungibles: {}, precision: {}, shape: {} };
        out.accounts[address] = holdings;
        for (const f of await allFungibles(network, version, item)) {
            if (f.resource_address && counted(f.resource_address) && positive(f.amount)) holdings.fungibles[f.resource_address] = f.amount;
        }
        const nfts = (await allNonFungibles(network, version, item))
            .filter(n => n.resource_address && (precisionByLp.has(n.resource_address) || shapeByReceipt.has(n.resource_address)) && Number(n.amount ?? 0) > 0);
        for (const n of nfts) {
            const resource = n.resource_address as string;
            for (const id of await nftIds(network, version, address, resource)) {
                const list = wanted.get(resource) ?? [];
                list.push([address, id]);
                wanted.set(resource, list);
            }
        }
    }));

    const claimedTicks = new Map<string, Set<number>>();
    for (const [resource, pairs] of wanted) {
        const owner = new Map(pairs.map(([acc, id]) => [id, acc]));
        const parts = chunk(pairs.map(([, id]) => id), NF_DATA_PER_REQUEST);
        const pages = await Promise.all(parts.map(async ids => {
            const page = await post<{ non_fungible_ids?: Array<{ non_fungible_id?: string; is_burned?: boolean; data?: { programmatic_json?: Pj } }> }>(
                network, '/state/non-fungible/data', { resource_address: resource, non_fungible_ids: ids, at_ledger_state: { state_version: version } });
            requireIds(ids, page.non_fungible_ids ?? []);
            return page;
        }));
        for (const nft of pages.flatMap(p => p.non_fungible_ids ?? [])) {
            const acc = nft.non_fungible_id ? owner.get(nft.non_fungible_id) : undefined;
            const data = nft.data?.programmatic_json;
            if (!acc || !data || nft.is_burned) continue;
            const holdings = out.accounts[acc];
            if (precisionByLp.has(resource)) {
                const pos = parsePrecisionPosition(data);
                if (pos) (holdings.precision[resource] ??= []).push(pos);
            } else {
                const claims = parseShapeClaims(data);
                if (!claims) continue;
                (holdings.shape[resource] ??= []).push(claims);
                const component = shapeByReceipt.get(resource)?.componentAddress;
                if (component) {
                    const set = claimedTicks.get(component) ?? new Set<number>();
                    for (const [tick] of claims) set.add(tick);
                    claimedTicks.set(component, set);
                }
            }
        }
    }

    // Only the bins someone claims are read: the collector reads whole bin maps but looks up nothing else.
    await Promise.all([...claimedTicks].map(async ([component, ticks]) => {
        const binMap = binMaps[component];
        if (!binMap) return;
        const bins: Record<string, { amount: string; totalClaim: string }> = {};
        const parts = chunk([...ticks].sort((a, b) => a - b), NF_DATA_PER_REQUEST);
        for (const part of parts) {
            const res = await post<{ entries?: Array<{ key?: { programmatic_json?: Pj }; value?: { programmatic_json?: Pj } }> }>(network, '/state/key-value-store/data', {
                key_value_store_address: binMap,
                keys: part.map(t => ({ key_json: { kind: 'Tuple', fields: [{ kind: 'U32', value: String(t) }] } })),
                at_ledger_state: { state_version: version },
            });
            for (const e of res.entries ?? []) {
                const key = e.key?.programmatic_json;
                if (key?.kind !== 'Tuple' || key.fields?.length !== 1) throw new SborShapeError('bad bin key');
                const value = e.value?.programmatic_json;
                bins[String(integer(key.fields[0]))] = { amount: decimal(field(value, 'amount')), totalClaim: decimal(field(value, 'total_claim')) };
            }
        }
        out.bins[component] = bins;
    }));

    return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Voting power (XRD, as a decimal string) of one account from its holdings. */
function accountVotePower(holdings: AccountHoldings | undefined, shared: SharedState, bins: ChunkHoldings['bins'], epoch: VotePowerSourceConfig): string {
    if (!holdings) return '0';
    const { rates } = shared;
    const f = holdings.fungibles;
    const zero = new BigNumber(0);
    const xrd = epoch.sources.has('xrd') && f[XRD_ADDRESS] ? new BigNumber(f[XRD_ADDRESS]) : zero;
    const lsu = epoch.sources.has('lsu') ? lsuHoldingsXrd(f, rates) : zero;
    const lsulp = epoch.sources.has('lsulp') && f[LSULP_RESOURCE_ADDRESS] ? new BigNumber(rates.lsulpRate).multipliedBy(f[LSULP_RESOURCE_ADDRESS]) : zero;

    let simple = new BigNumber(0);
    for (const pool of epoch.poolUnitPools) {
        const lp = f[pool.lpResourceAddress];
        if (!lp) continue;
        const values = shared.poolUnits[pool.lpResourceAddress];
        if (!values) throw new Error('Pool unit state missing');
        simple = simple.plus(poolUnitPositionXrd(lp, values, rates));
    }

    let precision = new BigNumber(0);
    for (const pool of [...epoch.precisionPoolsV1, ...epoch.precisionPoolsV2]) {
        const positions = holdings.precision[pool.lpResourceAddress] ?? [];
        if (positions.length === 0) continue;
        const price = shared.precisionPrice[pool.componentAddress];
        if (price === undefined) throw new Error('Precision pool state missing');
        for (const pos of positions) {
            const v = precisionPositionXrd(pos, price, pool, rates);
            if (v) precision = precision.plus(v);
        }
    }

    let shape = new BigNumber(0);
    for (const pool of epoch.shapePools) {
        const receipts = holdings.shape[pool.liquidity_receipt] ?? [];
        if (receipts.length === 0) continue;
        const state = shared.shape[pool.componentAddress];
        if (!state) throw new Error('Shape pool state missing');
        const poolState: ShapePoolState = { ...state, token_x: pool.token_x, token_y: pool.token_y, bins: bins[pool.componentAddress] ?? {} };
        for (const claims of receipts) shape = shape.plus(shapeClaimsXrd(claims, poolState, rates));
    }

    return xrd.plus(lsu).plus(lsulp).plus(simple).plus(precision).plus(shape).toFixed();
}

/**
 * Voting power of each account at `snapshotAt` (ISO timestamp), as the vote
 * collector computes it. Accounts are read 20 per request in the given order:
 * pass them in a stable order (first vote first) so a new voter only changes
 * the last cached batch. Mainnet only: the pools and LSULP are mainnet entities.
 */
export function fetchSnapshotVotePowers(
    network: Network,
    snapshotAt: string,
    accounts: readonly string[],
    options: { signal?: AbortSignal } = {},
): Promise<Map<string, string>> {
    // Aborting stops every request and retry of this call; what already finished may still fill the cache.
    return options.signal ? cancellation.run(options.signal, () => computeSnapshotVotePowers(network, snapshotAt, accounts)) : computeSnapshotVotePowers(network, snapshotAt, accounts);
}

async function computeSnapshotVotePowers(network: Network, snapshotAt: string, accounts: readonly string[]): Promise<Map<string, string>> {
    if (network !== 'mainnet') throw new Error('Snapshot voting power is only defined on mainnet');
    const unique = [...new Set(accounts)];
    const out = new Map<string, string>();
    if (unique.length === 0) return out;
    // The collector picks the epoch by the vote's start date; for an election that is
    // round one's opening, which is its snapshotAt today. Revisit if the two ever differ.
    const epoch = findEpoch(VOTE_POWER_EPOCHS, new Date(snapshotAt));
    const from = epoch.effectiveFrom.getTime();
    const version = await stateVersionAt(network, snapshotAt);
    const shared = await sharedStateAt(network, version, from);
    const lsus = Object.keys(shared.rates.lsuRedemption).sort();
    const binMaps = Object.fromEntries(Object.entries(shared.shape).map(([component, s]) => [component, s.binMap]));
    const parts = await Promise.all(chunk(unique, PER_REQUEST).map(part => holdingsAt(network, version, from, part, lsus, binMaps)));
    parts.forEach(part => {
        for (const account of Object.keys(part.accounts)) out.set(account, accountVotePower(part.accounts[account], shared, part.bins, epoch));
    });
    for (const account of unique) if (!out.has(account)) throw new Error('Account missing from the snapshot');
    return out;
}
