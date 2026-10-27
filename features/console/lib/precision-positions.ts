/**
 * Ociswap Precision pool positions an account holds, found on the ledger.
 *
 * A Precision pool is Ociswap's own component (concentrated liquidity), not a
 * native pool: each position is an NFT of the pool's LP collection. The LP
 * collection names its pool in the `pool` metadata, but metadata can say
 * anything, so a position only counts when the ledger confirms it:
 *
 * - the named component is a `PrecisionPool`,
 * - its `lp_manager` field is this very collection,
 * - and the collection's minter rule is that component's caller badge, so the
 *   NFTs can only have been minted by it.
 *
 * Whether Ociswap itself lists the pool is checked apart (`dex-listings`).
 *
 * Each position also carries its price range (the NFT's tick bounds) and the
 * pool's current tick: outside its range a position earns no fees.
 */
import { matchGlobalCaller } from './caller-badge';
import { priceToTick } from './dex-pools';
import type { GatewayPost } from './resource-holders';
import { entityRoles } from './role-lookup';

export const PRECISION_BLUEPRINT = 'PrecisionPool';

export interface PrecisionPosition {
  /** The PrecisionPool component. */
  pool: string;
  /** Its LP collection. */
  lpResource: string;
  /** The collection's name, e.g. "Ociswap LP REDDICKS/XRD". */
  name: string;
  iconUrl?: string;
  /** The position NFTs the account holds. */
  ids: string[];
  /** The pool's current tick, null when its price cannot be read. */
  currentTick: number | null;
  /** Each position's tick bounds, by NFT id (missing when the NFT data cannot be read). */
  ranges: Record<string, TickRange>;
}

export interface TickRange {
  left: number;
  right: number;
}

/**
 * Where the pool's price sits against a position's range. Ociswap counts a
 * position as active while left <= tick < right; below the range it holds
 * only x, above it only y, and either way it earns no fees.
 */
export type RangeStatus = 'in' | 'below' | 'above';

export function rangeStatus(tick: number, range: TickRange): RangeStatus {
  if (tick < range.left) return 'below';
  if (tick >= range.right) return 'above';
  return 'in';
}

/** One NFT collection the account holds. */
export interface HeldCollection {
  resourceAddress: string;
  ids: string[];
}

type MetadataItems = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };

interface ResourceItem {
  address: string;
  details?: unknown;
  explicit_metadata?: MetadataItems;
}

interface ComponentItem {
  address: string;
  details?: { blueprint_name?: string; state?: { fields?: { field_name?: string; value?: unknown }[] } };
}

const BATCH = 20;
/** The Gateway's page size for NFT data. */
const NFT_BATCH = 100;

type SborField = { field_name?: string; value?: unknown };
interface NftDataItem {
  non_fungible_id: string;
  is_burned?: boolean;
  data?: { programmatic_json?: { fields?: SborField[] } };
}

const metadataText = (meta: MetadataItems | undefined, key: string) => {
  const value = meta?.items?.find((m) => m.key === key)?.value?.typed?.value;
  return typeof value === 'string' ? value : '';
};

async function details<T>(post: GatewayPost, addresses: string[], optIns?: Record<string, unknown>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < addresses.length; i += BATCH) {
    const page = await post<{ items?: T[] }>('/state/entity/details', {
      addresses: addresses.slice(i, i + BATCH),
      ...(optIns ? { opt_ins: optIns } : {}),
    });
    out.push(...(page.items ?? []));
  }
  return out;
}

/** The pool's current tick, from its `price_sqrt` (price = price_sqrt², y per x). */
function currentTickOf(fields: SborField[] | undefined): number | null {
  const sqrt = Number(fields?.find((f) => f.field_name === 'price_sqrt')?.value);
  return sqrt > 0 && Number.isFinite(sqrt) ? priceToTick(sqrt * sqrt) : null;
}

/** Each position's tick bounds, read from its NFT data. */
async function positionRanges(post: GatewayPost, lpResource: string, ids: string[]): Promise<Record<string, TickRange>> {
  const out: Record<string, TickRange> = {};
  for (let i = 0; i < ids.length; i += NFT_BATCH) {
    const page = await post<{ non_fungible_ids?: NftDataItem[] }>('/state/non-fungible/data', {
      resource_address: lpResource,
      non_fungible_ids: ids.slice(i, i + NFT_BATCH),
    });
    for (const item of page.non_fungible_ids ?? []) {
      const fields = item.data?.programmatic_json?.fields;
      const left = Number(fields?.find((f) => f.field_name === 'left_bound')?.value);
      const right = Number(fields?.find((f) => f.field_name === 'right_bound')?.value);
      if (!item.is_burned && Number.isInteger(left) && Number.isInteger(right)) out[item.non_fungible_id] = { left, right };
    }
  }
  return out;
}

/** The held collections that are confirmed Precision pool positions, one entry per pool. */
export async function findPrecisionPositions(post: GatewayPost, held: HeldCollection[]): Promise<PrecisionPosition[]> {
  const withIds = held.filter((c) => c.ids.length > 0);
  if (!withIds.length) return [];

  const resources = await details<ResourceItem>(post, withIds.map((c) => c.resourceAddress), {
    explicit_metadata: ['pool', 'name', 'icon_url'],
  });
  // Collections that name a component as their pool and are minted by exactly that component.
  const candidates = resources.flatMap((r) => {
    const pool = metadataText(r.explicit_metadata, 'pool');
    if (!pool.startsWith('component_')) return [];
    const minter = entityRoles(r).find((role) => role.name === 'minter');
    if (!minter || matchGlobalCaller(minter.rule, [pool]) !== pool) return [];
    return [{ resource: r.address, pool, name: metadataText(r.explicit_metadata, 'name'), iconUrl: metadataText(r.explicit_metadata, 'icon_url') }];
  });
  if (!candidates.length) return [];

  const components = await details<ComponentItem>(post, [...new Set(candidates.map((c) => c.pool))]);
  const precision = new Map(
    components.filter((c) => c.details?.blueprint_name === PRECISION_BLUEPRINT).map((c) => [c.address, c.details?.state?.fields] as const),
  );

  const confirmed = candidates.filter((c) => precision.get(c.pool)?.find((f) => f.field_name === 'lp_manager')?.value === c.resource);
  return Promise.all(
    confirmed.map(async (c) => {
      const ids = withIds.find((h) => h.resourceAddress === c.resource)!.ids;
      return {
        pool: c.pool,
        lpResource: c.resource,
        name: c.name,
        iconUrl: c.iconUrl || undefined,
        ids,
        currentTick: currentTickOf(precision.get(c.pool)),
        ranges: await positionRanges(post, c.resource, ids),
      };
    }),
  );
}
