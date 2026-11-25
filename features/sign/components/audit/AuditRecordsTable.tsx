'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  ExternalLink,
  FileSignature,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SaveToAddressBookButton } from '@/features/wallet/components/SaveToAddressBookButton';
import { truncateAddress } from '@/utils/formatters';
import type { AuditRecord } from '../../lib/collection-audit';
import {
  auditKindLabel,
  auditStatusLabel,
  entityExplorerHref,
  formatUtcTimestamp,
  txExplorerHref,
  verifierHref,
  type AuditLabels,
} from './AuditFormatters';

function StatusBadge({
  status,
  labels,
  progress,
}: {
  status: AuditRecord['status'];
  labels: AuditLabels;
  progress?: string;
}) {
  const text = progress
    ? `${auditStatusLabel(labels, status)} · ${progress}`
    : auditStatusLabel(labels, status);

  const color =
    status === 'complete' || status === 'recorded'
      ? 'var(--color-success)'
      : status === 'anomaly'
        ? 'var(--color-danger)'
        : 'var(--color-warning)';

  const Icon =
    status === 'complete' || status === 'recorded'
      ? CheckCircle2
      : status === 'anomaly'
        ? AlertTriangle
        : Clock;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
      }}
    >
      <Icon className="size-3 shrink-0" />
      <span>{text}</span>
    </span>
  );
}

function KindIcon({ kind }: { kind: AuditRecord['kind'] }) {
  if (kind.startsWith('cipher')) {
    return <Lock className="size-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />;
  }
  return <FileSignature className="size-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />;
}

/**
 * Clean hairline audit registry table (desktop) with responsive stacked rows
 * (mobile) and inline expandable per-signer verification details.
 */
export function AuditRecordsTable({
  records,
  totalInCollection,
  scannedFromId,
  scannedToId,
  hasMoreOlder,
  loadingOlder,
  hasFilters,
  networkId,
  locale,
  labels,
  aliasOf,
  onLoadOlder,
}: {
  records: AuditRecord[];
  totalInCollection: number;
  scannedFromId: number;
  scannedToId: number;
  hasMoreOlder: boolean;
  loadingOlder: boolean;
  hasFilters: boolean;
  networkId: number;
  locale: string;
  labels: AuditLabels;
  aliasOf: (account: string) => string | undefined;
  onLoadOlder: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (records.length === 0) {
    return (
      <div
        className="border-t py-10 text-center text-sm"
        style={{
          borderColor: 'var(--color-card-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        {hasFilters ? labels.records.emptyFiltered : labels.records.empty}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop hairline table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="border-y text-left text-[10px] font-bold uppercase tracking-wider"
              style={{
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              <th className="py-2.5 pr-3">{labels.records.columns.date}</th>
              <th className="py-2.5 px-3">{labels.records.columns.type}</th>
              <th className="py-2.5 px-3">{labels.records.columns.document}</th>
              <th className="py-2.5 px-3">{labels.records.columns.compliance}</th>
              <th className="py-2.5 px-3">{labels.records.columns.tx}</th>
              <th className="py-2.5 pl-3 text-right">{labels.records.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
            {records.map((rec) => {
              const isOpen = expanded.has(rec.id);
              const ts = formatUtcTimestamp(rec.committedAt, locale);
              const progress =
                rec.kind === 'multi_request'
                  ? labels.records.progress
                      .replace('{signed}', String(rec.signedCount))
                      .replace('{total}', String(rec.totalSigners))
                  : undefined;

              return (
                <RecordRowGroup
                  key={rec.id}
                  rec={rec}
                  isOpen={isOpen}
                  ts={ts}
                  progress={progress}
                  networkId={networkId}
                  locale={locale}
                  labels={labels}
                  aliasOf={aliasOf}
                  onToggle={() => toggle(rec.id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked hairline list (360px–767px, zero horizontal scroll) */}
      <div className="divide-y border-y md:hidden" style={{ borderColor: 'var(--color-card-border)' }}>
        {records.map((rec) => {
          const isOpen = expanded.has(rec.id);
          const ts = formatUtcTimestamp(rec.committedAt, locale);
          const progress =
            rec.kind === 'multi_request'
              ? labels.records.progress
                  .replace('{signed}', String(rec.signedCount))
                  .replace('{total}', String(rec.totalSigners))
              : undefined;

          return (
            <div key={rec.id} className="py-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                    <KindIcon kind={rec.kind} />
                    <span>{auditKindLabel(labels, rec.kind)}</span>
                  </div>
                  <p className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {ts.utc}
                  </p>
                </div>
                <StatusBadge status={rec.status} labels={labels} progress={progress} />
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-mono" style={{ color: 'var(--color-text-main)' }}>
                  {truncateAddress(rec.docHash, 10, 8)}
                  <CopyButton value={rec.docHash} variant="card-inline" size="xs" />
                </span>
                <button
                  type="button"
                  onClick={() => toggle(rec.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <span>{labels.records.columns.actions}</span>
                  <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isOpen && (
                <RecordExpandedDetails
                  rec={rec}
                  networkId={networkId}
                  locale={locale}
                  labels={labels}
                  aliasOf={aliasOf}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination & range footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
        <span className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          {totalInCollection > 0
            ? labels.records.showingRange
                .replace('{from}', String(scannedFromId))
                .replace('{to}', String(scannedToId))
                .replace('{total}', String(totalInCollection))
            : ''}
        </span>

        {hasMoreOlder && (
          <button
            type="button"
            disabled={loadingOlder}
            onClick={onLoadOlder}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] disabled:opacity-50"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          >
            {loadingOlder ? labels.records.loadingOlder : labels.records.loadOlder}
          </button>
        )}
      </div>
    </div>
  );
}

function RecordRowGroup({
  rec,
  isOpen,
  ts,
  progress,
  networkId,
  locale,
  labels,
  aliasOf,
  onToggle,
}: {
  rec: AuditRecord;
  isOpen: boolean;
  ts: { utc: string; local: string };
  progress?: string;
  networkId: number;
  locale: string;
  labels: AuditLabels;
  aliasOf: (account: string) => string | undefined;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="transition-colors hover:bg-[var(--color-surface)]/70 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-3 pr-3 align-top">
          <div className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
            {ts.utc}
          </div>
          <div className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {ts.local}
          </div>
        </td>
        <td className="py-3 px-3 align-top">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
            <KindIcon kind={rec.kind} />
            {auditKindLabel(labels, rec.kind)}
          </span>
        </td>
        <td className="py-3 px-3 align-top" onClick={(e) => e.stopPropagation()}>
          <span className="inline-flex items-center gap-1 font-mono text-xs" style={{ color: 'var(--color-text-main)' }}>
            {truncateAddress(rec.docHash, 10, 8)}
            <CopyButton value={rec.docHash} variant="card-inline" size="xs" />
          </span>
        </td>
        <td className="py-3 px-3 align-top">
          <StatusBadge status={rec.status} labels={labels} progress={progress} />
        </td>
        <td className="py-3 px-3 align-top" onClick={(e) => e.stopPropagation()}>
          {rec.txId ? (
            <a
              href={txExplorerHref(locale, rec.txId, networkId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              {truncateAddress(rec.txId, 8, 6)}
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              —
            </span>
          )}
        </td>
        <td className="py-3 pl-3 align-top text-right">
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors hover:bg-[var(--color-surface)]"
            style={{ color: 'var(--color-primary)' }}
          >
            <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={6} className="pb-4 pt-1">
            <RecordExpandedDetails
              rec={rec}
              networkId={networkId}
              locale={locale}
              labels={labels}
              aliasOf={aliasOf}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function RecordExpandedDetails({
  rec,
  networkId,
  locale,
  labels,
  aliasOf,
}: {
  rec: AuditRecord;
  networkId: number;
  locale: string;
  labels: AuditLabels;
  aliasOf: (account: string) => string | undefined;
}) {
  return (
    <div
      className="rounded-xl border p-4 space-y-3.5 text-xs"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      {/* Anomaly notices */}
      {rec.anomalies.length > 0 && (
        <div
          className="rounded-lg border px-3 py-2 space-y-1"
          style={{
            borderColor: 'var(--color-danger)',
            background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          {rec.anomalies.map((code) => (
            <p key={code} className="flex items-start gap-1.5 font-semibold">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{labels.records.anomalies[code]}</span>
            </p>
          ))}
        </div>
      )}

      {/* Technical metadata row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5" style={{ color: 'var(--color-text-muted)' }}>
          {rec.requestKey && (
            <span className="inline-flex items-center gap-1.5">
              <span>{labels.records.requestKeyLabel}:</span>
              <code className="font-mono" style={{ color: 'var(--color-text-main)' }}>
                {truncateAddress(rec.requestKey, 12, 8)}
              </code>
              <CopyButton value={rec.requestKey} variant="card-inline" size="xs" />
            </span>
          )}
          <span>
            {labels.records.nftIdsLabel}:{' '}
            <code className="font-mono" style={{ color: 'var(--color-text-main)' }}>
              {rec.nftIds.join(', ')}
            </code>
          </span>
          {rec.clockAgrees !== null && (
            <span
              className="inline-flex items-center gap-1 font-medium"
              style={{
                color: rec.clockAgrees ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              <ShieldCheck className="size-3.5" />
              {rec.clockAgrees ? labels.records.clockOk : labels.records.clockWarn}
            </span>
          )}
        </div>

        {rec.requestKey && rec.kind === 'multi_request' && (
          <a
            href={verifierHref(locale, rec.requestKey)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors hover:border-[var(--color-primary)]"
            style={{
              background: 'var(--color-card-bg)',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-primary)',
            }}
          >
            <BadgeCheck className="size-3.5" />
            {labels.records.openVerifier}
          </a>
        )}
      </div>

      {/* Per-signer breakdown */}
      {rec.signers.length > 0 && (
        <div className="divide-y border-t" style={{ borderColor: 'var(--color-card-border)' }}>
          {rec.signers.map((s) => {
            const alias = aliasOf(s.account);
            const sigTs = formatUtcTimestamp(s.signedAt, locale);
            return (
              <div
                key={`${rec.id}:${s.account}:${s.index}`}
                className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.signed ? (
                      <CheckCircle2
                        className="size-3.5 shrink-0"
                        style={{ color: 'var(--color-success)' }}
                      />
                    ) : (
                      <Circle
                        className="size-3.5 shrink-0"
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    )}
                    {alias && (
                      <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>
                        {alias}
                      </span>
                    )}
                    <code
                      className="font-mono text-[11px] break-all"
                      style={{ color: alias ? 'var(--color-text-muted)' : 'var(--color-text-main)' }}
                    >
                      {s.account}
                    </code>
                    <CopyButton value={s.account} variant="card-inline" size="xs" />
                    <SaveToAddressBookButton
                      address={s.account}
                      saveLabel={labels.signers.saveToBook}
                      savedLabel={labels.signers.savedInBook}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pl-5 sm:pl-0 shrink-0">
                  {s.signed ? (
                    <>
                      <span
                        className="text-[11px] font-semibold tabular-nums"
                        style={{ color: 'var(--color-success)' }}
                      >
                        {labels.records.signedOn} · {sigTs.utc}
                      </span>
                      {s.txId && (
                        <a
                          href={txExplorerHref(locale, s.txId, networkId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold hover:underline"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {labels.records.viewTx}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                      {s.nftGlobalId && (
                        <a
                          href={entityExplorerHref(
                            locale,
                            s.nftGlobalId.split(':')[0],
                            networkId,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold hover:underline"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {labels.records.viewNft}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] font-medium" style={{ color: 'var(--color-warning)' }}>
                      {labels.records.pendingSigners}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
