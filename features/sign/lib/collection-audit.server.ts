/**
 * Server-side Radix Seal collection audit orchestrator.
 *
 * Single source of truth shared by both `POST /api/sign/collection-audit` and
 * the MCP `audit_seal_collection` tool so input validation, strict Mainnet vs
 * Stokenet isolation, integrity inspection, batch lookback, and O(unique
 * signers) signature resolution never drift or duplicate.
 */
import { z } from 'zod';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import type { Network } from '@/services/gateway/client';
import {
  RADIX_SEAL_STANDARD_KEY,
  radixSealAddress,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../constants/seal';
import {
  allAccountNonFungibleResources,
  collectionSealBelongsTo,
  entityDetails,
  entityDetailsWithLedger,
  findAllSignerSignatures,
  inspectCollectionIntegrity,
  ledgerCommitsBatch,
  metadataString,
  nfOwnerAccount,
  nfRecords,
  sealFromOwnerRule,
  type NfRecord,
  type SignerBatchResult,
} from './onchain-custody';
import {
  buildSignerDirectory,
  finalizeAuditRecords,
  groupCollectionNfts,
  type CollectionAuditResponse,
} from './collection-audit';

export const DEFAULT_AUDIT_PAGE_LIMIT = 150;
export const MAX_AUDIT_PAGE_LIMIT = 200;
const MAX_BATCH_LOOKBACK = 25;
const MAX_UNIQUE_SIGNERS = 50;
const SIGNER_CONCURRENCY = 6;

export const collectionAuditInputSchema = z
  .object({
    networkId: z.number().int(),
    collection: z.string().regex(/^resource_(rdx|tdx_2_)1[a-z0-9]+$/),
    toId: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(MAX_AUDIT_PAGE_LIMIT).optional(),
  })
  .strict();

export type CollectionAuditInput = z.infer<typeof collectionAuditInputSchema>;

export interface CollectionAuditNotFound {
  found: false;
  networkId: number;
  collection: string;
}

export type CollectionAuditResult =
  | CollectionAuditResponse
  | CollectionAuditNotFound;

/** True when `networkId` agrees with the collection's Bech32 prefix. */
export function networkMatchesCollection(
  networkId: number,
  collection: string,
): boolean {
  if (networkId === RadixNetworkId.Mainnet) {
    return collection.startsWith('resource_rdx1');
  }
  if (networkId === RadixNetworkId.Stokenet) {
    return collection.startsWith('resource_tdx_2_1');
  }
  return false;
}

/** True when `networkId` agrees with the account's Bech32 prefix. */
export function networkMatchesAccount(
  networkId: number,
  account: string,
): boolean {
  if (networkId === RadixNetworkId.Mainnet) {
    return account.startsWith('account_rdx1');
  }
  if (networkId === RadixNetworkId.Stokenet) {
    return account.startsWith('account_tdx_2_1');
  }
  return false;
}

export interface SealAccountCollectionInfo {
  resourceAddress: string;
  name: string | null;
  symbol: string | null;
  orgName: string | null;
  orgUrl: string | null;
  totalSupply: number;
  nextId: number;
  ownerSealGlobalId: string | null;
}

export interface SealAccountState {
  networkId: number;
  account: string;
  sealResource: string;
  seals: Array<{ localId: string; globalId: string }>;
  collections: SealAccountCollectionInfo[];
}

/**
 * Discovers an account's official Radix Seal NFTs and Seal-owned signing
 * collections on-ledger (`totalSupply` desc, deterministic tie-break),
 * mirroring client `sealDiscovery.ts` server-side for the MCP registry tools.
 */
export async function getSealAccountState(
  networkId: number,
  account: string,
  sealResourceOverride?: string,
  extraCollections?: string[],
): Promise<SealAccountState> {
  if (!networkMatchesAccount(networkId, account)) {
    throw new Error('network_mismatch');
  }

  const network: Network =
    networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
  const sealResource = (
    sealResourceOverride?.trim() || radixSealAddress(networkId)
  ).trim();

  const rawHeld = await allAccountNonFungibleResources(network, account, {
    non_fungible_include_nfids: true,
  });
  const held = rawHeld
    .map((r) => ({
      resource: r.resource_address ?? '',
      ids: (r.vaults?.items ?? []).flatMap((v) => v.items ?? []),
    }))
    .filter((r) => r.resource && r.ids.length > 0);

  const seals = sealResource
    ? (held.find((r) => r.resource === sealResource)?.ids ?? []).map(
        (localId) => ({
          localId,
          globalId: `${sealResource}:${localId}`,
        }),
      )
    : [];

  const extra = (extraCollections ?? [])
    .map((a) => a.trim())
    .filter((a) => a && networkMatchesCollection(networkId, a));
  const candidateAddrs = [...new Set([...held.map((r) => r.resource), ...extra])];
  const details = [];
  for (let i = 0; i < candidateAddrs.length; i += 20) {
    details.push(
      ...(await entityDetails(network, candidateAddrs.slice(i, i + 20))),
    );
  }

  const collections: SealAccountCollectionInfo[] = [];
  for (const item of details) {
    if (
      metadataString(item, SIGN_COLLECTION_MARKER_KEY) !==
      SIGN_COLLECTION_MARKER_VALUE
    ) {
      continue;
    }
    if (
      sealResource &&
      metadataString(item, RADIX_SEAL_STANDARD_KEY) !== sealResource
    ) {
      continue;
    }
    if (!(await collectionSealBelongsTo(network, item, account, sealResource))) {
      continue;
    }
    const address = item.address ?? '';
    if (!address) continue;
    const ownerSeal = sealFromOwnerRule(item);
    const totalSupply = Math.max(
      0,
      Number.parseInt(item.details?.total_supply ?? '0', 10) || 0,
    );
    collections.push({
      resourceAddress: address,
      name: metadataString(item, 'name') || null,
      symbol: metadataString(item, 'symbol') || null,
      orgName: metadataString(item, 'org_name') || null,
      orgUrl: metadataString(item, 'org_url') || null,
      totalSupply,
      nextId: totalSupply + 1,
      ownerSealGlobalId: ownerSeal
        ? `${ownerSeal.resource}:${ownerSeal.localId}`
        : null,
    });
  }

  collections.sort(
    (a, b) =>
      b.totalSupply - a.totalSupply ||
      a.resourceAddress.localeCompare(b.resourceAddress),
  );

  return {
    networkId,
    account,
    sealResource,
    seals,
    collections,
  };
}

/**
 * Executes a full read-only on-ledger audit for a Radix Seal signing
 * collection (`#1..#totalSupply` window, newest first).
 */
export async function auditSignCollection(
  input: CollectionAuditInput,
): Promise<CollectionAuditResult> {
  const { networkId, collection } = input;
  if (!networkMatchesCollection(networkId, collection)) {
    throw new Error('network_mismatch');
  }

  const network: Network =
    networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
  const limit = input.limit ?? DEFAULT_AUDIT_PAGE_LIMIT;

  // 1. Read collection metadata, role assignments, total supply & ledger cutoff.
  const {
    items: [collectionItem],
    ledgerStateVersion,
    ledgerTimestamp,
  } = await entityDetailsWithLedger(network, [collection]);

  if (
    !collectionItem ||
    metadataString(collectionItem, SIGN_COLLECTION_MARKER_KEY) !==
      SIGN_COLLECTION_MARKER_VALUE
  ) {
    return { found: false, networkId, collection };
  }

  const officialSeal = radixSealAddress(networkId);
  const seal = sealFromOwnerRule(collectionItem);
  const issuerAccount = seal
    ? await nfOwnerAccount(network, seal.resource, seal.localId)
    : null;

  const integrity = inspectCollectionIntegrity(
    collectionItem,
    officialSeal,
    issuerAccount,
  );

  const totalSupply = Math.max(
    0,
    Number.parseInt(collectionItem.details?.total_supply ?? '0', 10) || 0,
  );

  const issuer = {
    account: issuerAccount,
    name: metadataString(collectionItem, 'name') || null,
    symbol: metadataString(collectionItem, 'symbol') || null,
    orgName: metadataString(collectionItem, 'org_name') || null,
    orgUrl: metadataString(collectionItem, 'org_url') || null,
    iconUrl: metadataString(collectionItem, 'icon_url') || null,
  };

  if (totalSupply === 0) {
    return {
      found: true,
      networkId,
      collection,
      ledgerStateVersion,
      ledgerTimestamp,
      totalSupply: 0,
      scannedFromId: 0,
      scannedToId: 0,
      hasMoreOlder: false,
      issuer,
      integrity,
      records: [],
      signers: [],
    };
  }

  // 2. Compute scan window [startId..endId] and fetch NFT records.
  const endId = Math.min(totalSupply, input.toId ?? totalSupply);
  let startId = Math.max(1, endId - limit + 1);
  const ids = Array.from(
    { length: Math.max(0, endId - startId + 1) },
    (_, i) => `#${startId + i}#`,
  );

  const recordsMap: Map<string, NfRecord> =
    ids.length > 0 ? await nfRecords(network, collection, ids) : new Map();

  // Expand backwards across batch boundary so a multi-party batch is never split.
  if (startId > 1) {
    const oldestRecord = recordsMap.get(`#${startId}#`);
    const kind = oldestRecord?.fields.kind;
    if (kind === 'invite' || kind === 'cipher-invite') {
      const firstId = Number.parseInt(oldestRecord?.fields.first_id ?? '', 10);
      if (
        Number.isInteger(firstId) &&
        firstId >= 1 &&
        firstId < startId &&
        startId - firstId <= MAX_BATCH_LOOKBACK
      ) {
        const extraIds = Array.from(
          { length: startId - firstId },
          (_, i) => `#${firstId + i}#`,
        );
        const extraMap = await nfRecords(network, collection, extraIds);
        for (const [k, v] of extraMap.entries()) recordsMap.set(k, v);
        startId = firstId;
      }
    }
  }

  // 3. Group collection NFTs into semantic business records.
  const drafts = groupCollectionNfts(collection, recordsMap);

  // 4. Collect unique signers & document hashes across records.
  const docHashesBySigner = new Map<string, Set<string>>();
  const addSignerHash = (account: string, docHash?: string) => {
    if (!account.startsWith('account_')) return;
    let set = docHashesBySigner.get(account);
    if (!set) {
      set = new Set<string>();
      docHashesBySigner.set(account, set);
    }
    if (docHash) set.add(docHash);
  };

  for (const draft of drafts) {
    if (draft.kind === 'multi_request') {
      for (const s of draft.requiredSigners) addSignerHash(s, draft.docHash);
    } else if (draft.signerAccount) {
      addSignerHash(draft.signerAccount);
    } else {
      for (const s of draft.requiredSigners) addSignerHash(s);
    }
  }

  // 5. Resolve each unique signer ONCE in bounded concurrent batches.
  const signerEntries = [...docHashesBySigner.entries()].slice(0, MAX_UNIQUE_SIGNERS);
  const signerResults = new Map<string, SignerBatchResult>();
  for (let i = 0; i < signerEntries.length; i += SIGNER_CONCURRENCY) {
    const chunk = signerEntries.slice(i, i + SIGNER_CONCURRENCY);
    const resolved = await Promise.all(
      chunk.map(
        async ([account, hashes]) =>
          [
            account,
            await findAllSignerSignatures(network, account, hashes, officialSeal),
          ] as const,
      ),
    );
    for (const [account, result] of resolved) {
      signerResults.set(account, result);
    }
  }

  // 6. Batch-resolve all relevant state versions (collection mints + signer mints).
  const stateVersions: number[] = [];
  for (const draft of drafts) {
    if (draft.stateVersion > 0) stateVersions.push(draft.stateVersion);
    if (draft.localInitiatorSignature?.stateVersion) {
      stateVersions.push(draft.localInitiatorSignature.stateVersion);
    }
  }
  for (const res of signerResults.values()) {
    for (const list of res.signaturesByHash.values()) {
      for (const sig of list) {
        if (sig.stateVersion > 0) stateVersions.push(sig.stateVersion);
      }
    }
  }
  const commits = await ledgerCommitsBatch(network, stateVersions);

  // 7. Finalize records and signer directory.
  const records = finalizeAuditRecords(drafts, commits, signerResults);
  const signers = buildSignerDirectory(records, signerResults);

  return {
    found: true,
    networkId,
    collection,
    ledgerStateVersion,
    ledgerTimestamp,
    totalSupply,
    scannedFromId: startId,
    scannedToId: endId,
    hasMoreOlder: startId > 1,
    issuer,
    integrity,
    records,
    signers,
  };
}
