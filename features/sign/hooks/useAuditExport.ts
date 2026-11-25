'use client';

import { useState } from 'react';
import { downloadTextFile } from '@/features/console/lib/file-utils';
import { SEAL_IMAGE_PATH } from '../constants/seal';
import {
  buildAuditJsonPackage,
  recordsToAuditCsv,
  signersToAuditCsv,
} from '../lib/audit-export';
import { buildAuditReportPdf } from '../lib/audit-pdf';
import { downloadBytes } from '../lib/certificate';
import type {
  AuditFilterState,
  AuditKpis,
  AuditRecord,
  AuditSignerSummary,
  CollectionAuditResponse,
} from '../lib/collection-audit';
import { networkNameForId } from '../lib/network';
import { readBrandAccent } from '../lib/pdf-layout';
import type {
  AuditExportFormat,
  AuditLabels,
} from '../components/audit/AuditFormatters';

/**
 * Handles PDF, CSV (records/signers), and verifiable JSON+SHA-256 exports for
 * the Radix Seal Audit workspace.
 */
export function useAuditExport({
  audit,
  filteredRecords,
  filteredSigners,
  kpis,
  effectiveFilters,
  labels,
  language,
  includeAliases,
  aliasOf,
  shareUrl,
}: {
  audit: CollectionAuditResponse | null | undefined;
  filteredRecords: AuditRecord[];
  filteredSigners: AuditSignerSummary[];
  kpis: AuditKpis;
  effectiveFilters: AuditFilterState;
  labels: AuditLabels;
  language: string;
  includeAliases: boolean;
  aliasOf: (account: string) => string | undefined;
  shareUrl: () => string;
}) {
  const [exporting, setExporting] = useState<AuditExportFormat | null>(null);

  const handleExport = async (format: AuditExportFormat) => {
    if (!audit || !audit.found) return;
    setExporting(format);
    const shortId = audit.collection.slice(-8);
    const netTag = networkNameForId(audit.networkId);
    try {
      if (format === 'csv-records') {
        const csv = recordsToAuditCsv(audit, filteredRecords, {
          includeAliases,
          aliasOf,
        });
        downloadTextFile(
          `radix-seal-audit-${netTag}-records-${shortId}.csv`,
          csv,
          'text/csv',
        );
      } else if (format === 'csv-signers') {
        const csv = signersToAuditCsv(audit, filteredSigners, {
          includeAliases,
          aliasOf,
        });
        downloadTextFile(
          `radix-seal-audit-${netTag}-signers-${shortId}.csv`,
          csv,
          'text/csv',
        );
      } else if (format === 'json') {
        const pkg = await buildAuditJsonPackage(
          audit,
          filteredRecords,
          filteredSigners,
          effectiveFilters,
          { includeAliases, aliasOf },
        );
        downloadTextFile(
          `radix-seal-audit-${netTag}-${shortId}.json`,
          JSON.stringify(pkg, null, 2),
          'application/json',
        );
      } else if (format === 'pdf') {
        const origin =
          typeof window !== 'undefined' ? window.location.origin : undefined;
        const pdfBytes = await buildAuditReportPdf({
          audit,
          records: filteredRecords,
          signers: filteredSigners,
          kpis,
          filters: effectiveFilters,
          labels: labels.pdf,
          kindLabels: labels.records.kinds,
          locale: language,
          origin,
          sealImageUrl: origin ? `${origin}${SEAL_IMAGE_PATH}` : undefined,
          auditUrl: shareUrl() || undefined,
          includeAliases,
          aliasOf,
          accent: readBrandAccent(),
        });
        downloadBytes(
          pdfBytes,
          `radix-seal-audit-${netTag}-${shortId}.pdf`,
          'application/pdf',
        );
      }
    } finally {
      setExporting(null);
    }
  };

  return { exporting, handleExport };
}
