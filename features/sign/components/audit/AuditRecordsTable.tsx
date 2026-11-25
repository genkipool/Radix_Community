'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileSignature,
  Lock,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import type { AuditRecord } from '../../lib/collection-audit';
import { splitNftGlobalId } from '../../lib/network';
import {
  auditKindLabel,
  auditStatusLabel,
  entityExplorerHref,
  formatUtcTimestamp,
  txExplorerHref,
  verifierHref,
  type AuditLabels,
} from './AuditFormatters';
import { PendingSignerSharePanel } from './PendingSignerSharePanel';

function StatusCell({
  status,
  labels,
}: {
  status: AuditRecord['status'];
  labels: AuditLabels;
}) {
  const text = auditStatusLabel(labels, status);

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
      className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-help"
      style={{ color }}
      title={labels.records.statusDescriptions[status]}
    >
      <Icon className="size-3.5 shrink-0" />
      <span>{text}</span>
    </span>
  );
}

function SignaturesCell({
  rec,
  labels,
}: {
  rec: AuditRecord;
  labels: AuditLabels;
}) {
  const desc = labels.records.signatureDescriptions;

  if (rec.kind === 'multi_request') {
    const pending = Math.max(0, rec.totalSigners - rec.signedCount);
    const isComplete = pending === 0;
    const text = isComplete
      ? labels.records.signedProgress
          .replace('{signed}', String(rec.signedCount))
          .replace('{total}', String(rec.totalSigners))
      : labels.records.pendingProgress
          .replace('{signed}', String(rec.signedCount))
          .replace('{total}', String(rec.totalSigners));

    const tooltip = isComplete
      ? desc.multiComplete
          .replace('{signed}', String(rec.signedCount))
          .replace('{total}', String(rec.totalSigners))
      : desc.multiPending
          .replace('{signed}', String(rec.signedCount))
          .replace('{total}', String(rec.totalSigners))
          .replace('{pending}', String(pending));

    return (
      <span
        className="text-xs font-semibold whitespace-nowrap tabular-nums cursor-help"
        style={{
          color: isComplete ? 'var(--color-success)' : 'var(--color-warning)',
        }}
        title={tooltip}
      >
        {text}
      </span>
    );
  }
  if (rec.kind === 'solo_signature' || rec.kind === 'cosign_signature') {
    return (
      <span
        className="text-xs font-semibold text-[var(--color-success)] whitespace-nowrap cursor-help"
        title={desc.solo}
      >
        {labels.records.signedOn}
      </span>
    );
  }
  if (rec.kind === 'cipher_invite') {
    return (
      <span
        className="text-xs font-medium text-[var(--color-primary)] whitespace-nowrap cursor-help"
        title={desc.authorized}
      >
        {labels.records.authorized}
      </span>
    );
  }
  return (
    <span
      className="text-xs text-[var(--color-text-muted)] whitespace-nowrap cursor-help"
      title={desc.cipherRecorded}
    >
      {labels.records.status.recorded}
    </span>
  );
}

function KindIcon({ kind }: { kind: AuditRecord['kind'] }) {
  if (kind.startsWith('cipher')) {
    return <Lock className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />;
  }
  return <FileSignature className="size-3.5 shrink-0 text-[var(--color-primary)]" />;
}

/**
 * Audit records table styled identically to the dashboard's transactions table:
 * flat surface header, theme hairlines, subtle hover accent, truncated hashes
 * with full `title` tooltips, and a structured sub-table drawer (zero left
 * borders, zero ambiguous checkmarks next to addresses).
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
      <div className="border-t border-[var(--color-card-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
        {hasFilters ? labels.records.emptyFiltered : labels.records.empty}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop dashboard-style table (table-fixed locks column widths so expanding never shifts rows) */}
      <div className="hidden md:block w-full">
        <table className="w-full table-fixed text-left border-collapse">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--color-card-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]/40">
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colDate}>
                {labels.records.columns.date}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colType}>
                {labels.records.columns.type}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colDocument}>
                {labels.records.columns.document}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colStatus}>
                {labels.records.columns.compliance}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colSignatures}>
                {labels.records.columns.signatures}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold text-right" title={labels.tooltips.colTx}>
                {labels.records.columns.tx}
              </th>
            </tr>
          </thead>
          {records.map((rec) => {
            const isOpen = expanded.has(rec.id);
            const ts = formatUtcTimestamp(rec.committedAt, locale);

            return (
              <tbody
                key={rec.id}
                className="border-b border-[var(--color-card-border)] transition-colors text-xs last:border-b-0"
              >
                <tr
                  className="cursor-pointer group transition-colors hover:bg-[var(--color-surface)]"
                  style={{
                    background:
                      'color-mix(in srgb, var(--color-surface) 75%, transparent)',
                  }}
                  onClick={() => toggle(rec.id)}
                >
                  <td
                    className="py-3 px-2.5 lg:px-3 text-[11px] text-[var(--color-text-main)] tabular-nums whitespace-nowrap"
                    title={`${ts.utc} (${ts.local})`}
                  >
                    {ts.utc}
                  </td>
                  <td
                    className="py-3 px-2.5 lg:px-3"
                    title={labels.records.kindDescriptions[rec.kind]}
                  >
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-text-main)]">
                      <KindIcon kind={rec.kind} />
                      <span>{auditKindLabel(labels, rec.kind)}</span>
                    </span>
                  </td>
                  <td className="py-3 px-2.5 lg:px-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-main)]">
                      <span title={rec.docHash}>{truncateAddress(rec.docHash, 6, 4)}</span>
                      <span onClick={(e) => e.stopPropagation()}>
                        <CopyButton value={rec.docHash} variant="minimal" size="xs" />
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-2.5 lg:px-3 whitespace-nowrap">
                    <StatusCell status={rec.status} labels={labels} />
                  </td>
                  <td className="py-3 px-2.5 lg:px-3">
                    <SignaturesCell rec={rec} labels={labels} />
                  </td>
                  <td className="py-3 px-2.5 lg:px-3 whitespace-nowrap text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {rec.txId ? (
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={txExplorerHref(locale, rec.txId, networkId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={rec.txId}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[11px] text-[var(--color-primary)] hover:underline"
                          >
                            {truncateAddress(rec.txId, 6, 4)}
                          </a>
                          <span onClick={(e) => e.stopPropagation()}>
                            <CopyButton value={rec.txId} variant="minimal" size="xs" />
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">-</span>
                      )}
                      <ChevronDown
                        className={`size-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${
                          isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
                        }`}
                      />
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={6} className="p-0">
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
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Mobile stacked list */}
      <div className="border-y border-[var(--color-card-border)] divide-y divide-[var(--color-card-border)] md:hidden">
        {records.map((rec) => {
          const isOpen = expanded.has(rec.id);
          const ts = formatUtcTimestamp(rec.committedAt, locale);

          return (
            <div key={rec.id} className="py-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-main)]">
                    <KindIcon kind={rec.kind} />
                    <span>{auditKindLabel(labels, rec.kind)}</span>
                  </div>
                  <p className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                    {ts.utc}
                  </p>
                </div>
                <StatusCell status={rec.status} labels={labels} />
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <SignaturesCell rec={rec} labels={labels} />
                <button
                  type="button"
                  onClick={() => toggle(rec.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]"
                >
                  <span title={rec.docHash} className="font-mono text-[var(--color-text-muted)]">
                    {truncateAddress(rec.docHash, 6, 4)}
                  </span>
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
        <span className="tabular-nums text-[var(--color-text-muted)]">
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
            className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
          >
            {loadingOlder ? labels.records.loadingOlder : labels.records.loadOlder}
          </button>
        )}
      </div>
    </div>
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
  const pendingCount = rec.signers.filter((s) => !s.signed).length;
  const showPendingPanel =
    rec.kind === 'multi_request' &&
    !!rec.requestKey &&
    (rec.status === 'pending' || rec.status === 'partial') &&
    pendingCount > 0;

  return (
    <div
      className="border-t border-[var(--color-card-border)] px-4 py-4 md:px-6 space-y-4 text-xs"
      style={{
        background: 'color-mix(in srgb, var(--color-bg) 60%, var(--color-card-bg))',
      }}
    >
      {/* Anomaly notices */}
      {rec.anomalies.length > 0 && (
        <div className="space-y-1 text-[var(--color-danger)]">
          {rec.anomalies.map((code) => (
            <p key={code} className="flex items-start gap-1.5 font-semibold">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{labels.records.anomalies[code]}</span>
            </p>
          ))}
        </div>
      )}

      {/* Structured technical metadata row: full width & vertically centered */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {rec.requestKey && (
          <div className="space-y-0.5">
            <span
              className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] cursor-help"
              title={labels.records.requestKeyTooltip}
            >
              {labels.records.requestKeyLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[var(--color-text-main)]" title={rec.requestKey}>
              {truncateAddress(rec.requestKey, 10, 6)}
              <CopyButton value={rec.requestKey} variant="minimal" size="xs" />
            </span>
          </div>
        )}

        <div className="space-y-0.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {labels.records.nftIdsLabel}
          </span>
          <code className="font-mono text-[var(--color-text-main)]">
            {rec.nftIds.join(', ')}
          </code>
        </div>

        {rec.clockAgrees !== null && (
          <div className="space-y-0.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {labels.records.columns.date}
            </span>
            <span
              className="font-semibold"
              style={{
                color: rec.clockAgrees ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {rec.clockAgrees ? labels.records.clockOk : labels.records.clockWarn}
            </span>
          </div>
        )}

        {rec.requestKey && rec.kind === 'multi_request' && (
          <a
            href={verifierHref(locale, rec.requestKey)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline shrink-0"
          >
            <BadgeCheck className="size-3.5" />
            {labels.records.openVerifier}
          </a>
        )}
      </div>

      {/* Aligned Signers sub-table (zero horizontal scroll) */}
      {rec.signers.length > 0 && (
        <div className="border-t border-[var(--color-card-border)]/70 pt-3 w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-card-border)]/70 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="py-2 pr-3 font-semibold">
                  {labels.signers.columns.participant}
                </th>
                <th className="py-2 px-2.5 font-semibold">
                  {labels.records.columns.compliance}
                </th>
                <th className="py-2 px-2.5 font-semibold">
                  {labels.signers.columns_nfts}
                </th>
                <th className="py-2 pl-2.5 font-semibold text-right">
                  {labels.records.columns.tx}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-card-border)]/50">
              {rec.signers.map((s) => {
                const alias = aliasOf(s.account);
                const sigTs = formatUtcTimestamp(s.signedAt, locale);
                return (
                  <tr key={`${rec.id}:${s.account}:${s.index}`}>
                    <td className="py-2.5 pr-4 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {alias && (
                          <span className="font-semibold text-[var(--color-text-main)]">
                            {alias}
                          </span>
                        )}
                        <a
                          href={entityExplorerHref(locale, s.account, networkId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={s.account}
                          className="font-mono text-[11px] text-[var(--color-primary)] hover:underline"
                        >
                          {truncateAddress(s.account, 10, 6)}
                        </a>
                        <CopyButton value={s.account} variant="minimal" size="xs" />
                      </div>
                    </td>

                    <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                      {s.signed ? (
                        <span
                          className="font-semibold text-[var(--color-success)]"
                          title={sigTs.local}
                        >
                          {labels.records.signedOn} · {sigTs.utc}
                        </span>
                      ) : rec.kind.startsWith('cipher') ? (
                        <span
                          className="font-semibold text-[var(--color-primary)] cursor-help"
                          title={labels.records.signatureDescriptions.authorized}
                        >
                          {labels.records.authorized}
                        </span>
                      ) : (
                        <span className="font-semibold text-[var(--color-warning)]">
                          {labels.records.pendingSigners}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-3 text-[11px]">
                        {s.inviteNftGlobalId && (() => {
                          const inv = splitNftGlobalId(s.inviteNftGlobalId);
                          return (
                            <a
                              href={entityExplorerHref(locale, inv.resource, networkId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={s.inviteNftGlobalId}
                              className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:underline"
                            >
                              <span>{labels.records.inviteNftLabel}</span>
                              <code className="font-mono text-[var(--color-text-main)]">
                                {inv.localId}
                              </code>
                            </a>
                          );
                        })()}
                        {s.nftGlobalId && (() => {
                          const sig = splitNftGlobalId(s.nftGlobalId);
                          return (
                            <a
                              href={entityExplorerHref(locale, sig.resource, networkId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={s.nftGlobalId}
                              className="inline-flex items-center gap-1 text-[var(--color-success)] hover:underline"
                            >
                              <span>{labels.records.signatureNftLabel}</span>
                              <code className="font-mono">{sig.localId}</code>
                            </a>
                          );
                        })()}
                        {!s.inviteNftGlobalId && !s.nftGlobalId && (
                          <span className="text-[var(--color-text-muted)]">-</span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 pl-3 align-middle whitespace-nowrap text-right">
                      {s.signed && s.txId ? (
                        <a
                          href={txExplorerHref(locale, s.txId, networkId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={s.txId}
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-primary)] hover:underline"
                        >
                          {truncateAddress(s.txId, 6, 4)}
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Low-friction sharing + WebRTC P2P channel for pending co-signers */}
      {showPendingPanel && rec.requestKey && (
        <PendingSignerSharePanel
          requestKey={rec.requestKey}
          docHash={rec.docHash}
          pendingCount={pendingCount}
          networkId={networkId}
          locale={locale}
          labels={labels}
        />
      )}
    </div>
  );
}
