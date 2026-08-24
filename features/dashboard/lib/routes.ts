/**
 * The single source of truth for dashboard URLs.
 *
 * Every link, redirect and navigation goes through here, so the shape of a
 * dashboard URL is defined once instead of being assembled by hand at each call
 * site (which is how the old `?view=…&tx=…` links drifted apart and how the MCP
 * tools ended up emitting a `?search=` parameter nothing ever read).
 *
 * The contract is deliberately split in two:
 *
 *  - **Path = identity.** What the page is about: the staking list, the
 *    explorer, or one entity. Paths are shareable, cacheable and indexable.
 *  - **Query = view state.** How you are looking at it: network, date range,
 *    tag. Personal preferences (columns, reading mode) stay in cookies and must
 *    never reach the URL, or two people opening the same link would see
 *    different things.
 *
 * Adding a new entity kind is a two-line change here plus its route folder;
 * nothing else in the app needs to know.
 */
import type { DashboardView, Network } from '../types';

/* ── Views ────────────────────────────────────────────────────────────────── */

/**
 * URL segment per view. The internal view is historically called
 * `transactions` while the feature (and its dictionary) is the "explorador",
 * so the URL says `explorer`. This map is the ONLY place that mismatch exists.
 */
const VIEW_SEGMENT = {
  staking: 'staking',
  transactions: 'explorer',
} as const satisfies Record<DashboardView, string>;

export type DashboardSegment = (typeof VIEW_SEGMENT)[DashboardView];

export function viewToSegment(view: DashboardView): DashboardSegment {
  return VIEW_SEGMENT[view];
}

export function segmentToView(segment: string): DashboardView | null {
  const found = (Object.keys(VIEW_SEGMENT) as DashboardView[]).find(
    (view) => VIEW_SEGMENT[view] === segment,
  );
  return found ?? null;
}

/* ── Entities ─────────────────────────────────────────────────────────────── */

/** Entity kinds that get a route of their own. */
export type EntityKind = 'tx' | 'resource' | 'account' | 'validator' | 'component';

/**
 * URL segment per entity kind. `component` has no route of its own yet, so it
 * falls back to the explorer; giving it one is a folder plus a line here.
 */
const ENTITY_SEGMENT: Partial<Record<EntityKind, string>> = {
  tx: 'tx',
  resource: 'resource',
  account: 'account',
  validator: 'validator',
};

/**
 * Address/hash prefix → entity kind. Radix addresses are self describing, so
 * the kind never has to be passed around alongside the value.
 */
const ENTITY_PREFIX: ReadonlyArray<readonly [string, EntityKind]> = [
  ['txid_', 'tx'],
  ['transactionintent_', 'tx'],
  ['resource_', 'resource'],
  ['account_', 'account'],
  ['validator_', 'validator'],
  ['component_', 'component'],
  ['package_', 'component'],
  ['pool_', 'component'],
  ['identity_', 'component'],
];

/** The entity kind a value refers to, or null when it is not an entity. */
export function resolveEntityKind(value: string | null | undefined): EntityKind | null {
  if (!value || typeof value !== 'string') return null;
  const match = ENTITY_PREFIX.find(([prefix]) => value.startsWith(prefix));
  return match ? match[1] : null;
}

/**
 * The ledger an address or transaction hash belongs to, read from the address
 * itself: Radix writes the network into the human-readable part, `…_rdx1…` for
 * mainnet and `…_tdx_2_1…` for Stokenet. Only the prefix can hold underscores
 * (the rest is bech32 data), so anchoring on it cannot be fooled by the body.
 *
 * This is what lets a link name its own ledger without the caller having to
 * know one: a Stokenet transaction printed in a PDF is still a Stokenet
 * transaction when it is opened months later on somebody else's machine, whose
 * last-used-network cookie says otherwise.
 */
export function networkOfAddress(value: string | null | undefined): Network | null {
  if (!value || typeof value !== 'string') return null;
  if (/^[a-z]+_rdx1/.test(value)) return 'mainnet';
  if (/^[a-z]+_tdx_2_1/.test(value)) return 'stokenet';
  return null;
}

/* ── View state carried in the query ──────────────────────────────────────── */

const NETWORKS: readonly Network[] = ['mainnet', 'stokenet'];

/** Transaction tags the explorer accepts; anything else falls back to `All`. */
export const TX_TAGS = ['All', 'Success', 'Failed', 'With Message', 'With NFTs'] as const;
export type TxTag = (typeof TX_TAGS)[number];

/** ISO `YYYY-MM-DD`, the only date shape the explorer's range accepts. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DashboardQuery {
  network?: Network;
  start?: string;
  end?: string;
  tag?: TxTag;
  /** Entity the explorer is focused on (transaction hash or address). */
  entity?: string;
}

/** Raw `searchParams` as Next hands them over. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses view state out of `searchParams`, dropping anything malformed rather
 * than trusting it. Callers get a typed object and never touch raw params.
 */
export function parseDashboardQuery(params: RawSearchParams): DashboardQuery {
  const network = first(params.network);
  const start = first(params.start);
  const end = first(params.end);
  const rawTag = first(params.tag);
  const tag = rawTag ? safeDecode(rawTag) : undefined;
  // `tx` is the legacy name; `entity` is the canonical one. Both are read so
  // old links keep working until the deprecation window closes.
  const entity = first(params.entity) ?? first(params.tx);

  return {
    network: NETWORKS.includes(network as Network) ? (network as Network) : undefined,
    start: start && ISO_DATE.test(start) ? start : undefined,
    end: end && ISO_DATE.test(end) ? end : undefined,
    tag: TX_TAGS.includes(tag as TxTag) ? (tag as TxTag) : undefined,
    entity: resolveEntityKind(entity) ? entity : undefined,
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Serialises view state back into a query string (empty when there is none). */
export function serializeDashboardQuery(query: DashboardQuery): string {
  const params = new URLSearchParams();
  if (query.network) params.set('network', query.network);
  if (query.start) params.set('start', query.start);
  if (query.end) params.set('end', query.end);
  // `All` is the default, so it is never written: the shortest URL wins.
  if (query.tag && query.tag !== 'All') params.set('tag', query.tag);
  if (query.entity) params.set('entity', query.entity);
  const search = params.toString();
  return search ? `?${search}` : '';
}

/* ── Href builders ────────────────────────────────────────────────────────── */

const base = (locale: string) => `/${locale}/dashboard`;

/**
 * Every dashboard destination. Prefer these over string interpolation: a route
 * rename then touches one file.
 */
export const dashboardRoutes = {
  /** Canonical staking list. */
  staking: (locale: string, query: DashboardQuery = {}) =>
    `${base(locale)}/staking${serializeDashboardQuery(query)}`,

  /** Canonical explorer (transactions) list. */
  explorer: (locale: string, query: DashboardQuery = {}) =>
    `${base(locale)}/explorer${serializeDashboardQuery(query)}`,

  /** A view by its internal name, for code that already holds a `DashboardView`. */
  view: (locale: string, view: DashboardView, query: DashboardQuery = {}) =>
    `${base(locale)}/${viewToSegment(view)}${serializeDashboardQuery(query)}`,

  /**
   * A transaction's page, built without inspecting the value. Templates hand
   * out a placeholder (`<intent_hash>`) for an agent to substitute, and that
   * has to keep the canonical shape instead of degrading to the explorer.
   */
  tx: (locale: string, intentHash: string, query: DashboardQuery = {}) =>
    `${base(locale)}/tx/${intentHash}${serializeDashboardQuery(query)}`,

  /**
   * An entity's own page. Kinds without a dedicated route fall back to the
   * explorer focused on them, so a link is always valid.
   */
  entity: (locale: string, value: string, query: DashboardQuery = {}) => {
    const kind = resolveEntityKind(value);
    const segment = kind ? ENTITY_SEGMENT[kind] : undefined;
    return segment
      ? `${base(locale)}/${segment}/${value}${serializeDashboardQuery(query)}`
      : dashboardRoutes.explorer(locale, { ...query, entity: value });
  },

  /**
   * Where the search box should go when it is handed a complete address.
   *
   * Focusing something must never move you to a different view. A validator's
   * own page opens the staking view, which is right for a link arriving cold
   * but wrong as the destination of a search typed in the explorer: it swapped
   * the view out from under the user, who was asking to see that validator's
   * card where they already were. So a validator stays on the current view,
   * carried as `?entity=`; every other kind keeps its dedicated page, whose
   * view matches the explorer they were searching from anyway.
   */
  entityFocus: (
    locale: string,
    view: DashboardView,
    value: string,
    query: DashboardQuery = {},
  ) =>
    resolveEntityKind(value) === 'validator'
      ? dashboardRoutes.view(locale, view, { ...query, entity: value })
      : dashboardRoutes.entity(locale, value, query),
} as const;

/* ── Legacy compatibility ─────────────────────────────────────────────────── */

/**
 * Maps a pre-migration `/dashboard?view=…&tx=…` URL onto its canonical path.
 *
 * Old links live in wallets, chats and other people's bookmarks, so they are
 * redirected rather than broken: exactly how the signing feature kept its
 * legacy `?req=` share links working.
 */
export function legacyDashboardRedirect(
  locale: string,
  params: RawSearchParams,
): string {
  const query = parseDashboardQuery(params);
  const wasStaking = first(params.view) === 'staking';

  // A focused entity now has a page of its own, so send the old link straight
  // there rather than to the explorer carrying a query parameter. The exception
  // is a validator that was being looked at IN staking: the entity routes all
  // render the explorer, so redirecting there would move the reader to a
  // different view than the link they followed.
  if (query.entity) {
    const { entity, ...rest } = query;
    return wasStaking && resolveEntityKind(entity) === 'validator'
      ? dashboardRoutes.staking(locale, query)
      : dashboardRoutes.entity(locale, entity, rest);
  }
  const wantsExplorer =
    first(params.view) === 'transactions' || !!query.start || !!query.end;
  return wantsExplorer
    ? dashboardRoutes.explorer(locale, query)
    : dashboardRoutes.staking(locale, query);
}
