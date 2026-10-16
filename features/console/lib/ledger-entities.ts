/**
 * Pools and lockers worth offering in an address picker. The Gateway cannot
 * list every pool or locker on the network (it does not index calls to the
 * native packages), so this gathers the ones that can be found:
 *
 * - those the given accounts have touched (created, contributed to, stored in,
 *   claimed from), from each account's recent transaction stream;
 * - for pools, the ones with recent network-wide contributions or
 *   redemptions, which the Gateway classifies.
 */
import type { GatewayPost } from './resource-holders';

export type LedgerEntityKind = 'pool' | 'locker';

export interface LedgerEntity {
  address: string;
  kind: LedgerEntityKind;
  name: string;
  /** Touched by one of the accounts, not just seen on the network. */
  mine: boolean;
}

interface StreamPage {
  items: { affected_global_entities?: string[] }[];
  next_cursor?: string | null;
}

type MetadataList = { items?: { key: string; value?: { typed?: { value?: unknown; values?: unknown } } }[] };

interface DetailsPage {
  items: {
    address: string;
    metadata?: MetadataList;
    explicit_metadata?: MetadataList;
  }[];
}

const readMeta = (key: string, ...lists: (MetadataList | undefined)[]) => {
  for (const list of lists) {
    const value = list?.items?.find((m) => m.key === key)?.value?.typed?.value;
    if (typeof value === 'string' && value) return value;
  }
  return '';
};

const PREFIX: Record<LedgerEntityKind, string> = { pool: 'pool_', locker: 'locker_' };
const DETAILS_BATCH = 20;

const kindOf = (address: string, kinds: LedgerEntityKind[]) => kinds.find((k) => address.startsWith(PREFIX[k]));

async function collect(
  post: GatewayPost,
  body: Record<string, unknown>,
  kinds: LedgerEntityKind[],
  pages: number,
  into: Set<string>,
) {
  let cursor: string | null | undefined;
  for (let page = 0; page < pages; page++) {
    const data = await post<StreamPage>('/stream/transactions', {
      ...body,
      limit_per_page: 100,
      opt_ins: { affected_global_entities: true },
      ...(cursor ? { cursor } : {}),
    });
    for (const item of data.items) {
      for (const address of item.affected_global_entities ?? []) {
        if (kindOf(address, kinds)) into.add(address);
      }
    }
    cursor = data.next_cursor;
    if (!cursor) break;
  }
}

const readList = (key: string, list?: MetadataList): string[] => {
  // Array metadata comes as `typed.values` (GlobalAddressArray and friends).
  const values = list?.items?.find((m) => m.key === key)?.value?.typed?.values;
  return Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : [];
};

async function details(post: GatewayPost, addresses: string[], keys: string[]) {
  const items: DetailsPage['items'] = [];
  for (let i = 0; i < addresses.length; i += DETAILS_BATCH) {
    const data = await post<DetailsPage>('/state/entity/details', {
      addresses: addresses.slice(i, i + DETAILS_BATCH),
      opt_ins: { explicit_metadata: keys },
    });
    items.push(...data.items);
  }
  return items;
}

/**
 * A readable name for each address: its name metadata or, for pools (which
 * rarely have one), the symbols of the resources it pools, as in "XRD/HUG".
 */
export async function fetchNames(post: GatewayPost, addresses: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const pooled: Record<string, string[]> = {};
  for (const item of await details(post, addresses, ['name', 'pool_resources'])) {
    names[item.address] = readMeta('name', item.explicit_metadata, item.metadata);
    const resources = readList('pool_resources', item.explicit_metadata);
    if (!names[item.address] && resources.length) pooled[item.address] = resources;
  }

  const resources = [...new Set(Object.values(pooled).flat())];
  if (resources.length) {
    const symbols: Record<string, string> = {};
    for (const item of await details(post, resources, ['symbol', 'name'])) {
      symbols[item.address] = readMeta('symbol', item.explicit_metadata) || readMeta('name', item.explicit_metadata);
    }
    for (const [pool, list] of Object.entries(pooled)) {
      names[pool] = list.map((r) => symbols[r] || `${r.slice(0, 12)}…`).join('/');
    }
  }
  return names;
}

export async function findLedgerEntities(
  post: GatewayPost,
  { accounts, kinds, accountPages = 1, networkPages = 1 }: {
    accounts: string[];
    kinds: LedgerEntityKind[];
    accountPages?: number;
    networkPages?: number;
  },
): Promise<LedgerEntity[]> {
  const mine = new Set<string>();
  const network = new Set<string>();

  const lookups: Promise<void>[] = accounts.map((account) =>
    collect(post, { affected_global_entities_filter: [account] }, kinds, accountPages, mine),
  );
  if (kinds.includes('pool')) {
    for (const cls of ['PoolContribution', 'PoolRedemption']) {
      lookups.push(
        collect(post, { manifest_class_filter: { class: cls, match_only_most_specific: false } }, ['pool'], networkPages, network),
      );
    }
  }
  // One source failing (rate limit, timeout) should not hide what the others found.
  await Promise.allSettled(lookups);

  const addresses = [...new Set([...mine, ...network])];
  const names = addresses.length ? await fetchNames(post, addresses).catch(() => ({}) as Record<string, string>) : {};

  return addresses
    .map((address) => ({ address, kind: kindOf(address, kinds)!, name: names[address] ?? '', mine: mine.has(address) }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || Number(!!b.name) - Number(!!a.name) || a.name.localeCompare(b.name));
}
