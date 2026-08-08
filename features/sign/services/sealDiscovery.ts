'use client';

/**
 * On-ledger discovery for the single signing flow — no server state:
 *
 *  - the user's own SEAL NFT (their soulbound insignia, minted from the
 *    open-mint Radix Seal brand), and
 *  - the user's SIGNING COLLECTION (the resource owned by that seal, marked
 *    with `radix_sign_collection = v1`), plus its next free integer id
 *    (`totalSupply + 1`; ids are contiguous for practical purposes).
 *
 * "The user's" means OWNED, never merely held: an invitation NFT puts the
 * issuer's collection into the signer's account, and only the locked owner rule
 * says whose collection it is. Every read here is filtered on that rule.
 *
 * Results are cached in localStorage per (network, account) but always
 * re-verified against the ledger.
 */
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import {
  radixSealAddress,
  RADIX_SEAL_STANDARD_KEY,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
  ORG_NAME_KEY,
  ORG_URL_KEY,
  ICON_URL_KEY,
} from '../constants/seal';

export interface UserSeal {
  /** `<seal resource>:<local id>` — the collection owner rule's requirement. */
  globalId: string;
  localId: string;
}

export interface UserSignCollection {
  resourceAddress: string;
  totalSupply: number;
  /** Display metadata, so a human can tell two collections apart. */
  name?: string;
  iconUrl?: string;
  /**
   * Global id of the seal named by the collection's locked owner rule — the
   * ONLY key that can mint into it. Read here so the caller never has to guess
   * which of the account's seals to build the mint proof from.
   */
  ownerSealGlobalId?: string;
}

interface MetadataItem {
  key: string;
  value?: { typed?: { value?: string; type?: string; values?: string[] } };
  /** Whether the ledger will refuse any further change to this key. */
  is_locked?: boolean;
}
interface NonFungibleResourceItem {
  resource_address: string;
  vaults?: { items?: Array<{ items?: string[] }> };
}
interface EntityDetailsItem {
  address: string;
  metadata?: { items?: MetadataItem[] };
  details?: { total_supply?: string; role_assignments?: unknown };
  non_fungible_resources?: {
    items?: NonFungibleResourceItem[];
    /** Set when the account holds more NFT resources than one page returns. */
    next_cursor?: string;
  };
}
interface EntityDetailsResponse {
  items?: EntityDetailsItem[];
}

function network(networkId: number): Network {
  return networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}

async function entityDetails(
  net: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<EntityDetailsItem[]> {
  if (addresses.length === 0) return [];
  const data = await gatewayPost<EntityDetailsResponse>(
    net,
    '/state/entity/details',
    {
      addresses,
      aggregation_level: optIns ? 'Vault' : 'Global',
      ...(optIns ? { opt_ins: optIns } : {}),
    },
  );
  return data.items ?? [];
}

/**
 * Every non-fungible resource the account holds, following pagination. The
 * first page rides on the entity-details response; the rest come from the
 * non-fungibles page endpoint. Without this an account holding many NFT
 * resources can push its seal or signing collection past the first page, so
 * discovery misses it and wrongly re-shows the "create collection" onboarding
 * (typically when a shared link switches network and the localStorage cache no
 * longer short-circuits the scan).
 */
async function allNonFungibleResources(
  net: Network,
  account: string,
  optIns?: Record<string, unknown>,
): Promise<NonFungibleResourceItem[]> {
  const [item] = await entityDetails(net, [account], optIns);
  const first = item?.non_fungible_resources;
  const items: NonFungibleResourceItem[] = [...(first?.items ?? [])];
  let cursor = first?.next_cursor;
  while (cursor) {
    const page = await gatewayPost<{
      items?: NonFungibleResourceItem[];
      next_cursor?: string;
    }>(net, '/state/entity/page/non-fungibles/', {
      address: account,
      aggregation_level: optIns ? 'Vault' : 'Global',
      cursor,
      ...(optIns ? { opt_ins: optIns } : {}),
    }).catch(() => null);
    if (!page) break;
    items.push(...(page.items ?? []));
    cursor = page.next_cursor;
  }
  return items;
}

/* ─── Seal ────────────────────────────────────────────────────────────────── */

/**
 * EVERY seal the account holds. Normally one — the insignia is self-minted and
 * soulbound — but the brand is open-mint, so nothing stops an account from
 * minting a second one, and each is a DIFFERENT global id. That matters
 * because a signing collection is owned by one specific seal.
 */
export async function findUserSeals(
  networkId: number,
  account: string,
): Promise<UserSeal[]> {
  const sealResource = radixSealAddress(networkId);
  if (!sealResource) return [];
  const items = await allNonFungibleResources(network(networkId), account, {
    non_fungible_include_nfids: true,
  });
  const vaults =
    items.find((r) => r.resource_address === sealResource)?.vaults?.items ?? [];
  return vaults
    .flatMap((v) => v.items ?? [])
    .map((localId) => ({ globalId: `${sealResource}:${localId}`, localId }));
}

/** The account's own seal NFT, or null (not minted yet / brand undeployed). */
export async function findUserSeal(
  networkId: number,
  account: string,
): Promise<UserSeal | null> {
  return (await findUserSeals(networkId, account))[0] ?? null;
}

/**
 * The `resource:localId` a non-fungible owner rule requires, or null. The
 * Gateway nests it under access_rule → proof_rule → requirement, and reports
 * the id under `simple_rep`.
 */
function ownerRuleGlobalId(roleAssignments: unknown): string | null {
  try {
    const owner = (roleAssignments as { owner?: { rule?: unknown } })?.owner?.rule;
    const rule = owner as Record<string, unknown>;
    const accessRule = (rule?.access_rule ?? rule) as Record<string, unknown>;
    const proofRule = (accessRule?.proof_rule ?? accessRule) as Record<string, unknown>;
    const requirement = (proofRule?.requirement ?? {}) as Record<string, unknown>;
    const nonFungible = (requirement?.non_fungible ?? {}) as Record<string, unknown>;
    const resource = nonFungible?.resource_address as string | undefined;
    const rawId = nonFungible?.local_id;
    const localId =
      typeof rawId === 'string'
        ? rawId
        : ((rawId as { simple_rep?: string })?.simple_rep ?? '');
    return resource && localId ? `${resource}:${localId}` : null;
  } catch {
    return null;
  }
}

/* ─── Signing collection ──────────────────────────────────────────────────── */

function metadataValue(item: EntityDetailsItem, key: string): string | undefined {
  return item.metadata?.items?.find((m) => m.key === key)?.value?.typed?.value;
}

function isSignCollection(item: EntityDetailsItem): boolean {
  return (
    metadataValue(item, SIGN_COLLECTION_MARKER_KEY) ===
    SIGN_COLLECTION_MARKER_VALUE
  );
}

/** Issuer identity published (owner-editable) on a signing collection. */
export interface CollectionIssuer {
  orgName?: string;
  orgWebsite?: string;
  /** The collection's `icon_url` — the issuer's own logo. */
  iconUrl?: string;
}

/**
 * Reads the optional issuer identity (`org_name` / `org_url` / `icon_url`) from
 * a signing collection's metadata, for display on the visible signature
 * certificate. Returns null when the collection sets none (or on any gateway
 * error) — the page simply omits the issuer block. Purely presentational: it is
 * NEVER part of verification (see the verify route's insignia check).
 */
export async function findCollectionIssuer(
  networkId: number,
  resourceAddress: string,
): Promise<CollectionIssuer | null> {
  const [item] = await entityDetails(network(networkId), [resourceAddress]).catch(
    () => [],
  );
  if (!item) return null;
  const orgName = metadataValue(item, ORG_NAME_KEY);
  const orgWebsite = metadataValue(item, ORG_URL_KEY);
  const iconUrl = metadataValue(item, ICON_URL_KEY);
  return orgName || orgWebsite ? { orgName, orgWebsite, iconUrl } : null;
}

/** One metadata key of a collection, as the ledger holds it. */
export interface CollectionMetadataEntry {
  key: string;
  value: string;
  /** Locked keys can never change again, by anyone, including the owner. */
  locked: boolean;
}

/** The editable face of a signing collection, as it stands on the ledger. */
export interface CollectionProfile {
  name?: string;
  symbol?: string;
  /** The collection's own `icon_url` — the issuer's logo. */
  iconUrl?: string;
  orgName?: string;
  orgUrl?: string;
  /**
   * Every key the collection carries, including whatever the creator added by
   * hand, each with whether it is locked.
   *
   * The five fields above are the ones with a form control; this is what the
   * screen needs to show the rest, and to tell the user which of the lot can
   * still be changed. Reading a collection and only reporting five known keys
   * meant a creator's own metadata simply did not exist as far as the UI was
   * concerned.
   */
  entries: CollectionMetadataEntry[];
}

/** Reads a metadata value whatever shape the gateway returned it in. */
function metadataText(item: MetadataItem): string {
  const typed = item.value?.typed;
  if (!typed) return '';
  if (typeof typed.value === 'string') return typed.value;
  if (Array.isArray(typed.values)) return typed.values.join(', ');
  return '';
}

/**
 * Everything a collection carries, for the identity screen.
 *
 * The five named fields pre-fill the form; `entries` is the whole set, lock
 * state included, so the screen can show what was sealed at creation and
 * whatever the creator added themselves rather than pretending a collection
 * only ever has five keys.
 */
export async function findCollectionProfile(
  networkId: number,
  resourceAddress: string,
): Promise<CollectionProfile> {
  const [item] = await entityDetails(network(networkId), [resourceAddress]).catch(
    () => [],
  );
  if (!item) return { entries: [] };
  return {
    name: metadataValue(item, 'name'),
    symbol: metadataValue(item, 'symbol'),
    iconUrl: metadataValue(item, ICON_URL_KEY),
    orgName: metadataValue(item, ORG_NAME_KEY),
    orgUrl: metadataValue(item, ORG_URL_KEY),
    entries: (item.metadata?.items ?? []).map((meta) => ({
      key: meta.key,
      value: metadataText(meta),
      locked: meta.is_locked === true,
    })),
  };
}

/**
 * True when the collection references the CURRENT official Radix Seal resource
 * (its locked `radix_seal` metadata). After a brand redeploy the seal resource
 * address changes, so a collection created for an OLD seal must NOT be treated
 * as ready: it can no longer be minted into with the user's new seal, and a new
 * collection has to be created. When the brand is not deployed the check is
 * skipped (nothing to compare against).
 */
function belongsToCurrentSeal(item: EntityDetailsItem, networkId: number): boolean {
  const official = radixSealAddress(networkId);
  if (!official) return true;
  return metadataValue(item, RADIX_SEAL_STANDARD_KEY) === official;
}

function forgetSignCollection(networkId: number, account: string): void {
  try {
    localStorage.removeItem(cacheKey(networkId, account));
  } catch {
    /* ignore */
  }
}

function toSupply(item: EntityDetailsItem): number {
  return Math.floor(Number(item.details?.total_supply ?? '0')) || 0;
}

/** Everything the UI needs about a collection, from one details response. */
function toCollection(item: EntityDetailsItem): UserSignCollection {
  return {
    resourceAddress: item.address,
    totalSupply: toSupply(item),
    name: metadataValue(item, 'name'),
    iconUrl: metadataValue(item, ICON_URL_KEY),
    ownerSealGlobalId: ownerRuleGlobalId(item.details?.role_assignments) ?? undefined,
  };
}

/**
 * Whether the collection is THIS account's own — i.e. its locked owner rule
 * names a seal the account holds, so this account (and nobody else) can mint
 * into it.
 *
 * Holding an NFT of a collection is NOT ownership, and conflating the two is
 * what made a co-signer's very first signature fail. An invitation is minted by
 * the ISSUER into the ISSUER's collection and then deposited into the signer's
 * account, so from the signer's holdings that collection looks exactly like one
 * of their own: same marker, same brand. Discovery then handed it back as "your
 * signing collection", the mint was built against it with a proof of the
 * signer's own seal, and the ledger — correctly — refused the transaction, with
 * nothing on screen to explain why.
 */
function ownedBySeals(item: EntityDetailsItem, sealIds: Set<string>): boolean {
  const owner = ownerRuleGlobalId(item.details?.role_assignments);
  return !!owner && sealIds.has(owner);
}

const cacheKey = (networkId: number, account: string) =>
  `radix-sign-collection:${networkId}:${account}`;

function readCache(networkId: number, account: string): string | null {
  try {
    return localStorage.getItem(cacheKey(networkId, account));
  } catch {
    return null;
  }
}

/**
 * Every collection this browser has seen for the account, active or not.
 *
 * Discovery scans what the account HOLDS, and a brand-new collection holds
 * nothing: the seal owns it, but no NFT of it sits in any vault, so the ledger
 * scan cannot see it until the first invitation or signature is minted. The
 * Gateway offers no "resources owned by this NFT" index to ask instead, so the
 * addresses this browser created are kept and re-verified on every read.
 */
const knownKey = (networkId: number, account: string) =>
  `radix-sign-collections:${networkId}:${account}`;

function readKnown(networkId: number, account: string): string[] {
  try {
    const raw = localStorage.getItem(knownKey(networkId, account));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((a) => typeof a === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberSignCollection(
  networkId: number,
  account: string,
  resourceAddress: string,
): void {
  try {
    localStorage.setItem(cacheKey(networkId, account), resourceAddress);
    const known = readKnown(networkId, account);
    if (!known.includes(resourceAddress)) {
      localStorage.setItem(
        knownKey(networkId, account),
        JSON.stringify([...known, resourceAddress]),
      );
    }
  } catch {
    /* private mode — discovery still works, just uncached */
  }
}

const sealIdSet = (seals: UserSeal[]): Set<string> =>
  new Set(seals.map((s) => s.globalId));

/** The account's signing collection, or null if not created yet. */
export async function findSignCollection(
  networkId: number,
  account: string,
): Promise<UserSignCollection | null> {
  return collectionForSeals(
    networkId,
    account,
    sealIdSet(await findUserSeals(networkId, account)),
  );
}

/** {@link findSignCollection} once the account's seals are already in hand. */
async function collectionForSeals(
  networkId: number,
  account: string,
  sealIds: Set<string>,
): Promise<UserSignCollection | null> {
  const net = network(networkId);

  const cached = readCache(networkId, account);
  if (cached) {
    const [item] = await entityDetails(net, [cached]).catch(() => []);
    if (
      item &&
      isSignCollection(item) &&
      belongsToCurrentSeal(item, networkId) &&
      ownedBySeals(item, sealIds)
    ) {
      return toCollection(item);
    }
    // Stale (a collection from a previous seal deploy) or never ours (a pinned
    // address, or an issuer's collection an invitation once made look like one
    // of the account's own): drop it.
    forgetSignCollection(networkId, account);
  }

  const best = (await collectionsForSeals(networkId, account, sealIds))[0] ?? null;
  if (best) rememberSignCollection(networkId, account, best.resourceAddress);
  return best;
}

/**
 * The account's signing collection together with the seal that commands it —
 * the pair every mint needs, resolved consistently. Always prefer this over
 * reading the two separately: the seal is only correct RELATIVE to the
 * collection whose owner rule names it.
 */
export async function findSealAndCollection(
  networkId: number,
  account: string,
): Promise<{ seal: UserSeal | null; collection: UserSignCollection | null }> {
  const seals = await findUserSeals(networkId, account);
  const collection = await collectionForSeals(
    networkId,
    account,
    sealIdSet(seals),
  );
  // Discovery already read the owner rule, so the seal that commands THIS
  // collection is known without a second lookup.
  const seal =
    seals.find((s) => s.globalId === collection?.ownerSealGlobalId) ??
    seals[0] ??
    null;
  return { seal, collection };
}

/**
 * EVERY signing collection the account OWNS (its seal commands them), best
 * first.
 *
 * An account can end up with more than one: created in two tabs, created by
 * hand, or created again because a discovery miss re-offered the onboarding.
 * They are all valid on-ledger — the issuer identity (org name, logo) lives per
 * collection, so a second one can even be deliberate — but the tool has to
 * commit to ONE, and "whichever the Gateway happened to list first" is not an
 * order anybody promised.
 *
 * Ranked by minted supply, descending. Burning is denied in these collections,
 * so supply is exactly how much evidence (invitations, signatures) lives
 * inside, and the ranking means an accidental empty duplicate can never
 * displace the collection holding the account's history. Ties break on the
 * address, so the answer is stable across calls.
 */
export async function findSignCollections(
  networkId: number,
  account: string,
): Promise<UserSignCollection[]> {
  return collectionsForSeals(
    networkId,
    account,
    sealIdSet(await findUserSeals(networkId, account)),
  );
}

/** {@link findSignCollections} once the account's seals are already in hand. */
async function collectionsForSeals(
  networkId: number,
  account: string,
  sealIds: Set<string>,
): Promise<UserSignCollection[]> {
  // Without a seal the account owns nothing that can mint, so there is no
  // collection of its own to find — and every candidate below would be
  // somebody else's.
  if (sealIds.size === 0) return [];
  const net = network(networkId);
  const held = (await allNonFungibleResources(net, account)).map(
    (r) => r.resource_address,
  );
  // Holdings alone miss an empty collection, so the ones this browser created
  // are added as candidates. Every candidate is still verified below: a stale
  // or foreign address simply fails the marker check and drops out.
  const candidates = [...new Set([...held, ...readKnown(networkId, account)])];
  const found: UserSignCollection[] = [];
  for (let i = 0; i < candidates.length; i += 20) {
    const details = await entityDetails(net, candidates.slice(i, i + 20));
    for (const item of details) {
      if (!isSignCollection(item) || !belongsToCurrentSeal(item, networkId)) continue;
      // Held ≠ owned: an invitation puts the ISSUER's collection among these.
      if (!ownedBySeals(item, sealIds)) continue;
      found.push(toCollection(item));
    }
  }
  return found.sort(
    (a, b) =>
      b.totalSupply - a.totalSupply ||
      a.resourceAddress.localeCompare(b.resourceAddress),
  );
}
