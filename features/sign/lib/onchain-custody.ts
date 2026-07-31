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
import {
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../constants/seal';

const MAX_CANDIDATE_RESOURCES = 30;
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
      value?: { typed?: { type?: string; value?: unknown } };
    }>;
  };
  details?: {
    role_assignments?: { owner?: unknown };
  };
  non_fungible_resources?: {
    items?: Array<{
      resource_address?: string;
      vaults?: { items?: Array<{ items?: string[] }> };
    }>;
  };
}

interface EntityDetailsResponse {
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

export async function entityDetails(
  network: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<EntityDetailsItem[]> {
  if (addresses.length === 0) return [];
  const out: EntityDetailsItem[] = [];
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
    out.push(...(data.items ?? []));
  }
  return out;
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
  items?: Array<{ state_version?: number; round_timestamp?: string; confirmed_at?: string }>;
}

/**
 * The consensus time of a ledger state version — the clock behind an on-ledger
 * signature. Unlike the date written into the NFT (supplied by whoever minted
 * it) or the one in a certificate, this one is agreed by the whole network and
 * cannot be chosen, which is what makes it worth reading back.
 *
 * Returns null when the Gateway cannot resolve it; a missing clock is reported
 * as missing, never guessed at.
 */
export async function ledgerTimestamp(
  network: Network,
  stateVersion: number,
): Promise<string | null> {
  if (!Number.isInteger(stateVersion) || stateVersion <= 0) return null;
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
  // the transaction is no longer retrievable and we know nothing about its time.
  if (!item || item.state_version !== stateVersion) return null;
  return item.confirmed_at ?? item.round_timestamp ?? null;
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
}

/**
 * Locates `signer`'s valid signature for `docHash` in a collection that provably
 * belongs to them (see chain of custody above), or null. Pass `officialSeal`
 * (the network's Radix Seal brand resource) to also require the owner seal be
 * the official brand.
 *
 * The state version comes back with it so callers can resolve WHEN the network
 * agreed the signature existed, rather than trusting a date someone typed.
 */
export async function findSignerSignature(
  network: Network,
  signer: string,
  docHash: string,
  officialSeal = '',
): Promise<SignerSignature | null> {
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

  for (const collection of marked) {
    const address = collection.address ?? '';
    const ids =
      held
        .find((r) => r.resource === address)
        ?.ids.slice(0, MAX_IDS_PER_COLLECTION) ?? [];
    if (ids.length === 0) continue;

    const data = await nfRecords(network, address, ids);
    const match = [...data.values()].find(
      ({ fields }) =>
        fields.kind === 'signature' &&
        fields.document_hash === docHash &&
        fields.signer === signer,
    );
    if (!match) continue;

    // Chain of custody: the collection's owner seal must live in `signer`
    // (and be the official brand when known).
    if (await collectionSealBelongsTo(network, collection, signer, officialSeal)) {
      return { stateVersion: match.stateVersion };
    }
  }
  return null;
}
