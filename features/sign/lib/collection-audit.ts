/**
 * Barrel for the pure Radix Seal collection audit engine.
 *
 * Modularized under `./audit/`:
 *  - `types.ts` — shared contracts & filter defaults
 *  - `grouping.ts` — raw NFT grouping, commit finalization & signer directory
 *  - `filters.ts` — record filtering, KPIs & cryptographic integrity summary
 */
export {
  DEFAULT_AUDIT_FILTERS,
  type AuditRecordKind,
  type AuditRecordStatus,
  type AuditAnomalyCode,
  type AuditSignerEntry,
  type AuditRecord,
  type AuditNftRef,
  type AuditSignerSummary,
  type AuditIssuerInfo,
  type CollectionAuditResponse,
  type AuditFilterState,
  type AuditKpis,
  type GroupedAuditDraft,
  type IntegritySummary,
} from './audit/types';

export {
  groupCollectionNfts,
  finalizeAuditRecords,
  buildSignerDirectory,
} from './audit/grouping';

export {
  recordTimestampMs,
  isCipherKind,
  filterAuditRecords,
  computeAuditKpis,
  hasActiveAuditFilters,
  filterAuditSigners,
  evaluateIntegritySummary,
} from './audit/filters';
