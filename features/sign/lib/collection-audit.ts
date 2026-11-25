/**
 * Pure Radix Seal collection audit engine.
 *
 * Transforms raw on-ledger NFTs (`#1..#totalSupply`) inside a signing
 * collection into semantic business records (`multi_request`, `solo_signature`,
 * `cosign_signature`, `cipher_*`), verifies batch integrity and consensus
 * timestamps, aggregates the institution's participating Radix addresses, and
 * provides pure filtering and KPI calculation.
 *
 * Kept framework-free so both `/api/sign/collection-audit`, client hooks,
 * exporters, and unit tests share a single source of truth.
 */
import type {
  CollectionIntegrity,
  LedgerCommit,
  NfRecord,
  SignerBatchResult,
} from './onchain-custody';
import { instantOf, issuedAtAgrees } from './timestamp';

/* ─── Contracts ───────────────────────────────────────────────────────────── */

export type AuditRecordKind =
  | 'multi_request'
  | 'solo_signature'
  | 'cosign_signature'
  | 'cipher_signature'
  | 'cipher_invite'
  | 'cipher_receipt';

export type AuditRecordStatus =
  | 'complete'
  | 'partial'
  | 'pending'
  | 'recorded'
  | 'anomaly';

export type AuditAnomalyCode =
  | 'incomplete_invite_batch'
  | 'clock_mismatch';

export interface AuditSignerEntry {
  account: string;
  index: number;
  signed: boolean;
  signedAt: string | null;
  txId: string | null;
  /** Signature NFT minted by this signer (`resource:#id#`), when signed. */
  nftGlobalId: string | null;
  /** Invitation NFT the issuer minted for this signer (`resource:#id#`). */
  inviteNftGlobalId?: string | null;
  clockAgrees: boolean | null;
}

export interface AuditRecord {
  id: string;
  kind: AuditRecordKind;
  docHash: string;
  requestKey: string | null;
  nftIds: string[];
  firstNumericId: number;
  stateVersion: number;
  committedAt: string | null;
  issuedAt: string;
  txId: string | null;
  clockAgrees: boolean | null;
  status: AuditRecordStatus;
  anomalies: AuditAnomalyCode[];
  requiredSigners: string[];
  signers: AuditSignerEntry[];
  signedCount: number;
  totalSigners: number;
  signerAccount?: string;
}

export interface AuditNftRef {
  kind: 'invite' | 'signature';
  nftGlobalId: string;
  docHash: string;
}

export interface AuditSignerSummary {
  account: string;
  hasVerifiedSeal: boolean;
  hasOwnCollection: boolean;
  invitedCount: number;
  signedCount: number;
  pendingCount: number;
  cipherCount: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  /** The account's Radix Seal insignia NFT, read from the ledger. */
  sealNftGlobalId?: string | null;
  /** Signing collections this account owns through its Seal. */
  ownCollectionAddresses?: string[];
  /** Invitation and signature NFTs tied to this account in the audited scope. */
  nftRefs?: AuditNftRef[];
}

export interface AuditIssuerInfo {
  account: string | null;
  name: string | null;
  symbol: string | null;
  orgName: string | null;
  orgUrl: string | null;
  iconUrl: string | null;
}

export interface CollectionAuditResponse {
  found: boolean;
  networkId: number;
  collection: string;
  ledgerStateVersion: number | null;
  ledgerTimestamp: string | null;
  totalSupply: number;
  scannedFromId: number;
  scannedToId: number;
  hasMoreOlder: boolean;
  issuer: AuditIssuerInfo;
  integrity: CollectionIntegrity;
  records: AuditRecord[];
  signers: AuditSignerSummary[];
}

export interface AuditFilterState {
  fromDate: string;
  toDate: string;
  category:
    | 'all'
    | 'multi_request'
    | 'solo_signature'
    | 'cosign_signature'
    | 'cipher';
  status: 'all' | 'complete' | 'pending' | 'recorded' | 'anomaly';
  query: string;
  signerFilter: string;
}

export const DEFAULT_AUDIT_FILTERS: AuditFilterState = {
  fromDate: '',
  toDate: '',
  category: 'all',
  status: 'all',
  query: '',
  signerFilter: '',
};

export interface AuditKpis {
  totalRecords: number;
  signatureRequests: number;
  completeCount: number;
  pendingCount: number;
  completionRate: number;
  uniqueSigners: number;
  cipherCount: number;
  anomalyCount: number;
}

/* ─── Grouping raw collection NFTs ────────────────────────────────────────── */

export interface GroupedAuditDraft {
  id: string;
  kind: AuditRecordKind;
  docHash: string;
  requestKey: string | null;
  nftIds: string[];
  firstNumericId: number;
  stateVersion: number;
  issuedAt: string;
  anomalies: AuditAnomalyCode[];
  requiredSigners: string[];
  signerAccount?: string;
  /** signer account → their invitation NFT global id (invite batches only). */
  inviteNftBySigner?: Record<string, string>;
  /** Local signature NFT minted by the initiator inside this same batch. */
  localInitiatorSignature?: {
    account: string;
    nftGlobalId: string;
    stateVersion: number;
    issuedAt: string;
  };
}

function parseNftNum(localId: string): number {
  const m = localId.match(/^#?(\d+)#?$/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

const MAX_BATCH_SIZE = 50;

/**
 * Groups raw collection NFTs into semantic business records:
 *  - `invite` batches (keyed by `first_id`) → `multi_request`
 *  - `cipher-invite` batches (keyed by `first_id`) → `cipher_invite`
 *  - `signature` referencing an `invite` batch in the same collection → merged
 *    onto that `multi_request` so the initiator is never listed twice
 *  - remaining `signature`, `cipher-signature`, `cipher-receipt` → own record
 */
export function groupCollectionNfts(
  collection: string,
  recordsMap: Map<string, NfRecord>,
): GroupedAuditDraft[] {
  const entries = [...recordsMap.entries()].sort(
    ([a], [b]) => parseNftNum(a) - parseNftNum(b),
  );

  const inviteBatches = new Map<
    string,
    {
      kind: 'multi_request' | 'cipher_invite';
      firstId: number;
      expectedCount: number;
      docHash: string;
      items: Array<{ id: string; numId: number; record: NfRecord }>;
    }
  >();

  const standalone: Array<{ id: string; numId: number; record: NfRecord }> = [];

  for (const [id, record] of entries) {
    const numId = parseNftNum(id);
    const kind = record.fields.kind;
    if (kind === 'invite' || kind === 'cipher-invite') {
      const firstId = Number.parseInt(record.fields.first_id || String(numId), 10);
      const count = Number.parseInt(record.fields.signer_count || '1', 10);
      const batchKind = kind === 'invite' ? 'multi_request' : 'cipher_invite';
      const batchKey = `${batchKind}:${firstId}`;
      const existing = inviteBatches.get(batchKey);
      if (existing) {
        existing.items.push({ id, numId, record });
      } else {
        inviteBatches.set(batchKey, {
          kind: batchKind,
          firstId: Number.isInteger(firstId) && firstId > 0 ? firstId : numId,
          expectedCount:
            Number.isInteger(count) && count > 0
              ? Math.min(count, MAX_BATCH_SIZE)
              : 1,
          docHash: record.fields.document_hash ?? '',
          items: [{ id, numId, record }],
        });
      }
      continue;
    }
    standalone.push({ id, numId, record });
  }

  const drafts: GroupedAuditDraft[] = [];
  const multiByRequestKey = new Map<string, GroupedAuditDraft>();

  for (const batch of inviteBatches.values()) {
    batch.items.sort((a, b) => a.numId - b.numId);
    const anchor = batch.items[0];
    const docHash = batch.docHash || anchor.record.fields.document_hash || '';
    const reqKey = `${collection}:#${batch.firstId}#`;

    // Verify contiguous batch completeness: every expected signer_index exists
    // and carries the same document_hash.
    const validItems = batch.items.filter(
      (item) =>
        item.record.fields.document_hash === docHash &&
        !!item.record.fields.signer,
    );
    const anomalies: AuditAnomalyCode[] = [];
    if (validItems.length !== batch.expectedCount) {
      anomalies.push('incomplete_invite_batch');
    }

    const requiredSigners: string[] = [];
    const inviteNftBySigner: Record<string, string> = {};
    const seen = new Set<string>();
    for (const item of validItems) {
      const s = item.record.fields.signer;
      if (s && !seen.has(s)) {
        seen.add(s);
        requiredSigners.push(s);
        inviteNftBySigner[s] = `${collection}:${item.id}`;
      }
    }

    const draft: GroupedAuditDraft = {
      id: reqKey,
      kind: batch.kind,
      docHash,
      requestKey: reqKey,
      nftIds: batch.items.map((x) => x.id),
      firstNumericId: batch.firstId,
      stateVersion: anchor.record.stateVersion,
      issuedAt: anchor.record.fields.issued_at ?? '',
      anomalies,
      requiredSigners,
      inviteNftBySigner,
    };
    drafts.push(draft);
    if (batch.kind === 'multi_request') {
      multiByRequestKey.set(reqKey, draft);
    }
  }

  for (const { id, numId, record } of standalone) {
    const f = record.fields;
    const req = (f.request ?? '').trim();
    if (f.kind === 'signature') {
      const parent = req ? multiByRequestKey.get(req) : undefined;
      if (parent && f.document_hash === parent.docHash && f.signer) {
        parent.nftIds.push(id);
        parent.localInitiatorSignature = {
          account: f.signer,
          nftGlobalId: `${collection}:${id}`,
          stateVersion: record.stateVersion,
          issuedAt: f.issued_at ?? '',
        };
        continue;
      }
      drafts.push({
        id: `${collection}:${id}`,
        kind: req ? 'cosign_signature' : 'solo_signature',
        docHash: f.document_hash ?? '',
        requestKey: req || null,
        nftIds: [id],
        firstNumericId: numId,
        stateVersion: record.stateVersion,
        issuedAt: f.issued_at ?? '',
        anomalies: [],
        requiredSigners: f.signer ? [f.signer] : [],
        signerAccount: f.signer || undefined,
      });
      continue;
    }

    if (f.kind === 'cipher-signature' || f.kind === 'cipher-receipt') {
      drafts.push({
        id: `${collection}:${id}`,
        kind: f.kind === 'cipher-signature' ? 'cipher_signature' : 'cipher_receipt',
        docHash: f.document_hash ?? '',
        requestKey: req || null,
        nftIds: [id],
        firstNumericId: numId,
        stateVersion: record.stateVersion,
        issuedAt: f.issued_at ?? '',
        anomalies: [],
        requiredSigners: f.signer ? [f.signer] : [],
        signerAccount: f.signer || undefined,
      });
    }
  }

  return drafts;
}

/* ─── Finalization with ledger commits & signer resolution ────────────────── */

function earlierIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Combines grouped collection drafts with resolved consensus commits and each
 * signer's on-chain signature collection lookup into finalized `AuditRecord`s.
 */
export function finalizeAuditRecords(
  drafts: GroupedAuditDraft[],
  commits: Map<number, LedgerCommit>,
  signerResults: Map<string, SignerBatchResult>,
): AuditRecord[] {
  const records: AuditRecord[] = drafts.map((draft) => {
    const commit = commits.get(draft.stateVersion);
    const committedAt = commit?.confirmedAt ?? null;
    const txId = commit?.intentHash ?? null;
    const clockAgrees = issuedAtAgrees(draft.issuedAt, committedAt);
    const anomalies = [...draft.anomalies];
    if (clockAgrees === false && !anomalies.includes('clock_mismatch')) {
      anomalies.push('clock_mismatch');
    }

    let signers: AuditSignerEntry[] = [];
    if (draft.kind === 'multi_request') {
      signers = draft.requiredSigners.map((account, index) => {
        const candidates =
          signerResults.get(account)?.signaturesByHash.get(draft.docHash) ?? [];
        // Prefer the signature minted alongside this batch if available, else earliest.
        const match =
          candidates.find((c) => c.stateVersion === draft.stateVersion) ??
          candidates[0] ??
          (draft.localInitiatorSignature?.account === account
            ? {
                stateVersion: draft.localInitiatorSignature.stateVersion,
                issuedAt: draft.localInitiatorSignature.issuedAt,
                nftGlobalId: draft.localInitiatorSignature.nftGlobalId,
              }
            : null);

        if (!match) {
          return {
            account,
            index,
            signed: false,
            signedAt: null,
            txId: null,
            nftGlobalId: null,
            inviteNftGlobalId: draft.inviteNftBySigner?.[account] ?? null,
            clockAgrees: null,
          };
        }
        const sigCommit = commits.get(match.stateVersion);
        const signedAt = sigCommit?.confirmedAt ?? null;
        const sigClockAgrees = issuedAtAgrees(match.issuedAt, signedAt);
        if (sigClockAgrees === false && !anomalies.includes('clock_mismatch')) {
          anomalies.push('clock_mismatch');
        }
        return {
          account,
          index,
          signed: true,
          signedAt,
          txId: sigCommit?.intentHash ?? null,
          nftGlobalId: match.nftGlobalId,
          inviteNftGlobalId: draft.inviteNftBySigner?.[account] ?? null,
          clockAgrees: sigClockAgrees,
        };
      });
    } else if (
      draft.kind === 'solo_signature' ||
      draft.kind === 'cosign_signature'
    ) {
      const account = draft.signerAccount ?? draft.requiredSigners[0] ?? '';
      signers = account
        ? [
            {
              account,
              index: 0,
              signed: true,
              signedAt: committedAt,
              txId,
              nftGlobalId: draft.id,
              clockAgrees,
            },
          ]
        : [];
    } else if (draft.kind === 'cipher_invite') {
      signers = draft.requiredSigners.map((account, index) => ({
        account,
        index,
        signed: false,
        signedAt: null,
        txId: null,
        nftGlobalId: null,
        inviteNftGlobalId: draft.inviteNftBySigner?.[account] ?? null,
        clockAgrees: null,
      }));
    } else if (draft.signerAccount) {
      signers = [
        {
          account: draft.signerAccount,
          index: 0,
          signed: true,
          signedAt: committedAt,
          txId,
          nftGlobalId: draft.id,
          clockAgrees,
        },
      ];
    }

    const signedCount =
      draft.kind === 'multi_request'
        ? signers.filter((s) => s.signed).length
        : draft.kind === 'solo_signature' || draft.kind === 'cosign_signature'
          ? signers.length
          : 0;
    const totalSigners = draft.requiredSigners.length;

    let status: AuditRecordStatus;
    if (anomalies.length > 0) {
      status = 'anomaly';
    } else if (draft.kind === 'multi_request') {
      if (totalSigners > 0 && signedCount === totalSigners) status = 'complete';
      else if (signedCount > 0) status = 'partial';
      else status = 'pending';
    } else {
      status = 'recorded';
    }

    return {
      id: draft.id,
      kind: draft.kind,
      docHash: draft.docHash,
      requestKey: draft.requestKey,
      nftIds: draft.nftIds,
      firstNumericId: draft.firstNumericId,
      stateVersion: draft.stateVersion,
      committedAt,
      issuedAt: draft.issuedAt,
      txId,
      clockAgrees,
      status,
      anomalies,
      requiredSigners: draft.requiredSigners,
      signers,
      signedCount,
      totalSigners,
      signerAccount: draft.signerAccount,
    };
  });

  return records.sort(
    (a, b) =>
      b.stateVersion - a.stateVersion || b.firstNumericId - a.firstNumericId,
  );
}

/* ─── Signer directory aggregation ────────────────────────────────────────── */

/**
 * Builds the consolidated directory of participating Radix addresses across
 * all audited records.
 */
export function buildSignerDirectory(
  records: AuditRecord[],
  signerResults: Map<string, SignerBatchResult>,
): AuditSignerSummary[] {
  const map = new Map<string, AuditSignerSummary>();
  const ensure = (account: string): AuditSignerSummary => {
    let entry = map.get(account);
    if (!entry) {
      const meta = signerResults.get(account);
      entry = {
        account,
        hasVerifiedSeal: meta?.hasVerifiedSeal ?? false,
        hasOwnCollection: meta?.hasOwnCollection ?? false,
        invitedCount: 0,
        signedCount: 0,
        pendingCount: 0,
        cipherCount: 0,
        firstActivityAt: null,
        lastActivityAt: null,
        sealNftGlobalId: meta?.sealNftGlobalId ?? null,
        ownCollectionAddresses: meta?.ownCollectionAddresses ?? [],
        nftRefs: [],
      };
      map.set(account, entry);
    }
    return entry;
  };
  const addRef = (
    item: AuditSignerSummary,
    kind: AuditNftRef['kind'],
    nftGlobalId: string | null | undefined,
    docHash: string,
  ) => {
    if (!nftGlobalId) return;
    const refs = (item.nftRefs ??= []);
    if (refs.some((r) => r.kind === kind && r.nftGlobalId === nftGlobalId)) return;
    refs.push({ kind, nftGlobalId, docHash });
  };

  for (const record of records) {
    const recTime = record.committedAt;
    if (record.kind === 'multi_request') {
      for (const s of record.signers) {
        const item = ensure(s.account);
        item.invitedCount += 1;
        addRef(item, 'invite', s.inviteNftGlobalId, record.docHash);
        if (s.signed) {
          item.signedCount += 1;
          addRef(item, 'signature', s.nftGlobalId, record.docHash);
          const act = s.signedAt ?? recTime;
          item.firstActivityAt = earlierIso(item.firstActivityAt, act);
          item.lastActivityAt = laterIso(item.lastActivityAt, act);
        } else {
          item.pendingCount += 1;
          item.firstActivityAt = earlierIso(item.firstActivityAt, recTime);
          item.lastActivityAt = laterIso(item.lastActivityAt, recTime);
        }
      }
    } else if (
      record.kind === 'solo_signature' ||
      record.kind === 'cosign_signature'
    ) {
      const account = record.signerAccount ?? record.requiredSigners[0];
      if (!account) continue;
      const item = ensure(account);
      item.signedCount += 1;
      addRef(item, 'signature', record.signers[0]?.nftGlobalId, record.docHash);
      item.firstActivityAt = earlierIso(item.firstActivityAt, recTime);
      item.lastActivityAt = laterIso(item.lastActivityAt, recTime);
    } else {
      for (const account of record.requiredSigners) {
        const item = ensure(account);
        item.cipherCount += 1;
        item.firstActivityAt = earlierIso(item.firstActivityAt, recTime);
        item.lastActivityAt = laterIso(item.lastActivityAt, recTime);
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return tb - ta || b.signedCount - a.signedCount || a.account.localeCompare(b.account);
  });
}

/* ─── Filtering & KPIs ────────────────────────────────────────────────────── */

export function recordTimestampMs(record: AuditRecord): number | null {
  if (record.committedAt) {
    const t = Date.parse(record.committedAt);
    if (!Number.isNaN(t)) return t;
  }
  return instantOf(record.issuedAt);
}

export function isCipherKind(kind: AuditRecordKind): boolean {
  return (
    kind === 'cipher_signature' ||
    kind === 'cipher_invite' ||
    kind === 'cipher_receipt'
  );
}

/**
 * Filters records by UTC date range, category, compliance status, exact signer
 * account, and free-text query (matching docHash, requestKey, txId, address,
 * or local AddressBook alias).
 */
export function filterAuditRecords(
  records: AuditRecord[],
  filters: AuditFilterState,
  aliasOf?: (account: string) => string | undefined,
): AuditRecord[] {
  const fromMs = filters.fromDate
    ? Date.parse(`${filters.fromDate}T00:00:00.000Z`)
    : null;
  const toMs = filters.toDate
    ? Date.parse(`${filters.toDate}T23:59:59.999Z`)
    : null;
  const q = filters.query.trim().toLowerCase();
  const signerExact = filters.signerFilter.trim();

  return records.filter((r) => {
    if (fromMs !== null || toMs !== null) {
      const ts = recordTimestampMs(r);
      if (ts === null) return false;
      if (fromMs !== null && !Number.isNaN(fromMs) && ts < fromMs) return false;
      if (toMs !== null && !Number.isNaN(toMs) && ts > toMs) return false;
    }

    if (filters.category !== 'all') {
      if (filters.category === 'cipher') {
        if (!isCipherKind(r.kind)) return false;
      } else if (r.kind !== filters.category) {
        return false;
      }
    }

    if (filters.status !== 'all') {
      if (filters.status === 'pending') {
        if (r.status !== 'pending' && r.status !== 'partial') return false;
      } else if (r.status !== filters.status) {
        return false;
      }
    }

    if (signerExact) {
      const hasAccount =
        r.signerAccount === signerExact ||
        r.requiredSigners.includes(signerExact) ||
        r.signers.some((s) => s.account === signerExact);
      if (!hasAccount) return false;
    }

    if (q) {
      const haystacks = [
        r.docHash,
        r.requestKey ?? '',
        r.txId ?? '',
        r.id,
        ...r.requiredSigners,
        ...r.signers.flatMap((s) => [
          s.account,
          s.txId ?? '',
          s.nftGlobalId ?? '',
          aliasOf?.(s.account) ?? '',
        ]),
      ];
      if (!haystacks.some((h) => h.toLowerCase().includes(q))) return false;
    }

    return true;
  });
}

/** Computes executive KPIs over the currently filtered record slice. */
export function computeAuditKpis(records: AuditRecord[]): AuditKpis {
  const multi = records.filter((r) => r.kind === 'multi_request');
  const soloOrCosign = records.filter(
    (r) => r.kind === 'solo_signature' || r.kind === 'cosign_signature',
  );
  const completeMulti = multi.filter((r) => r.status === 'complete').length;
  const pendingMulti = multi.filter(
    (r) => r.status === 'pending' || r.status === 'partial',
  ).length;
  const cipherCount = records.filter((r) => isCipherKind(r.kind)).length;
  const anomalyCount = records.filter((r) => r.anomalies.length > 0).length;

  const signatureRequests = multi.length + soloOrCosign.length;
  const completedAll = completeMulti + soloOrCosign.length;
  const completionRate =
    signatureRequests > 0
      ? Math.round((completedAll / signatureRequests) * 100)
      : 0;

  const accounts = new Set<string>();
  for (const r of records) {
    if (r.signerAccount) accounts.add(r.signerAccount);
    for (const a of r.requiredSigners) accounts.add(a);
  }

  return {
    totalRecords: records.length,
    signatureRequests,
    completeCount: completedAll,
    pendingCount: pendingMulti,
    completionRate,
    uniqueSigners: accounts.size,
    cipherCount,
    anomalyCount,
  };
}

export function hasActiveAuditFilters(filters: AuditFilterState): boolean {
  return (
    !!filters.fromDate ||
    !!filters.toDate ||
    filters.category !== 'all' ||
    filters.status !== 'all' ||
    !!filters.query.trim() ||
    !!filters.signerFilter.trim()
  );
}

/**
 * Narrows the institution's signer directory to accounts appearing inside the
 * currently filtered records when any filter is active.
 */
export function filterAuditSigners(
  signers: AuditSignerSummary[],
  filteredRecords: AuditRecord[],
  filters: AuditFilterState,
): AuditSignerSummary[] {
  if (!hasActiveAuditFilters(filters)) return signers;
  const visible = new Set<string>();
  for (const r of filteredRecords) {
    if (r.signerAccount) visible.add(r.signerAccount);
    for (const s of r.requiredSigners) visible.add(s);
  }
  return signers.filter((s) => visible.has(s.account));
}
