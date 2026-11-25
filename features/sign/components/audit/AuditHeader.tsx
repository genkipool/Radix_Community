'use client';

import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Link2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { truncateAddress } from '@/utils/formatters';
import {
  entityExplorerHref,
  formatUtcTimestamp,
  type AuditExportFormat,
  type AuditHeaderProps,
} from './AuditFormatters';

export type { AuditExportFormat };

/**
 * Editorial header for the audited collection: identity, network distinction
 * (Mainnet vs Stokenet), cryptographic integrity strip, live ledger cutoff,
 * and report export menu with explicit GDPR alias opt-in.
 */
export function AuditHeader({
  audit,
  labels,
  locale,
  fetching,
  exporting,
  includeAliases,
  onToggleIncludeAliases,
  onRefresh,
  onCopyShareLink,
  onExport,
}: AuditHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const isTestnet = audit.networkId === RadixNetworkId.Stokenet;
  const displayName =
    audit.issuer.orgName || audit.issuer.name || audit.collection;
  const cutoff = formatUtcTimestamp(audit.ledgerTimestamp, locale);

  const integrityChecks = [
    {
      ok: audit.integrity.hasMarker && audit.integrity.officialBrand,
      label:
        audit.integrity.hasMarker && audit.integrity.officialBrand
          ? labels.integrity.standardOk
          : labels.integrity.standardWarn,
    },
    {
      ok: audit.integrity.ownerLocked && audit.integrity.issuerVerified,
      label:
        audit.integrity.ownerLocked && audit.integrity.issuerVerified
          ? labels.integrity.custodyOk
          : labels.integrity.custodyWarn,
    },
    {
      ok:
        audit.integrity.burnDenied &&
        audit.integrity.dataImmutable &&
        audit.integrity.totalBurned === 0,
      label:
        audit.integrity.burnDenied &&
        audit.integrity.dataImmutable &&
        audit.integrity.totalBurned === 0
          ? labels.integrity.immutableOk
          : labels.integrity.immutableWarn,
    },
  ];

  const handleShare = async () => {
    await onCopyShareLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="space-y-4 border-b pb-5" style={{ borderColor: 'var(--color-card-border)' }}>
      {/* Stokenet banner — prevents test demos from looking like production */}
      {isTestnet && (
        <div
          className="flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed"
          style={{
            borderColor: 'var(--color-warning)',
            background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            color: 'var(--color-text-main)',
          }}
        >
          <FlaskConical
            className="mt-0.5 size-4 shrink-0"
            style={{ color: 'var(--color-warning)' }}
          />
          <span>{labels.network.stokenetNotice}</span>
        </div>
      )}

      {/* Top row: identity + action controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <SafeImage
            src={audit.issuer.iconUrl ?? undefined}
            alt={displayName}
            fallbackName={displayName}
            className="size-12 shrink-0 rounded-xl border object-cover"
            style={{ borderColor: 'var(--color-card-border)' }}
          />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="truncate text-base font-bold sm:text-lg"
                style={{ color: 'var(--color-text-main)' }}
              >
                {displayName}
              </h2>
              {audit.issuer.symbol && (
                <span
                  className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-card-border)',
                  }}
                >
                  {audit.issuer.symbol}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{
                  background: isTestnet
                    ? 'color-mix(in srgb, var(--color-warning) 14%, transparent)'
                    : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                  color: isTestnet ? 'var(--color-warning)' : 'var(--color-primary)',
                }}
              >
                {isTestnet ? (
                  <FlaskConical className="size-3" />
                ) : (
                  <ShieldCheck className="size-3" />
                )}
                {isTestnet ? labels.network.stokenet : labels.network.mainnet}
              </span>
            </div>

            {audit.issuer.orgUrl && (
              <a
                href={audit.issuer.orgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                {audit.issuer.orgUrl}
                <ExternalLink className="size-3" />
              </a>
            )}

            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <span className="inline-flex items-center gap-1">
                <span>{labels.header.collectionLabel}:</span>
                <code className="font-mono" style={{ color: 'var(--color-text-main)' }}>
                  {truncateAddress(audit.collection, 10, 6)}
                </code>
                <CopyButton value={audit.collection} variant="card-inline" size="xs" />
                <a
                  href={entityExplorerHref(locale, audit.collection, audit.networkId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                  title={labels.header.explorerLink}
                >
                  <ExternalLink className="size-3" />
                </a>
              </span>

              {audit.issuer.account && (
                <span className="inline-flex items-center gap-1">
                  <span>{labels.header.issuerLabel}:</span>
                  <code className="font-mono" style={{ color: 'var(--color-text-main)' }}>
                    {truncateAddress(audit.issuer.account, 9, 5)}
                  </code>
                  <CopyButton value={audit.issuer.account} variant="card-inline" size="xs" />
                </span>
              )}

              <span className="tabular-nums">
                {labels.header.ledgerCutoff}:{' '}
                <strong style={{ color: 'var(--color-text-main)' }}>
                  {audit.ledgerStateVersion != null
                    ? `#${audit.ledgerStateVersion.toLocaleString(locale)}`
                    : '—'}
                </strong>{' '}
                · {cutoff.utc}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={fetching}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] disabled:opacity-50"
            style={{
              borderColor: 'var(--color-card-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-main)',
            }}
          >
            <RefreshCw className={`size-3.5 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? labels.header.refreshing : labels.header.refresh}
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)]"
            style={{
              borderColor: linkCopied ? 'var(--color-primary)' : 'var(--color-card-border)',
              background: 'var(--color-surface)',
              color: linkCopied ? 'var(--color-primary)' : 'var(--color-text-main)',
            }}
          >
            {linkCopied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {linkCopied ? labels.header.linkCopied : labels.header.copyLink}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={exporting !== null}
              aria-expanded={menuOpen}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Download className="size-3.5" />
              {labels.header.exportButton}
              <ChevronDown className="size-3.5" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border p-2 shadow-xl space-y-1"
                style={{
                  background: 'var(--color-card-bg)',
                  borderColor: 'var(--color-card-border)',
                }}
              >
                {(
                  [
                    ['pdf', labels.header.exportPdf, FileText],
                    ['csv-records', labels.header.exportCsvRecords, FileSpreadsheet],
                    ['csv-signers', labels.header.exportCsvSigners, FileSpreadsheet],
                    ['json', labels.header.exportJson, FileJson],
                  ] as const
                ).map(([fmt, text, Icon]) => (
                  <button
                    key={fmt}
                    type="button"
                    disabled={exporting !== null}
                    onClick={() => {
                      setMenuOpen(false);
                      void onExport(fmt);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-[var(--color-surface)]"
                    style={{ color: 'var(--color-text-main)' }}
                  >
                    <Icon className="size-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <span>{text}</span>
                  </button>
                ))}

                <div
                  className="mt-1 border-t pt-2 px-2 pb-1"
                  style={{ borderColor: 'var(--color-card-border)' }}
                >
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={includeAliases}
                      onChange={(e) => onToggleIncludeAliases(e.target.checked)}
                      className="mt-0.5 accent-[var(--color-primary)]"
                    />
                    <span>
                      <span
                        className="block font-semibold"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {labels.header.includeAliasesLabel}
                      </span>
                      <span
                        className="block text-[11px] leading-snug"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {labels.header.includeAliasesHint}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline 3-check cryptographic integrity strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs">
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {labels.integrity.title}:
        </span>
        {integrityChecks.map((chk) => (
          <span
            key={chk.label}
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{
              color: chk.ok ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {chk.ok ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : (
              <TriangleAlert className="size-3.5 shrink-0" />
            )}
            {chk.label}
          </span>
        ))}
        {audit.integrity.totalBurned > 0 && (
          <span
            className="text-[11px] font-medium"
            style={{ color: 'var(--color-warning)' }}
          >
            {labels.integrity.burnedNotice.replace(
              '{count}',
              String(audit.integrity.totalBurned),
            )}
          </span>
        )}
      </div>

      {/* Custom on-ledger institutional metadata (if declared) */}
      {audit.integrity.customMetadata.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
          <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {labels.header.customMetaTitle}:
          </span>
          {audit.integrity.customMetadata.map((m) => (
            <span
              key={m.key}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            >
              <span className="font-mono" style={{ color: 'var(--color-text-muted)' }}>
                {m.key}:
              </span>
              <span className="font-medium">{m.value || '—'}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
