/**
 * Request resolution and chain-of-custody signature lookups for single
 * verification and O(unique signers) collection audits.
 */
import type { Network } from '@/services/gateway/client';
import {
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../../constants/seal';
import {
  allAccountNonFungibleResources,
  entityDetails,
  metadataString,
  sealFromOwnerRule,
} from '../gateway-seal';
import {
  collectionSealBelongsTo,
  nfData,
  nfRecords,
} from './gateway-reads';

const MAX_CANDIDATE_RESOURCES = 30;
const MAX_SIGNATURE_CANDIDATES = 12;
const MAX_IDS_PER_COLLECTION = 60;
const MAX_SIGNERS = 25;
const MAX_AUDIT_IDS_PER_SIGNER_COLLECTION = 200;

/**
 * Resolves an on-ledger signing request (`<collection>:#<firstId>#`) to its
 * IMMUTABLE doc hash + required signer list read from the locked invite batch.
 */
export async function resolveSealRequest(
  network: Network,
  requestId: string,
): Promise<{ docHash: string; requiredSigners: string[] } | null> {
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
    .filter(
      (f) => f?.kind === 'invite' && f.document_hash === docHash && !!f.signer,
    )
    .map((f) => f!.signer);
  if (requiredSigners.length !== count) return null;

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
  stateVersion: number;
  issuedAt: string;
  resourceAddress: string;
  localId: string;
  nftGlobalId: string;
}

/**
 * Every valid signature `signer` holds for `docHash`, in collections that
 * provably belong to them, earliest first.
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

    if (
      !(await collectionSealBelongsTo(network, collection, signer, officialSeal))
    ) {
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
  return [found[0], ...found.slice(-(MAX_SIGNATURE_CANDIDATES - 1))];
}

/** The account's EARLIEST valid signature for `docHash`, or null. */
export async function findSignerSignature(
  network: Network,
  signer: string,
  docHash: string,
  officialSeal = '',
): Promise<SignerSignature | null> {
  return (
    (await findSignerSignatures(network, signer, docHash, officialSeal))[0] ??
    null
  );
}

function numericNftId(localId: string): number {
  const m = localId.match(/^#(\d+)#$/);
  return m ? Number.parseInt(m[1], 10) : -1;
}

export interface SignerBatchResult {
  hasVerifiedSeal: boolean;
  hasOwnCollection: boolean;
  sealNftGlobalId?: string | null;
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
    if (
      !(await collectionSealBelongsTo(network, collection, signer, officialSeal))
    ) {
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
