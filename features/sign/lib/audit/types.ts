/**
 * Shared types and defaults for the pure Radix Seal collection audit engine.
 */
import type { CollectionIntegrity } from '../onchain-custody';
import type { DomainVerificationResult } from '../domain-verify';

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

export type AuditAnomalyCode = 'incomplete_invite_batch' | 'clock_mismatch';

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
  /** Custody-free domain proof (`/.well-known/radix-seal.json` or DNS TXT). */
  domainVerification?: DomainVerificationResult | null;
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
  inviteNftBySigner?: Record<string, string>;
  localInitiatorSignature?: {
    account: string;
    nftGlobalId: string;
    stateVersion: number;
    issuedAt: string;
  };
}

export interface IntegritySummary {
  standardOk: boolean;
  custodyOk: boolean;
  immutableOk: boolean;
  allOk: boolean;
}
