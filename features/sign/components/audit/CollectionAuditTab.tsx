'use client';

import { useState } from 'react';
import {
  Building2,
  FileSearch,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { networkOfAddress } from '@/features/dashboard/lib/routes';
import { useAddressBook } from '@/features/wallet/hooks/useAddressBook';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useAuditExport } from '../../hooks/useAuditExport';
import { useCollectionAudit } from '../../hooks/useCollectionAudit';
import { useDomainVerification } from '../../hooks/useDomainVerification';
import {
  DEFAULT_AUDIT_FILTERS,
  computeAuditKpis,
  filterAuditRecords,
  filterAuditSigners,
  hasActiveAuditFilters,
  type AuditFilterState,
} from '../../lib/collection-audit';
import {
  RADIX_RESOURCE_RE,
  networkIdFromResource,
} from '../../lib/network';
import type { UserSignCollection } from '../../services/sealDiscovery';
import { DomainVerificationDrawer } from '../collection/DomainVerificationDrawer';
import {
  buildAuditShareUrl,
  explorerNetworkForId,
  type AuditLabels,
  type DomainVerifyLabels,
} from './AuditFormatters';
import { AuditFilterBar } from './AuditFilterBar';
import { AuditHeader } from './AuditHeader';
import { AuditIntegrityTab } from './AuditIntegrityTab';
import { AuditOverviewTab } from './AuditOverviewTab';
import { AuditRecordsTable } from './AuditRecordsTable';
import { AuditSignersDirectory } from './AuditSignersDirectory';

type SubTab = 'records' | 'signers' | 'overview' | 'integrity' | 'external';
type SourceMode = 'owned' | 'external';

/**
 * Audit & Registry workspace for Radix Seal signing collections.
 * Supports wallet-connected multi-collection mode and wallet-free external
 * read-only auditing across Mainnet and Stokenet.
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
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);

  const effectiveMode: SourceMode =
    !isConnected && mode === 'owned' ? 'external' : mode;

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
      ? (validOwnedSelection ??
        validActiveOwned ??
        networkOwnedCollections[0]?.resourceAddress ??
        null)
      : externalTarget || null;

  const targetNetworkId = targetCollection
    ? networkIdFromResource(targetCollection)
    : null;

  const expectedNet =
    targetNetworkId != null ? explorerNetworkForId(targetNetworkId) : undefined;
  const signerMatchesLedger =
    !filters.signerFilter ||
    !expectedNet ||
    networkOfAddress(filters.signerFilter) === expectedNet;
  const effectiveFilters: AuditFilterState = signerMatchesLedger
    ? filters
    : { ...filters, signerFilter: '' };

  const { audit, loading, error, loadingOlder, loadOlder } = useCollectionAudit(
    targetNetworkId,
    targetCollection,
  );

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

  const { exporting, handleExport } = useAuditExport({
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
  });

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
          {!isConnected
            ? labels.selector.connectTip
            : labels.selector.externalHint}
        </p>
      )}
      {isConnected &&
        effectiveMode === 'external' &&
        networkOwnedCollections.length > 0 && (
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
            <p className="text-[var(--color-text-muted)]">
              {labels.states.notFoundHint}
            </p>
          </div>
          {externalAuditorForm}
        </div>
      )}

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

          {subTab === 'records' &&
            (audit.totalSupply === 0 ? (
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
            ))}

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
            <AuditOverviewTab
              audit={audit}
              kpis={kpis}
              labels={labels}
              locale={language}
              onSelectAnomalies={() => {
                setSubTab('records');
                setFilters({ ...effectiveFilters, status: 'anomaly' });
              }}
            />
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
