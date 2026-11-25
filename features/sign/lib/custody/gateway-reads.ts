/**
 * Low-level Gateway reads for on-ledger custody verification: NF data,
 * consensus commits, NF ownership, and account signature virtual badge checks.
 */
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { sealFromOwnerRule, type EntityDetailsItem } from '../gateway-seal';

const COMMIT_BATCH_CONCURRENCY = 8;

const HEX = '0123456789abcdef';
function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return out;
}

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
 * virtual badge — i.e. ONLY that account could ever mint into it.
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
    data?: {
      programmatic_json?: {
        fields?: Array<{ field_name?: string; value?: unknown }>;
      };
    };
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

export function nfFieldMap(
  nf: NonNullable<NfDataResponse['non_fungible_ids']>[number] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of nf?.data?.programmatic_json?.fields ?? []) {
    if (f.field_name && typeof f.value === 'string') out[f.field_name] = f.value;
  }
  return out;
}

/** One NFT's locked fields together with the ledger point it was minted at. */
export interface NfRecord {
  fields: Record<string, string>;
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
  confirmedAt: string | null;
  intentHash: string | null;
}

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
  if (!item || item.state_version !== stateVersion) return empty;
  return {
    confirmedAt: item.confirmed_at ?? item.round_timestamp ?? null,
    intentHash: item.intent_hash ?? null,
  };
}

export async function ledgerTimestamp(
  network: Network,
  stateVersion: number,
): Promise<string | null> {
  return (await ledgerCommit(network, stateVersion)).confirmedAt;
}

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
 * True when the collection's LOCKED owner seal belongs to the official Radix
 * Seal brand resource (when `officialSeal` is provided) and sits in `signer`.
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
