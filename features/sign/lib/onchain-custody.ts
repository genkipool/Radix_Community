/**
 * On-ledger chain-of-custody verification (server-side, gateway reads only).
 *
 * SINGLE audited implementation shared by every endpoint that must prove an
 * on-ledger signature is genuine. A signature counts only when it is bound to
 * the signer's account through an unforgeable chain:
 *
 *   signature/attestation NFT (locked data, doc hash matches, names the signer)
 *     → minted from a collection whose LOCKED owner rule requires a seal NFT
 *       → that seal NFT is the OFFICIAL Radix Seal brand resource
 *         → and it is located in the signer's account.
 *
 * Nobody can mint into someone else's collection, and soulbound seals cannot
 * move, so signatures cannot be forged on another account's behalf.
 */
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { entityRoles } from '@/features/console/lib/role-lookup';
import {
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
  RADIX_SEAL_STANDARD_KEY,
} from '../constants/seal';
import {
  RESERVED_COLLECTION_METADATA_KEYS,
  SIGN_NFT_FIELDS,
} from './sign-request';

const MAX_CANDIDATE_RESOURCES = 30;
/** How many of an account's signatures for one document we carry back. */
const MAX_SIGNATURE_CANDIDATES = 12;
const MAX_IDS_PER_COLLECTION = 60;
const MAX_SIGNERS = 25;

const HEX = '0123456789abcdef';
function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  return out;
}

/**
 * The account's virtual signature badge: the LOCKED owner rule of a genuine
 * attestation collection requires exactly this, so only that account can mint
 * into it. Curve-independent: the local id is derived from the account address
 * (its NodeId's 29-byte public-key hash); either curve's badge resource counts.
 */
async function accountSignatureBadge(
  account: string,
  networkId: number,
): Promise<{ localId: string; resources: string[] }> {
  const { RadixEngineToolkit } = await import('@radixdlt/radix-engine-toolkit');
  const known = await RadixEngineToolkit.Utils.knownAddresses(networkId);
  const decoded = await RadixEngineToolkit.Address.decode(account);
  return {
    localId: `[${bytesToHex(decoded.data.slice(-29))}]`,
    resources: [
      known.resourceAddresses.ed25519SignatureVirtualBadge,
      known.resourceAddresses.secp256k1SignatureVirtualBadge,
    ],
  };
}

/**
 * True when `collection`'s LOCKED owner rule requires `account`'s signature
 * virtual badge — i.e. ONLY that account could ever mint the attestation into
 * it. This binds an anchored attestation to a real account: a forger cannot
 * point a certificate at an arbitrary collection, because its owner rule would
 * not match the claimed signer's account.
 */
export async function collectionOwnedByAccount(
  collection: EntityDetailsItem | undefined,
  account: string,
  networkId: number,
): Promise<boolean> {
  const owner = sealFromOwnerRule(collection);
  if (!owner) return false;
  const badge = await accountSignatureBadge(account, networkId);
  return owner.localId === badge.localId && badge.resources.includes(owner.resource);
}

interface NfDataResponse {
  non_fungible_ids?: Array<{
    non_fungible_id?: string;
    data?: { programmatic_json?: { fields?: Array<{ field_name?: string; value?: unknown }> } };
    /** Ledger point the NFT last changed at. Its data is locked at mint, so
     *  for these collections this IS the moment it was minted. */
    last_updated_at_state_version?: number;
  }>;
}

interface NfLocationResponse {
  non_fungible_ids?: Array<{
    non_fungible_id?: string;
    is_burned?: boolean;
    owning_vault_global_ancestor_address?: string;
  }>;
}

export interface EntityDetailsItem {
  address?: string;
  metadata?: {
    items?: Array<{
      key?: string;
      value?: { typed?: { type?: string; value?: unknown; values?: string[] } };
      is_locked?: boolean;
    }>;
  };
  details?: {
    type?: string;
    total_supply?: string;
    total_minted?: string;
    total_burned?: string;
    non_fungible_data_mutable_fields?: string[];
    role_assignments?: {
      owner?: { rule?: unknown; updater?: string };
      entries?: Array<{
        role_key?: { module?: string; name?: string };
        assignment?: { resolution?: string; explicit_rule?: unknown };
        updater_roles?: unknown[];
      }>;
    };
  };
  non_fungible_resources?: {
    items?: Array<{
      resource_address?: string;
      vaults?: { items?: Array<{ items?: string[] }> };
    }>;
    next_cursor?: string;
  };
}

interface EntityDetailsResponse {
  ledger_state?: {
    state_version?: number;
    proposer_round_timestamp?: string;
  };
  items?: EntityDetailsItem[];
}

export function nfFieldMap(
  nf: NonNullable<NfDataResponse['non_fungible_ids']>[number] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of nf?.data?.programmatic_json?.fields ?? []) {
    if (f.field_name && typeof f.value === 'string') out[f.field_name] = f.value;
  }
  return out;
}

export function metadataString(item: EntityDetailsItem | undefined, key: string): string {
  const typed = item?.metadata?.items?.find((m) => m.key === key)?.value?.typed;
  return typeof typed?.value === 'string' ? typed.value : '';
}

export async function entityDetailsWithLedger(
  network: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<{
  items: EntityDetailsItem[];
  ledgerStateVersion: number | null;
  ledgerTimestamp: string | null;
}> {
  if (addresses.length === 0) {
    return { items: [], ledgerStateVersion: null, ledgerTimestamp: null };
  }
  const items: EntityDetailsItem[] = [];
  let ledgerStateVersion: number | null = null;
  let ledgerTimestamp: string | null = null;
  for (let i = 0; i < addresses.length; i += 20) {
    const data = await gatewayPost<EntityDetailsResponse>(
      network,
      '/state/entity/details',
      {
        addresses: addresses.slice(i, i + 20),
        aggregation_level: 'Vault',
        ...(optIns ? { opt_ins: optIns } : {}),
      },
    );
    items.push(...(data.items ?? []));
    if (ledgerStateVersion == null && typeof data.ledger_state?.state_version === 'number') {
      ledgerStateVersion = data.ledger_state.state_version;
    }
    if (ledgerTimestamp == null && typeof data.ledger_state?.proposer_round_timestamp === 'string') {
      ledgerTimestamp = data.ledger_state.proposer_round_timestamp;
    }
  }
  return { items, ledgerStateVersion, ledgerTimestamp };
}

export async function entityDetails(
  network: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<EntityDetailsItem[]> {
  return (await entityDetailsWithLedger(network, addresses, optIns)).items;
}

/** One NFT's locked fields together with the ledger point it was minted at. */
export interface NfRecord {
  fields: Record<string, string>;
  /** Ledger state version of the mint, or 0 when the Gateway omits it. */
  stateVersion: number;
}

export async function nfRecords(
  network: Network,
  resource: string,
  ids: string[],
): Promise<Map<string, NfRecord>> {
  const out = new Map<string, NfRecord>();
  for (let i = 0; i < ids.length; i += 50) {
    const data = await gatewayPost<NfDataResponse>(
      network,
      '/state/non-fungible/data',
      { resource_address: resource, non_fungible_ids: ids.slice(i, i + 50) },
    ).catch(() => ({}) as NfDataResponse);
    for (const nf of data.non_fungible_ids ?? []) {
      if (!nf.non_fungible_id) continue;
      out.set(nf.non_fungible_id, {
        fields: nfFieldMap(nf),
        stateVersion: nf.last_updated_at_state_version ?? 0,
      });
    }
  }
  return out;
}

export async function nfData(
  network: Network,
  resource: string,
  ids: string[],
): Promise<Map<string, Record<string, string>>> {
  const records = await nfRecords(network, resource, ids);
  return new Map([...records].map(([id, record]) => [id, record.fields]));
}

interface TransactionStreamResponse {
  items?: Array<{
    state_version?: number;
    round_timestamp?: string;
    confirmed_at?: string;
    intent_hash?: string;
  }>;
}

/** The transaction behind a ledger state version: when, and which one. */
export interface LedgerCommit {
  /** Consensus time, or null when the Gateway cannot resolve it. */
  confirmedAt: string | null;
  /** `txid_…` intent hash, so a reader can open it in an explorer. */
  intentHash: string | null;
}

/**
 * The transaction that produced a ledger state version — the clock behind an
 * on-ledger signature, and its identity. Unlike the date written into the NFT
 * (supplied by whoever minted it) or the one in a certificate, the consensus
 * time is agreed by the whole network and cannot be chosen, which is what makes
 * it worth reading back; the intent hash is what lets anyone go and look at the
 * transaction for themselves.
 *
 * Fields the Gateway cannot resolve come back null; nothing is guessed at.
 */
export async function ledgerCommit(
  network: Network,
  stateVersion: number,
): Promise<LedgerCommit> {
  const empty: LedgerCommit = { confirmedAt: null, intentHash: null };
  if (!Number.isInteger(stateVersion) || stateVersion <= 0) return empty;
  const data = await gatewayPost<TransactionStreamResponse>(
    network,
    '/stream/transactions',
    {
      from_ledger_state: { state_version: stateVersion },
      limit_per_page: 1,
      order: 'Asc',
    },
  ).catch(() => ({}) as TransactionStreamResponse);
  const item = data.items?.[0];
  // The stream starts AT the requested version, so a different one back means
  // the transaction is no longer retrievable and we know nothing about it.
  if (!item || item.state_version !== stateVersion) return empty;
  return {
    confirmedAt: item.confirmed_at ?? item.round_timestamp ?? null,
    intentHash: item.intent_hash ?? null,
  };
}

/** {@link ledgerCommit}'s consensus time alone. */
export async function ledgerTimestamp(
  network: Network,
  stateVersion: number,
): Promise<string | null> {
  return (await ledgerCommit(network, stateVersion)).confirmedAt;
}

/**
 * Extracts the seal NFT global id from a collection's LOCKED owner rule.
 * Returns null unless the rule requires exactly a non-fungible (no AllowAll
 * escape hatch a forger could hide behind).
 */
export function sealFromOwnerRule(
  item: EntityDetailsItem | undefined,
): { resource: string; localId: string } | null {
  const owner = item?.details?.role_assignments?.owner;
  if (!owner) return null;
  const json = JSON.stringify(owner);
  if (/AllowAll/.test(json)) return null;
  let resource: string | null = null;
  let localId: string | null = null;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.resource_address === 'string' &&
      obj.resource_address.startsWith('resource_')
    ) {
      resource = obj.resource_address;
    }
    if (typeof obj.simple_rep === 'string') localId = obj.simple_rep;
    for (const v of Object.values(obj)) walk(v);
  };
  walk(owner);
  return resource && localId ? { resource, localId } : null;
}

/** Account that holds (unburned) `localId` of `resource`, or null. */
export async function nfOwnerAccount(
  network: Network,
  resource: string,
  localId: string,
): Promise<string | null> {
  const loc = await gatewayPost<NfLocationResponse>(
    network,
    '/state/non-fungible/location',
    { resource_address: resource, non_fungible_ids: [localId] },
  ).catch(() => ({}) as NfLocationResponse);
  const item = loc.non_fungible_ids?.[0];
  if (!item || item.is_burned) return null;
  const owner = item.owning_vault_global_ancestor_address ?? '';
  return owner.startsWith('account_') ? owner : null;
}

/**
 * True when the collection's LOCKED owner seal both (a) belongs to the OFFICIAL
 * Radix Seal brand resource (when `officialSeal` is provided) and (b) is located
 * in `signer`'s account. `officialSeal` = '' skips the brand check (brand not
 * deployed on this network); pass it whenever available to reject collections
 * owned by a look-alike (non-official) seal resource.
 */
export async function collectionSealBelongsTo(
  network: Network,
  collection: EntityDetailsItem | undefined,
  signer: string,
  officialSeal: string,
): Promise<boolean> {
  const seal = sealFromOwnerRule(collection);
  if (!seal) return false;
  if (officialSeal && seal.resource !== officialSeal) return false;
  return (await nfOwnerAccount(network, seal.resource, seal.localId)) === signer;
}

/**
 * Resolves an on-ledger signing request (the first invitation's global id,
 * `<collection>:#<firstId>#`) to its IMMUTABLE doc hash + required signer list,
 * read from the locked invitation batch. This is the AUTHORITATIVE invited set:
 * a certificate cannot lie about who was required to sign. Null if the id is not
 * a genuine seal-collection request.
 */
export async function resolveSealRequest(
  network: Network,
  requestId: string,
): Promise<{ docHash: string; requiredSigners: string[] } | null> {
  // Accept the canonical global id (`resource:#25#`) and lenient variants.
  const match = requestId.trim().match(/^(resource_[a-z0-9_]+):?#?(\d+)#?$/);
  if (!match) return null;
  const collection = match[1];

  const anchorData = await nfData(network, collection, [`#${match[2]}#`]);
  const anchor = anchorData.get(`#${match[2]}#`);
  if (!anchor || anchor.kind !== 'invite' || !anchor.document_hash) return null;
  const docHash = anchor.document_hash;
  const firstId = Number.parseInt(anchor.first_id || match[2], 10);
  const count = Number.parseInt(anchor.signer_count || '0', 10);
  if (
    !Number.isInteger(firstId) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_SIGNERS
  ) {
    return null;
  }

  const inviteIds = Array.from({ length: count }, (_, i) => `#${firstId + i}#`);
  const invites = await nfData(network, collection, inviteIds);
  const requiredSigners = inviteIds
    .map((id) => invites.get(id))
    .filter((f) => f?.kind === 'invite' && f.document_hash === docHash && !!f.signer)
    .map((f) => f!.signer);
  // The COMPLETE batch must exist: every invite records the batch size, so a
  // burned invitation (legacy collections allowed the owner to burn) cannot
  // silently shrink the required-signer set and fake completion.
  if (requiredSigners.length !== count) return null;

  // The collection must carry the sign marker (a genuine seal signing collection).
  const [collectionItem] = await entityDetails(network, [collection]);
  if (
    metadataString(collectionItem, SIGN_COLLECTION_MARKER_KEY) !==
    SIGN_COLLECTION_MARKER_VALUE
  ) {
    return null;
  }

  return { docHash, requiredSigners };
}

/** A located on-ledger signature, with the ledger point that minted it. */
export interface SignerSignature {
  /** Ledger state version of the mint, or 0 when the Gateway omits it. */
  stateVersion: number;
  /**
   * The `issued_at` written into the NFT. A mint cannot carry the consensus
   * time of its own transaction — that time does not exist yet — so this is
   * always written before the fact and is a CLAIM, never evidence. It is
   * returned so verification can hold it against the commit time and report a
   * record that contradicts itself.
   */
  issuedAt: string;
  /** Collection this signature NFT lives in: the signer's own, Seal-owned. */
  resourceAddress: string;
  /** Its id inside that collection, e.g. `#7#`. */
  localId: string;
  /**
   * The two above as one address (`resource_…:#7#`) — the NFT that IS this
   * signature, so a certificate can name the exact evidence instead of only
   * the transaction that minted it.
   */
  nftGlobalId: string;
}

/**
 * Every valid signature `signer` holds for `docHash`, in collections that
 * provably belong to them (see chain of custody above), earliest first. Empty
 * when they have not signed. Pass `officialSeal` (the network's Radix Seal brand
 * resource) to also require the owner seal be the official brand.
 *
 * Each carries the state version of its mint, so callers can resolve WHEN the
 * network agreed the signature existed rather than trusting a date someone
 * typed — and, with several to choose from, which mint a claim refers to.
 */
export async function findSignerSignatures(
  network: Network,
  signer: string,
  docHash: string,
  officialSeal = '',
): Promise<SignerSignature[]> {
  const [accountItem] = await entityDetails(network, [signer], {
    non_fungible_include_nfids: true,
  });
  const held = (accountItem?.non_fungible_resources?.items ?? [])
    .map((r) => ({
      resource: r.resource_address ?? '',
      ids: (r.vaults?.items ?? []).flatMap((v) => v.items ?? []),
    }))
    .filter((r) => r.resource && r.ids.length > 0)
    .slice(0, MAX_CANDIDATE_RESOURCES);

  const candidates = await entityDetails(
    network,
    held.map((r) => r.resource),
  );
  const marked = candidates.filter(
    (c) =>
      metadataString(c, SIGN_COLLECTION_MARKER_KEY) ===
      SIGN_COLLECTION_MARKER_VALUE,
  );

  /*
   * EVERY qualifying signature, not merely the first one stumbled upon.
   *
   * An account can hold many signature NFTs for the same document — several
   * collections under one insignia, or simply the same document signed again —
   * and the order collections come back in is not an order anybody promised. As
   * a yes/no answer that made no difference. As a DATE it decides everything:
   * picking one arbitrarily dates a signature made today from a mint two weeks
   * old, and then calls the certificate a liar for disagreeing. So they all come
   * back, and the caller — which knows what the certificate claims — decides
   * which one is the evidence for it.
   */
  const found: SignerSignature[] = [];
  for (const collection of marked) {
    const address = collection.address ?? '';
    const ids =
      held
        .find((r) => r.resource === address)
        ?.ids.slice(0, MAX_IDS_PER_COLLECTION) ?? [];
    if (ids.length === 0) continue;

    const data = await nfRecords(network, address, ids);
    const matches = [...data.entries()].filter(
      ([, { fields }]) =>
        fields.kind === 'signature' &&
        fields.document_hash === docHash &&
        fields.signer === signer,
    );
    if (matches.length === 0) continue;

    // Chain of custody: the collection's owner seal must live in `signer`
    // (and be the official brand when known).
    if (!(await collectionSealBelongsTo(network, collection, signer, officialSeal))) {
      continue;
    }
    for (const [localId, match] of matches) {
      found.push({
        stateVersion: match.stateVersion,
        issuedAt: match.fields.issued_at ?? '',
        resourceAddress: address,
        localId,
        nftGlobalId: `${address}:${localId}`,
      });
    }
  }

  found.sort((a, b) => a.stateVersion - b.stateVersion);
  if (found.length <= MAX_SIGNATURE_CANDIDATES) return found;
  // Over the cap, keep the two ends: the first time this account committed to
  // the hash, and the most recent mints, which is where a signature just made
  // will be. Dropping the middle costs nothing a verifier can act on.
  return [found[0], ...found.slice(-(MAX_SIGNATURE_CANDIDATES - 1))];
}

/**
 * The account's EARLIEST valid signature for `docHash`, or null — the answer to
 * "has this account signed, and when did it first do so". Callers holding a
 * certificate should use {@link findSignerSignatures} instead and pick the mint
 * that corroborates what it claims.
 */
export async function findSignerSignature(
  network: Network,
  signer: string,
  docHash: string,
  officialSeal = '',
): Promise<SignerSignature | null> {
  return (
    (await findSignerSignatures(network, signer, docHash, officialSeal))[0] ?? null
  );
}

/* ─── Collection-level audit helpers (O(unique signers)) ──────────────────── */

const MAX_AUDIT_IDS_PER_SIGNER_COLLECTION = 200;
const COMMIT_BATCH_CONCURRENCY = 8;

/**
 * Resolves unique positive integer state versions to their ledger commits with
 * bounded concurrency so audit endpoints never flood the Gateway.
 */
export async function ledgerCommitsBatch(
  network: Network,
  stateVersions: number[],
): Promise<Map<number, LedgerCommit>> {
  const unique = [
    ...new Set(stateVersions.filter((v) => Number.isInteger(v) && v > 0)),
  ];
  const out = new Map<number, LedgerCommit>();
  for (let i = 0; i < unique.length; i += COMMIT_BATCH_CONCURRENCY) {
    const chunk = unique.slice(i, i + COMMIT_BATCH_CONCURRENCY);
    const resolved = await Promise.all(
      chunk.map(async (v) => [v, await ledgerCommit(network, v)] as const),
    );
    for (const [v, commit] of resolved) out.set(v, commit);
  }
  return out;
}

/**
 * Current consensus time as ISO-8601 from `/status/gateway-status`, falling back
 * to the local clock only if the Gateway is temporarily unreachable.
 */
export async function fetchLedgerTimestampNow(network: Network): Promise<string> {
  try {
    const status = await gatewayPost<{
      ledger_state?: { proposer_round_timestamp?: string };
    }>(network, '/status/gateway-status', {});
    const stamp = status.ledger_state?.proposer_round_timestamp;
    if (stamp && !Number.isNaN(Date.parse(stamp))) return stamp;
  } catch {
    /* fallback below */
  }
  return new Date().toISOString();
}

/**
 * Fetches every non-fungible resource held by `account`, following pagination
 * so signers with many NFT resources do not push their signing collection off
 * the first page.
 */
export async function allAccountNonFungibleResources(
  network: Network,
  account: string,
  optIns?: Record<string, unknown>,
): Promise<Array<{ resource_address?: string; vaults?: { items?: Array<{ items?: string[] }> } }>> {
  const [accountItem] = await entityDetails(network, [account], optIns);
  const first = accountItem?.non_fungible_resources;
  const items = [...(first?.items ?? [])];
  let cursor = first?.next_cursor;
  let pages = 0;
  while (cursor && pages < 10) {
    pages += 1;
    const page = await gatewayPost<{
      items?: Array<{ resource_address?: string; vaults?: { items?: Array<{ items?: string[] }> } }>;
      next_cursor?: string;
    }>(network, '/state/entity/page/non-fungibles/', {
      address: account,
      aggregation_level: 'Vault',
      cursor,
      ...(optIns ? { opt_ins: optIns } : {}),
    }).catch(() => null);
    if (!page) break;
    items.push(...(page.items ?? []));
    cursor = page.next_cursor;
  }
  return items;
}

function numericNftId(localId: string): number {
  const m = localId.match(/^#(\d+)#$/);
  return m ? Number.parseInt(m[1], 10) : -1;
}

export interface SignerBatchResult {
  hasVerifiedSeal: boolean;
  hasOwnCollection: boolean;
  /** The account's Radix Seal insignia NFT (`resource:{ruid}`), if found. */
  sealNftGlobalId?: string | null;
  /** Signing collections this account provably owns (via its Seal). */
  ownCollectionAddresses?: string[];
  signaturesByHash: Map<string, SignerSignature[]>;
}

/**
 * Resolves ALL valid signatures `signer` holds for any hash in `docHashes`
 * in a single scan of their account and verified collections (`O(1)` per
 * signer regardless of how many documents are being audited).
 */
export async function findAllSignerSignatures(
  network: Network,
  signer: string,
  docHashes: Set<string>,
  officialSeal = '',
): Promise<SignerBatchResult> {
  const empty: SignerBatchResult = {
    hasVerifiedSeal: false,
    hasOwnCollection: false,
    signaturesByHash: new Map(),
  };
  if (!signer.startsWith('account_')) return empty;

  const rawHeld = await allAccountNonFungibleResources(network, signer, {
    non_fungible_include_nfids: true,
  });
  const held = rawHeld
    .map((r) => ({
      resource: r.resource_address ?? '',
      ids: (r.vaults?.items ?? []).flatMap((v) => v.items ?? []),
    }))
    .filter((r) => r.resource && r.ids.length > 0);

  const officialSealIds = officialSeal
    ? (held.find((r) => r.resource === officialSeal)?.ids ?? [])
    : [];
  const hasOfficialSealNft = officialSealIds.length > 0;
  let sealNftGlobalId: string | null = hasOfficialSealNft
    ? `${officialSeal}:${officialSealIds[0]}`
    : null;

  const candidateResources = held.slice(0, MAX_CANDIDATE_RESOURCES);
  const candidates = await entityDetails(
    network,
    candidateResources.map((r) => r.resource),
  );
  const marked = candidates.filter(
    (c) =>
      metadataString(c, SIGN_COLLECTION_MARKER_KEY) ===
      SIGN_COLLECTION_MARKER_VALUE,
  );

  let hasOwnCollection = false;
  const ownCollectionAddresses: string[] = [];
  const signaturesByHash = new Map<string, SignerSignature[]>();

  for (const collection of marked) {
    const address = collection.address ?? '';
    if (!(await collectionSealBelongsTo(network, collection, signer, officialSeal))) {
      continue;
    }
    hasOwnCollection = true;
    if (address) ownCollectionAddresses.push(address);
    if (!sealNftGlobalId) {
      const owner = sealFromOwnerRule(collection);
      if (owner) sealNftGlobalId = `${owner.resource}:${owner.localId}`;
    }
    if (docHashes.size === 0) continue;

    const rawIds = held.find((r) => r.resource === address)?.ids ?? [];
    // Prefer newest integer NFIDs first when a signer holds more than the cap.
    const sortedIds = [...rawIds].sort((a, b) => numericNftId(b) - numericNftId(a));
    const ids = sortedIds.slice(0, MAX_AUDIT_IDS_PER_SIGNER_COLLECTION);
    if (ids.length === 0) continue;

    const data = await nfRecords(network, address, ids);
    for (const [localId, match] of data.entries()) {
      const hash = match.fields.document_hash;
      if (
        match.fields.kind !== 'signature' ||
        match.fields.signer !== signer ||
        !hash ||
        !docHashes.has(hash)
      ) {
        continue;
      }
      const list = signaturesByHash.get(hash) ?? [];
      list.push({
        stateVersion: match.stateVersion,
        issuedAt: match.fields.issued_at ?? '',
        resourceAddress: address,
        localId,
        nftGlobalId: `${address}:${localId}`,
      });
      signaturesByHash.set(hash, list);
    }
  }

  for (const [hash, list] of signaturesByHash.entries()) {
    list.sort((a, b) => a.stateVersion - b.stateVersion);
    signaturesByHash.set(hash, list);
  }

  return {
    hasVerifiedSeal: officialSeal ? hasOfficialSealNft : hasOwnCollection,
    hasOwnCollection,
    sealNftGlobalId,
    ownCollectionAddresses,
    signaturesByHash,
  };
}

export interface CollectionCustomMeta {
  key: string;
  value: string;
  locked: boolean;
}

export interface CollectionIntegrity {
  hasMarker: boolean;
  officialBrand: boolean;
  ownerLocked: boolean;
  burnDenied: boolean;
  dataImmutable: boolean;
  issuerVerified: boolean;
  totalBurned: number;
  customMetadata: CollectionCustomMeta[];
}

/**
 * Inspects a signing collection's locked roles and metadata against the Radix
 * Seal standard (`radix_sign_collection = v1`, official brand, fixed non-fungible
 * owner rule, burn denied, immutable NFT data).
 */
export function inspectCollectionIntegrity(
  item: EntityDetailsItem | undefined,
  officialSeal: string,
  issuerAccount: string | null,
): CollectionIntegrity {
  const hasMarker =
    metadataString(item, SIGN_COLLECTION_MARKER_KEY) ===
    SIGN_COLLECTION_MARKER_VALUE;
  const officialBrand =
    !officialSeal || metadataString(item, RADIX_SEAL_STANDARD_KEY) === officialSeal;

  const roles = entityRoles(item);
  const ownerRole = roles.find((r) => r.module === 'Owner' && r.name === 'owner');
  const burnerRole = roles.find((r) => r.name === 'burner');
  const dataUpdaterRole = roles.find(
    (r) => r.name === 'non_fungible_data_updater',
  );

  const ownerLocked =
    !!ownerRole && ownerRole.rule.type === 'nonFungible' && ownerRole.fixed;
  const burnDenied =
    !!burnerRole && burnerRole.rule.type === 'denyAll' && burnerRole.fixed;
  const mutableFields = item?.details?.non_fungible_data_mutable_fields;
  const evidentiaryKeys = new Set<string>(SIGN_NFT_FIELDS.map((f) => f.key));
  const evidentiaryFieldsLocked =
    Array.isArray(mutableFields) &&
    !mutableFields.some((f) => evidentiaryKeys.has(f));
  const dataImmutable =
    (!!dataUpdaterRole &&
      dataUpdaterRole.rule.type === 'denyAll' &&
      dataUpdaterRole.fixed) ||
    evidentiaryFieldsLocked;

  const totalBurned =
    Number.parseInt(item?.details?.total_burned ?? '0', 10) || 0;

  const customMetadata: CollectionCustomMeta[] = [];
  for (const meta of item?.metadata?.items ?? []) {
    const key = meta.key ?? '';
    if (!key || RESERVED_COLLECTION_METADATA_KEYS.has(key.toLowerCase())) continue;
    const typed = meta.value?.typed;
    const value =
      typeof typed?.value === 'string'
        ? typed.value
        : Array.isArray(typed?.values)
          ? typed.values.join(', ')
          : '';
    customMetadata.push({
      key,
      value,
      locked: meta.is_locked === true,
    });
  }

  return {
    hasMarker,
    officialBrand,
    ownerLocked,
    burnDenied,
    dataImmutable,
    issuerVerified: !!issuerAccount,
    totalBurned,
    customMetadata,
  };
}
