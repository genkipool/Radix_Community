'use client';

import { AlertTriangle, BadgeCheck, ExternalLink } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import type { AuditRecord } from '../../lib/collection-audit';
import { splitNftGlobalId } from '../../lib/network';
import {
  entityExplorerHref,
  formatUtcTimestamp,
  txExplorerHref,
  verifierHref,
  type AuditLabels,
} from './AuditFormatters';
import { PendingSignerSharePanel } from './PendingSignerSharePanel';

/**
 * Expanded detail panel for a single audited record: anomalies, request key,
 * NFT ids, consensus clock status, aligned signers sub-table, and P2P sharing
 * panel for pending multi-party requests.
 */
export function AuditRecordDetailPanel({
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
        background:
          'color-mix(in srgb, var(--color-bg) 60%, var(--color-card-bg))',
      }}
    >
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

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {rec.requestKey && (
          <div className="space-y-0.5">
            <span
              className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] cursor-help"
              title={labels.records.requestKeyTooltip}
            >
              {labels.records.requestKeyLabel}
            </span>
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[var(--color-text-main)]"
              title={rec.requestKey}
            >
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
                color: rec.clockAgrees
                  ? 'var(--color-success)'
                  : 'var(--color-danger)',
              }}
            >
              {rec.clockAgrees
                ? labels.records.clockOk
                : labels.records.clockWarn}
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
                        <CopyButton
                          value={s.account}
                          variant="minimal"
                          size="xs"
                        />
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
                        {s.inviteNftGlobalId &&
                          (() => {
                            const inv = splitNftGlobalId(s.inviteNftGlobalId);
                            return (
                              <a
                                href={entityExplorerHref(
                                  locale,
                                  inv.resource,
                                  networkId,
                                )}
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
                        {s.nftGlobalId &&
                          (() => {
                            const sig = splitNftGlobalId(s.nftGlobalId);
                            return (
                              <a
                                href={entityExplorerHref(
                                  locale,
                                  sig.resource,
                                  networkId,
                                )}
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
                          <span className="text-[var(--color-text-muted)]">
                            -
                          </span>
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
