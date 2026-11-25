'use client';

import { useState } from 'react';
import { Building2, FileSearch, RefreshCw, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { downloadTextFile } from '@/features/console/lib/file-utils';
import { networkOfAddress } from '@/features/dashboard/lib/routes';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useAddressBook } from '@/features/wallet/hooks/useAddressBook';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { SEAL_IMAGE_PATH } from '../../constants/seal';
import { useCollectionAudit } from '../../hooks/useCollectionAudit';
import {
  buildAuditJsonPackage,
  recordsToAuditCsv,
  signersToAuditCsv,
} from '../../lib/audit-export';
import { buildAuditReportPdf } from '../../lib/audit-pdf';
import { downloadBytes } from '../../lib/certificate';
import {
  DEFAULT_AUDIT_FILTERS,
  computeAuditKpis,
  filterAuditRecords,
  filterAuditSigners,
  hasActiveAuditFilters,
  type AuditFilterState,
} from '../../lib/collection-audit';
import { readBrandAccent } from '../../lib/pdf-layout';
import { networkIdFromResource } from '../../lib/share';
import type { UserSignCollection } from '../../services/sealDiscovery';
import {
  buildAuditShareUrl,
  explorerNetworkForId,
  type AuditLabels,
} from './AuditFormatters';
import { AuditFilterBar } from './AuditFilterBar';
import { AuditHeader, type AuditExportFormat } from './AuditHeader';
import { AuditKpiStrip } from './AuditKpiStrip';
import { AuditRecordsTable } from './AuditRecordsTable';
import { AuditSignersDirectory } from './AuditSignersDirectory';

type SubTab = 'records' | 'signers';
type SourceMode = 'owned' | 'external';

const COLLECTION_RE = /^resource_(rdx|tdx_2_)1[a-z0-9]+$/;

/**
 * Institutional Audit & Registry view for Radix Seal signing collections.
 *
 * Works in two zero-friction modes:
 *  - Institution Mode (wallet connected): auto-loads the active collection and
 *    lets the operator switch across their owned collections.
 *  - External Auditor Mode (no wallet required): inspects any public collection
 *    address or shared audit URL in read-only mode against the Radix ledger.
 */
export function CollectionAuditTab({
  labels,
  isConnected,
  ownedCollections,
  activeCollection,
  initialCollection,
  initialFromDate,
  initialToDate,
}: {
  labels: AuditLabels;
  isConnected: boolean;
  ownedCollections: UserSignCollection[];
  activeCollection: string | null;
  initialCollection?: string;
  initialFromDate?: string;
  initialToDate?: string;
}) {
  const { activeNetworkId } = useRadixWallet();
  const { language } = useLanguage();
  const { entries, addEntry, updateEntry, deleteEntry } = useAddressBook();

  const initialExternal =
    initialCollection && COLLECTION_RE.test(initialCollection.trim())
      ? initialCollection.trim()
      : '';

  const [mode, setMode] = useState<SourceMode>(
    initialExternal || !isConnected ? 'external' : 'owned',
  );
  const [selectedOwned, setSelectedOwned] = useState<string | null>(null);
  const [externalInput, setExternalInput] = useState(initialExternal);
  const [externalTarget, setExternalTarget] = useState(initialExternal);
  const [externalError, setExternalError] = useState('');

  const [subTab, setSubTab] = useState<SubTab>('records');
  const [filters, setFilters] = useState<AuditFilterState>({
    ...DEFAULT_AUDIT_FILTERS,
    fromDate: initialFromDate ?? '',
    toDate: initialToDate ?? '',
  });
  const [includeAliases, setIncludeAliases] = useState(false);
  const [exporting, setExporting] = useState<AuditExportFormat | null>(null);

  const effectiveMode: SourceMode =
    !isConnected && mode === 'owned' ? 'external' : mode;

  // Keep owned collections strictly scoped to the active wallet network so
  // switching between Mainnet and Stokenet never mixes resources.
  const networkOwnedCollections = ownedCollections.filter(
    (c) =>
      activeNetworkId == null ||
      networkIdFromResource(c.resourceAddress) === activeNetworkId,
  );
  const validOwnedSelection =
    selectedOwned &&
    networkOwnedCollections.some((c) => c.resourceAddress === selectedOwned)
      ? selectedOwned
      : null;
  const validActiveOwned =
    activeCollection &&
    networkOwnedCollections.some((c) => c.resourceAddress === activeCollection)
      ? activeCollection
      : null;

  const targetCollection =
    effectiveMode === 'owned'
      ? validOwnedSelection ??
        validActiveOwned ??
        networkOwnedCollections[0]?.resourceAddress ??
        null
      : externalTarget || null;

  // Derive the ledger strictly from the collection's own Bech32 prefix
  // (`resource_rdx1…` → Mainnet 1, `resource_tdx_2_1…` → Stokenet 2).
  const targetNetworkId = targetCollection
    ? networkIdFromResource(targetCollection)
    : null;

  // Clear any signer filter whose account prefix belongs to the other ledger.
  const expectedNet =
    targetNetworkId != null ? explorerNetworkForId(targetNetworkId) : undefined;
  const signerMatchesLedger =
    !filters.signerFilter ||
    !expectedNet ||
    networkOfAddress(filters.signerFilter) === expectedNet;
  const effectiveFilters: AuditFilterState = signerMatchesLedger
    ? filters
    : { ...filters, signerFilter: '' };

  const {
    audit,
    loading,
    fetching,
    error,
    loadingOlder,
    loadOlder,
    refresh,
  } = useCollectionAudit(targetNetworkId, targetCollection);

  const aliasOf = (account: string): string | undefined =>
    entries.find(
      (e) => e.address.trim().toLowerCase() === account.trim().toLowerCase(),
    )?.name;

  const handleSaveAlias = (address: string, alias: string) => {
    const existing = entries.find(
      (e) => e.address.trim().toLowerCase() === address.trim().toLowerCase(),
    );
    if (!alias) {
      if (existing) deleteEntry(existing.id);
      return;
    }
    if (existing) {
      updateEntry(existing.id, {
        name: alias,
        address: existing.address,
        note: existing.note,
      });
    } else {
      addEntry({ address, name: alias });
    }
  };

  const handleExternalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = externalInput.trim();
    if (!COLLECTION_RE.test(clean)) {
      setExternalError(labels.selector.invalidAddress);
      return;
    }
    setExternalError('');
    setExternalTarget(clean);
  };

  const filteredRecords =
    audit && audit.found
      ? filterAuditRecords(audit.records, effectiveFilters, aliasOf)
      : [];
  const kpis = computeAuditKpis(filteredRecords);

  const hasFilters = hasActiveAuditFilters(effectiveFilters);
  const filteredSigners =
    audit && audit.found
      ? filterAuditSigners(audit.signers, filteredRecords, effectiveFilters)
      : [];

  const shareUrl = () => {
    if (typeof window === 'undefined' || !targetCollection) return '';
    return buildAuditShareUrl({
      origin: window.location.origin,
      pathname: window.location.pathname,
      collection: targetCollection,
      fromDate: effectiveFilters.fromDate || undefined,
      toDate: effectiveFilters.toDate || undefined,
    });
  };

  const handleCopyShareLink = async () => {
    const url = shareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* noop */
    }
  };

  const handleExport = async (format: AuditExportFormat) => {
    if (!audit || !audit.found) return;
    setExporting(format);
    const shortId = audit.collection.slice(-8);
    const netTag =
      audit.networkId === RadixNetworkId.Stokenet ? 'stokenet' : 'mainnet';
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

  return (
    <div className="space-y-6">
      {/* Intro & source selector (Institution vs External Auditor) */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text-main)' }}>
              {labels.intro.title}.
            </strong>{' '}
            {labels.intro.body}
          </p>

          {isConnected && (
            <div
              className="inline-flex shrink-0 rounded-xl border p-0.5 text-xs"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setMode('owned')}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-colors"
                style={{
                  background:
                    effectiveMode === 'owned' ? 'var(--color-card-bg)' : 'transparent',
                  color:
                    effectiveMode === 'owned'
                      ? 'var(--color-text-main)'
                      : 'var(--color-text-muted)',
                }}
              >
                <Building2 className="size-3.5" />
                {labels.selector.myCollections}
              </button>
              <button
                type="button"
                onClick={() => setMode('external')}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-colors"
                style={{
                  background:
                    effectiveMode === 'external' ? 'var(--color-card-bg)' : 'transparent',
                  color:
                    effectiveMode === 'external'
                      ? 'var(--color-text-main)'
                      : 'var(--color-text-muted)',
                }}
              >
                <FileSearch className="size-3.5" />
                {labels.selector.externalMode}
              </button>
            </div>
          )}
        </div>

        {/* Source bar */}
        {effectiveMode === 'owned' ? (
          networkOwnedCollections.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {networkOwnedCollections.map((c) => {
                const isSelected = c.resourceAddress === targetCollection;
                return (
                  <button
                    key={c.resourceAddress}
                    type="button"
                    onClick={() => setSelectedOwned(c.resourceAddress)}
                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      background: isSelected
                        ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                        : 'var(--color-surface)',
                      borderColor: isSelected
                        ? 'var(--color-primary)'
                        : 'var(--color-card-border)',
                      color: isSelected
                        ? 'var(--color-primary)'
                        : 'var(--color-text-main)',
                    }}
                  >
                    <span>{c.name || truncateAddress(c.resourceAddress, 8, 6)}</span>
                    <span
                      className="font-mono text-[10px] tabular-nums"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      ({c.totalSupply})
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p
              className="rounded-xl border px-4 py-3 text-xs leading-relaxed"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {labels.selector.noOwnedCollections}
            </p>
          )
        ) : (
          <form onSubmit={handleExternalSubmit} className="space-y-2">
            {!isConnected && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {labels.selector.connectTip}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={externalInput}
                onChange={(e) => {
                  setExternalInput(e.target.value);
                  setExternalError('');
                }}
                placeholder={labels.selector.externalPlaceholder}
                className="h-10 flex-1 rounded-xl border px-3 font-mono text-xs outline-none focus:border-[var(--color-primary)]"
                style={{
                  background: 'var(--color-card-bg)',
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow-sm transition-opacity hover:opacity-90"
              >
                <FileSearch className="size-3.5" />
                {labels.selector.externalLoad}
              </button>
            </div>
            {externalError ? (
              <p className="text-xs font-medium" style={{ color: 'var(--color-danger)' }}>
                {externalError}
              </p>
            ) : (
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {labels.selector.externalHint}
              </p>
            )}
          </form>
        )}
      </div>

      {/* Loading / Error / Not Found States */}
      {loading && targetCollection && (
        <div
          className="flex items-center gap-2.5 border-t py-10 text-sm"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          <RefreshCw className="size-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
          <span>{labels.states.loading}</span>
        </div>
      )}

      {!loading && error && (
        <div
          className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs"
          style={{
            borderColor: 'var(--color-danger)',
            background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>{labels.states.error.replace('{message}', error)}</span>
        </div>
      )}

      {!loading && audit && !audit.found && (
        <div
          className="rounded-xl border px-4 py-4 space-y-1 text-xs"
          style={{
            borderColor: 'var(--color-warning)',
            background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
          }}
        >
          <p className="font-bold" style={{ color: 'var(--color-text-main)' }}>
            {labels.states.notFound}
          </p>
          <p style={{ color: 'var(--color-text-muted)' }}>{labels.states.notFoundHint}</p>
        </div>
      )}

      {/* Main audited collection workspace */}
      {!loading && audit && audit.found && (
        <div className="space-y-5">
          <AuditHeader
            audit={audit}
            labels={labels}
            locale={language}
            fetching={fetching}
            exporting={exporting}
            includeAliases={includeAliases}
            onToggleIncludeAliases={setIncludeAliases}
            onRefresh={() => void refresh()}
            onCopyShareLink={handleCopyShareLink}
            onExport={handleExport}
          />

          <AuditKpiStrip
            kpis={kpis}
            labels={labels}
            onSelectAnomalies={() => {
              setSubTab('records');
              setFilters({ ...effectiveFilters, status: 'anomaly' });
            }}
          />

          {audit.totalSupply === 0 ? (
            <div
              className="border-t py-8 space-y-1 text-center"
              style={{ borderColor: 'var(--color-card-border)' }}
            >
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                {labels.states.emptyCollection}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {labels.states.emptyCollectionHint}
              </p>
            </div>
          ) : (
            <>
              <AuditFilterBar
                filters={effectiveFilters}
                onChange={setFilters}
                labels={labels}
                signerAlias={
                  effectiveFilters.signerFilter
                    ? aliasOf(effectiveFilters.signerFilter)
                    : undefined
                }
              />

              {/* Sub-tabs: Records Registry vs Signers Directory */}
              <div
                className="flex gap-6 border-b"
                style={{ borderColor: 'var(--color-card-border)' }}
              >
                {(
                  [
                    ['records', `${labels.subtabs.records} (${filteredRecords.length})`],
                    ['signers', `${labels.subtabs.signers} (${filteredSigners.length})`],
                  ] as const
                ).map(([key, text]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSubTab(key)}
                    className="relative pb-2.5 text-xs font-bold transition-colors sm:text-sm"
                    style={{
                      color:
                        subTab === key
                          ? 'var(--color-text-main)'
                          : 'var(--color-text-muted)',
                    }}
                  >
                    {text}
                    {subTab === key && (
                      <span
                        className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                        style={{
                          background:
                            'linear-gradient(to right, var(--color-accent), var(--color-primary))',
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {subTab === 'records' ? (
                <AuditRecordsTable
                  records={filteredRecords}
                  totalInCollection={audit.totalSupply}
                  scannedFromId={audit.scannedFromId}
                  scannedToId={audit.scannedToId}
                  hasMoreOlder={audit.hasMoreOlder}
                  loadingOlder={loadingOlder}
                  hasFilters={hasFilters}
                  networkId={audit.networkId}
                  locale={language}
                  labels={labels}
                  aliasOf={aliasOf}
                  onLoadOlder={() => void loadOlder()}
                />
              ) : (
                <AuditSignersDirectory
                  signers={filteredSigners}
                  networkId={audit.networkId}
                  locale={language}
                  labels={labels}
                  entries={entries}
                  onSaveAlias={handleSaveAlias}
                  onFilterBySigner={(account) => {
                    setFilters({ ...filters, signerFilter: account });
                    setSubTab('records');
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
