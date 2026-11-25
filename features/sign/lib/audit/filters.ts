/**
 * Pure filtering, KPI calculation, signer narrowing, and integrity evaluation
 * for Radix Seal collection audits.
 */
import type { CollectionIntegrity } from '../onchain-custody';
import { instantOf } from '../timestamp';
import type {
  AuditFilterState,
  AuditKpis,
  AuditRecord,
  AuditRecordKind,
  AuditSignerSummary,
  IntegritySummary,
} from './types';

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
 * account, and free-text query.
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

/** Narrows the signer directory to accounts appearing inside the filtered records. */
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

/**
 * Single source of truth for evaluating the 3 cryptographic integrity pillars
 * of a Radix Seal collection across Web UI, PDF reports, and MCP tools.
 */
export function evaluateIntegritySummary(
  integrity: CollectionIntegrity,
): IntegritySummary {
  const standardOk = integrity.hasMarker && integrity.officialBrand;
  const custodyOk = integrity.ownerLocked && integrity.issuerVerified;
  const immutableOk =
    integrity.burnDenied &&
    integrity.dataImmutable &&
    integrity.totalBurned === 0;
  return {
    standardOk,
    custodyOk,
    immutableOk,
    allOk: standardOk && custodyOk && immutableOk,
  };
}
