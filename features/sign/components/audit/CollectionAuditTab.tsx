'use client';

import { useState } from 'react';
import {
  Building2,
  ExternalLink,
  FileSearch,
  FlaskConical,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { useLanguage } from '@/context/LanguageContext';
import { downloadTextFile } from '@/features/console/lib/file-utils';
import { networkOfAddress } from '@/features/dashboard/lib/routes';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useAddressBook } from '@/features/wallet/hooks/useAddressBook';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { SEAL_IMAGE_PATH } from '../../constants/seal';
import { useCollectionAudit } from '../../hooks/useCollectionAudit';
import { useDomainVerification } from '../../hooks/useDomainVerification';
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
import {
  RADIX_RESOURCE_RE,
  networkIdFromResource,
  networkNameForId,
} from '../../lib/network';
import type { UserSignCollection } from '../../services/sealDiscovery';
import { DomainVerificationDrawer } from '../collection/DomainVerificationDrawer';
import {
  buildAuditShareUrl,
  entityExplorerHref,
  explorerNetworkForId,
  formatUtcTimestamp,
  type AuditLabels,
  type DomainVerifyLabels,
} from './AuditFormatters';
import { AuditFilterBar } from './AuditFilterBar';
import { AuditHeader, type AuditExportFormat } from './AuditHeader';
import { AuditIntegrityTab } from './AuditIntegrityTab';
import { AuditKpiStrip } from './AuditKpiStrip';
import { AuditRecordsTable } from './AuditRecordsTable';
import { AuditSignersDirectory } from './AuditSignersDirectory';

type SubTab = 'records' | 'signers' | 'overview' | 'integrity' | 'external';
type SourceMode = 'owned' | 'external';

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
  domainVerifyLabels,
  isConnected,
  ownedCollections,
  activeCollection,
  initialCollection,
  initialFromDate,
  initialToDate,
}: {
  labels: AuditLabels;
  domainVerifyLabels: DomainVerifyLabels;
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
    initialCollection && RADIX_RESOURCE_RE.test(initialCollection.trim())
      ? initialCollection.trim()
      : '';

  const [mode, setMode] = useState<SourceMode>(
    initialExternal || !isConnected ? 'external' : 'owned',
  );
  const [selectedOwned, setSelectedOwned] = useState<string | null>(null);
  const [externalInput, setExternalInput] = useState(initialExternal);
  const [externalTarget, setExternalTarget] = useState(initialExternal);
  const [externalError, setExternalError] = useState('');

  const [subTab, setSubTab] = useState<SubTab>(
    !isConnected && !initialExternal ? 'external' : 'records',
  );
  const [filters, setFilters] = useState<AuditFilterState>({
    ...DEFAULT_AUDIT_FILTERS,
    fromDate: initialFromDate ?? '',
    toDate: initialToDate ?? '',
  });
  const [includeAliases, setIncludeAliases] = useState(false);
  const [exporting, setExporting] = useState<AuditExportFormat | null>(null);
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);

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
    error,
    loadingOlder,
    loadOlder,
  } = useCollectionAudit(targetNetworkId, targetCollection);

  const liveDomain = useDomainVerification({
    orgUrl: audit?.found ? audit.issuer.orgUrl : null,
    collection: audit?.found ? audit.collection : null,
    account: audit?.found ? audit.issuer.account : null,
    initialData: audit?.found ? audit.issuer.domainVerification : null,
  });
  const effectiveDomainVerification =
    liveDomain.result ??
    (audit?.found ? (audit.issuer.domainVerification ?? null) : null);

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
    if (!RADIX_RESOURCE_RE.test(clean)) {
      setExternalError(labels.selector.invalidAddress);
      return;
    }
    setExternalError('');
    setMode('external');
    setExternalTarget(clean);
    setSubTab('records');
  };

  const filteredRecords =
    audit && audit.found
      ? filterAuditRecords(audit.records, effectiveFilters, aliasOf)
      : [];
  const kpis = computeAuditKpis(filteredRecords);

  const highlightedDays = new Set<string>();
  if (audit && audit.found) {
    for (const r of audit.records) {
      const iso = r.committedAt ?? r.issuedAt;
      if (iso && iso.length >= 10) highlightedDays.add(iso.slice(0, 10));
    }
  }

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

  const externalAuditorForm = (
    <form onSubmit={handleExternalSubmit} className="space-y-3 py-1">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={externalInput}
          onChange={(e) => {
            setExternalInput(e.target.value);
            setExternalError('');
          }}
          placeholder={labels.selector.externalPlaceholder}
          className="h-9 flex-1 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-3 font-mono text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)]"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow-sm transition-opacity hover:opacity-90"
        >
          <FileSearch className="size-3.5" />
          {labels.selector.externalLoad}
        </button>
      </div>
      {externalError ? (
        <p className="text-xs font-medium text-[var(--color-danger)]">
          {externalError}
        </p>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          {!isConnected ? labels.selector.connectTip : labels.selector.externalHint}
        </p>
      )}
      {isConnected && effectiveMode === 'external' && networkOwnedCollections.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setMode('owned');
            setSubTab('records');
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          <Building2 className="size-3.5" />
          {labels.selector.myCollections}
        </button>
      )}
    </form>
  );

  return (
    <div className="space-y-5">
      {/* Loading / Error / Not Found States */}
      {loading && targetCollection && (
        <div className="flex items-center gap-2.5 border-t border-[var(--color-card-border)] py-10 text-sm text-[var(--color-text-muted)]">
          <RefreshCw className="size-4 animate-spin text-[var(--color-primary)]" />
          <span>{labels.states.loading}</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2.5 border-l-2 border-[var(--color-danger)] pl-3 py-1 text-xs text-[var(--color-danger)]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>{labels.states.error.replace('{message}', error)}</span>
        </div>
      )}

      {!loading && audit && !audit.found && (
        <div className="space-y-4">
          <div className="border-l-2 border-[var(--color-warning)] pl-3 py-1 space-y-1 text-xs">
            <p className="font-bold text-[var(--color-text-main)]">
              {labels.states.notFound}
            </p>
            <p className="text-[var(--color-text-muted)]">{labels.states.notFoundHint}</p>
          </div>
          {externalAuditorForm}
        </div>
      )}

      {/* No collection loaded yet (disconnected or account without collections) */}
      {!loading && !targetCollection && (
        <div className="space-y-3">
          {isConnected && networkOwnedCollections.length === 0 && (
            <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
              {labels.selector.noOwnedCollections}
            </p>
          )}
          {externalAuditorForm}
        </div>
      )}

      {/* Main audited collection workspace */}
      {!loading && audit && audit.found && (
        <div className="space-y-5">
          <AuditHeader
            audit={audit}
            labels={labels}
            domainVerifyLabels={domainVerifyLabels}
            domainVerification={effectiveDomainVerification}
            domainChecking={liveDomain.checking}
            onOpenDomainDrawer={() => setDomainDrawerOpen(true)}
            locale={language}
            exporting={exporting}
            includeAliases={includeAliases}
            ownedCollections={networkOwnedCollections}
            onSelectCollection={(addr) => {
              setMode('owned');
              setSelectedOwned(addr);
              setSubTab((prev) => (prev === 'external' ? 'records' : prev));
            }}
            onToggleIncludeAliases={setIncludeAliases}
            onCopyShareLink={handleCopyShareLink}
            onExport={handleExport}
          />

          {/* 5-tab segmentation: Records | Signers & NFTs | Overview | Integrity & Privacy | External Auditor */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--color-card-border)]">
            {(
              [
                ['records', `${labels.subtabs.records} (${filteredRecords.length})`],
                ['signers', `${labels.subtabs.signers} (${filteredSigners.length})`],
                ['overview', labels.subtabs.overview],
                ['integrity', labels.subtabs.integrity],
                ['external', labels.selector.externalMode],
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

          {subTab === 'records' && (
            audit.totalSupply === 0 ? (
              <div className="py-8 space-y-1 text-center">
                <p className="text-sm font-bold text-[var(--color-text-main)]">
                  {labels.states.emptyCollection}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {labels.states.emptyCollectionHint}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AuditFilterBar
                  filters={effectiveFilters}
                  onChange={setFilters}
                  labels={labels}
                  signerAlias={
                    effectiveFilters.signerFilter
                      ? aliasOf(effectiveFilters.signerFilter)
                      : undefined
                  }
                  highlightedDays={highlightedDays}
                />

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
              </div>
            )
          )}

          {subTab === 'signers' && (
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

          {subTab === 'overview' && (
            <div className="space-y-5">
              {audit.networkId === RadixNetworkId.Stokenet && (
                <div className="flex items-start gap-2.5 border-l-2 border-[var(--color-warning)] pl-3 py-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  <FlaskConical className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
                  <span>{labels.network.stokenetNotice}</span>
                </div>
              )}

              <AuditKpiStrip
                kpis={kpis}
                labels={labels}
                onSelectAnomalies={() => {
                  setSubTab('records');
                  setFilters({ ...effectiveFilters, status: 'anomaly' });
                }}
              />

              <dl className="border-y border-[var(--color-card-border)] divide-y divide-[var(--color-card-border)] text-xs">
                {audit.issuer.account && (
                  <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--color-text-muted)]" title={labels.tooltips.issuerAccount}>
                      {labels.header.issuerLabel}
                    </dt>
                    <dd className="inline-flex items-center gap-1.5 font-mono">
                      <a
                        href={entityExplorerHref(language, audit.issuer.account, audit.networkId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={audit.issuer.account}
                        className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                      >
                        {truncateAddress(audit.issuer.account, 10, 6)}
                        <ExternalLink className="size-3" />
                      </a>
                      <CopyButton value={audit.issuer.account} variant="minimal" size="xs" />
                    </dd>
                  </div>
                )}

                {audit.issuer.orgUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <dt className="text-[var(--color-text-muted)]">Web</dt>
                    <dd>
                      <a
                        href={audit.issuer.orgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {audit.issuer.orgUrl}
                        <ExternalLink className="size-3" />
                      </a>
                    </dd>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <dt className="text-[var(--color-text-muted)]" title={labels.tooltips.ledgerCutoff}>
                    {labels.header.ledgerCutoff}
                  </dt>
                  <dd className="tabular-nums text-[var(--color-text-main)]">
                    <strong>
                      {audit.ledgerStateVersion != null
                        ? `#${audit.ledgerStateVersion.toLocaleString(language)}`
                        : '-'}
                    </strong>{' '}
                    · {formatUtcTimestamp(audit.ledgerTimestamp, language).utc}
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                <strong className="text-[var(--color-text-main)]">{labels.intro.title}.</strong>{' '}
                {labels.intro.body}
              </p>
            </div>
          )}

          {subTab === 'integrity' && (
            <AuditIntegrityTab
              audit={audit}
              locale={language}
              labels={labels}
              domainVerifyLabels={domainVerifyLabels}
              domainVerification={effectiveDomainVerification}
              domainChecking={liveDomain.checking}
              onOpenDomainDrawer={() => setDomainDrawerOpen(true)}
            />
          )}

          {subTab === 'external' && externalAuditorForm}

          <DomainVerificationDrawer
            isOpen={domainDrawerOpen}
            onClose={() => setDomainDrawerOpen(false)}
            labels={domainVerifyLabels}
            collection={audit.collection}
            domain={liveDomain.domain}
            result={effectiveDomainVerification}
            checking={liveDomain.checking}
            error={liveDomain.error}
            onCheckNow={() => void liveDomain.refetch()}
          />
        </div>
      )}
    </div>
  );
}
