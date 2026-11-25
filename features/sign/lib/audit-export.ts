/**
 * Pure audit export helpers (CSV + verifiable JSON package).
 *
 * Security & compliance:
 *  - Neutralizes spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
 *    so user-controlled metadata or local aliases can never execute in Excel.
 *  - Includes UTF-8 BOM in CSV output so Excel opens Spanish/accented labels cleanly.
 *  - Never exports local AddressBook aliases unless `includeAliases` is explicitly opted in.
 *  - Stamps network (`Mainnet` vs `Stokenet (TESTNET)`), ledger cutoff state
 *    version, and SHA-256 digest of the exported JSON payload.
 */
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import type {
  AuditFilterState,
  AuditRecord,
  AuditSignerSummary,
  CollectionAuditResponse,
} from './collection-audit';
import { sha256Hex } from './timestamp';

const UTF8_BOM = '\uFEFF';
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escapes one CSV field according to RFC 4180 AND guards against CSV/Excel
 * formula injection by prefixing dangerous leading characters with `'`.
 */
export function sanitizeCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function csvRow(cells: unknown[]): string {
  return cells.map(sanitizeCsvCell).join(',');
}

export interface AuditExportOptions {
  includeAliases: boolean;
  aliasOf?: (account: string) => string | undefined;
  exportedAt?: string;
}

function networkLabel(networkId: number): string {
  if (networkId === RadixNetworkId.Stokenet) return 'Stokenet (TESTNET)';
  return NETWORKS[networkId]?.networkName ?? `Network #${networkId}`;
}

/**
 * Exports filtered audit records as a flat CSV table (one row per signer line
 * for multi-party requests so auditors can filter/pivot every signature in Excel,
 * or one row for single-actor records).
 */
export function recordsToAuditCsv(
  audit: CollectionAuditResponse,
  records: AuditRecord[],
  opts: AuditExportOptions,
): string {
  const net = networkLabel(audit.networkId);
  const headers = [
    'network',
    'collection',
    'ledger_state_version',
    'record_id',
    'kind',
    'status',
    'anomalies',
    'document_hash_blake2b256',
    'request_key',
    'record_committed_at_utc',
    'record_tx_id',
    'signer_account',
    ...(opts.includeAliases ? ['signer_local_alias_non_onchain'] : []),
    'signer_signed',
    'signer_signed_at_utc',
    'signer_tx_id',
    'signer_nft_global_id',
  ];

  const rows: string[] = [csvRow(headers)];

  for (const r of records) {
    const anomalyText = r.anomalies.join(';');
    if (r.signers.length === 0) {
      rows.push(
        csvRow([
          net,
          audit.collection,
          audit.ledgerStateVersion ?? '',
          r.id,
          r.kind,
          r.status,
          anomalyText,
          r.docHash,
          r.requestKey ?? '',
          r.committedAt ?? '',
          r.txId ?? '',
          r.signerAccount ?? '',
          ...(opts.includeAliases
            ? [r.signerAccount ? (opts.aliasOf?.(r.signerAccount) ?? '') : '']
            : []),
          '',
          '',
          '',
          '',
        ]),
      );
      continue;
    }

    for (const s of r.signers) {
      rows.push(
        csvRow([
          net,
          audit.collection,
          audit.ledgerStateVersion ?? '',
          r.id,
          r.kind,
          r.status,
          anomalyText,
          r.docHash,
          r.requestKey ?? '',
          r.committedAt ?? '',
          r.txId ?? '',
          s.account,
          ...(opts.includeAliases ? [opts.aliasOf?.(s.account) ?? ''] : []),
          s.signed ? 'true' : 'false',
          s.signedAt ?? '',
          s.txId ?? '',
          s.nftGlobalId ?? '',
        ]),
      );
    }
  }

  return UTF8_BOM + rows.join('\n') + '\n';
}

/**
 * Exports the institution's participating Radix addresses directory as CSV.
 */
export function signersToAuditCsv(
  audit: CollectionAuditResponse,
  signers: AuditSignerSummary[],
  opts: AuditExportOptions,
): string {
  const net = networkLabel(audit.networkId);
  const headers = [
    'network',
    'collection',
    'ledger_state_version',
    'account_address',
    ...(opts.includeAliases ? ['local_alias_non_onchain'] : []),
    'verified_radix_seal',
    'has_signing_collection',
    'invited_count',
    'signed_count',
    'pending_count',
    'cipher_count',
    'first_activity_utc',
    'last_activity_utc',
  ];

  const rows: string[] = [csvRow(headers)];
  for (const s of signers) {
    rows.push(
      csvRow([
        net,
        audit.collection,
        audit.ledgerStateVersion ?? '',
        s.account,
        ...(opts.includeAliases ? [opts.aliasOf?.(s.account) ?? ''] : []),
        s.hasVerifiedSeal ? 'true' : 'false',
        s.hasOwnCollection ? 'true' : 'false',
        s.invitedCount,
        s.signedCount,
        s.pendingCount,
        s.cipherCount,
        s.firstActivityAt ?? '',
        s.lastActivityAt ?? '',
      ]),
    );
  }

  return UTF8_BOM + rows.join('\n') + '\n';
}

export interface AuditJsonPackage {
  schema: 'radix-seal-audit/v1';
  exportedAt: string;
  network: string;
  networkId: number;
  isTestnet: boolean;
  collection: string;
  ledgerCutoff: {
    stateVersion: number | null;
    timestamp: string | null;
    scannedFromId: number;
    scannedToId: number;
    totalSupply: number;
  };
  issuer: CollectionAuditResponse['issuer'];
  integrity: CollectionAuditResponse['integrity'];
  filters: AuditFilterState;
  includesLocalAliases: boolean;
  records: AuditRecord[];
  signers: Array<AuditSignerSummary & { localAlias?: string }>;
  integrityDigestSha256: string;
}

/**
 * Builds a structured, canonical JSON audit package stamped with the SHA-256
 * digest of its core payload so archiving/SIEM pipelines can detect tampering.
 */
export async function buildAuditJsonPackage(
  audit: CollectionAuditResponse,
  records: AuditRecord[],
  signers: AuditSignerSummary[],
  filters: AuditFilterState,
  opts: AuditExportOptions,
): Promise<AuditJsonPackage> {
  const exportedAt = opts.exportedAt ?? new Date().toISOString();
  const mappedSigners = signers.map((s) => {
    const alias = opts.includeAliases ? opts.aliasOf?.(s.account) : undefined;
    return alias ? { ...s, localAlias: alias } : s;
  });

  const core = {
    schema: 'radix-seal-audit/v1' as const,
    exportedAt,
    network: networkLabel(audit.networkId),
    networkId: audit.networkId,
    isTestnet: audit.networkId === RadixNetworkId.Stokenet,
    collection: audit.collection,
    ledgerCutoff: {
      stateVersion: audit.ledgerStateVersion,
      timestamp: audit.ledgerTimestamp,
      scannedFromId: audit.scannedFromId,
      scannedToId: audit.scannedToId,
      totalSupply: audit.totalSupply,
    },
    issuer: audit.issuer,
    integrity: audit.integrity,
    filters,
    includesLocalAliases: opts.includeAliases,
    records,
    signers: mappedSigners,
  };

  const integrityDigestSha256 = await sha256Hex(JSON.stringify(core));
  return { ...core, integrityDigestSha256 };
}
