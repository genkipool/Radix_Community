'use client';

import { ExternalLink, Filter, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import type { AuditSignerSummary } from '../../lib/collection-audit';
import { splitNftGlobalId } from '../../lib/network';
import { entityExplorerHref, type AuditLabels } from './AuditFormatters';

export function totalSignerNftCount(s: AuditSignerSummary): number {
  return (
    (s.sealNftGlobalId ? 1 : 0) +
    (s.ownCollectionAddresses?.length ?? 0) +
    (s.nftRefs?.length ?? 0)
  );
}

/**
 * Expanded panel for a participating account: Radix Seal badge, owned
 * collections, quick filter link, and aligned inventory of Invitation &
 * Signature NFTs.
 */
export function AuditSignerDetailPanel({
  signer,
  networkId,
  locale,
  labels,
  onFilterBySigner,
}: {
  signer: AuditSignerSummary;
  networkId: number;
  locale: string;
  labels: AuditLabels;
  onFilterBySigner: () => void;
}) {
  const hasAny = totalSignerNftCount(signer) > 0;

  return (
    <div
      className="border-t border-[var(--color-card-border)] px-4 py-4 md:px-6 space-y-4 text-xs"
      style={{
        background:
          'color-mix(in srgb, var(--color-bg) 60%, var(--color-card-bg))',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
          <div className="space-y-0.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {labels.signers.sealNftLabel}
            </span>
            {signer.sealNftGlobalId ? (
              (() => {
                const seal = splitNftGlobalId(signer.sealNftGlobalId);
                return (
                  <span
                    className="inline-flex items-center gap-1.5 font-mono"
                    title={signer.sealNftGlobalId}
                  >
                    <a
                      href={entityExplorerHref(locale, seal.resource, networkId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                    >
                      {truncateAddress(seal.localId, 10, 6)}
                      <ExternalLink className="size-3" />
                    </a>
                    <CopyButton
                      value={signer.sealNftGlobalId}
                      variant="minimal"
                      size="xs"
                    />
                  </span>
                );
              })()
            ) : (
              <span className="text-[var(--color-text-muted)]">
                {labels.signers.sealUnverified}
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {labels.signers.ownCollectionLabel}
            </span>
            {signer.ownCollectionAddresses &&
            signer.ownCollectionAddresses.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {signer.ownCollectionAddresses.map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center gap-1.5 font-mono"
                    title={col}
                  >
                    <a
                      href={entityExplorerHref(locale, col, networkId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                    >
                      {truncateAddress(col, 10, 6)}
                      <ExternalLink className="size-3" />
                    </a>
                    <CopyButton value={col} variant="minimal" size="xs" />
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[var(--color-text-muted)]">-</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onFilterBySigner}
          title={labels.tooltips.colSignerActions}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline shrink-0"
        >
          <Filter className="size-3.5" />
          {labels.signers.filterBySigner}
        </button>
      </div>

      {signer.nftRefs && signer.nftRefs.length > 0 ? (
        <div className="border-t border-[var(--color-card-border)]/70 pt-3 w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-card-border)]/70 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="py-2 pr-4 font-semibold whitespace-nowrap">
                  {labels.records.columns.type}
                </th>
                <th className="py-2 px-3 font-semibold whitespace-nowrap">
                  {labels.signers.columns_nfts}
                </th>
                <th className="py-2 pl-3 font-semibold whitespace-nowrap text-right">
                  {labels.records.columns.document}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-card-border)]/50">
              {signer.nftRefs.map((ref) => {
                const isSig = ref.kind === 'signature';
                const { resource, localId } = splitNftGlobalId(ref.nftGlobalId);
                return (
                  <tr key={`${ref.kind}:${ref.nftGlobalId}`}>
                    <td className="py-2 pr-4 align-middle whitespace-nowrap">
                      <span
                        className="font-semibold"
                        style={{
                          color: isSig
                            ? 'var(--color-success)'
                            : 'var(--color-warning)',
                        }}
                      >
                        {isSig
                          ? labels.signers.signatureNftBadge
                          : labels.signers.inviteNftBadge}
                      </span>
                    </td>
                    <td className="py-2 px-3 align-middle whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 font-mono"
                        title={ref.nftGlobalId}
                      >
                        <a
                          href={entityExplorerHref(locale, resource, networkId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                        >
                          {localId}
                          <ExternalLink className="size-3" />
                        </a>
                        <CopyButton
                          value={ref.nftGlobalId}
                          variant="minimal"
                          size="xs"
                        />
                      </span>
                    </td>
                    <td className="py-2 pl-3 align-middle whitespace-nowrap text-right">
                      <span
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)]"
                        title={ref.docHash}
                      >
                        {truncateAddress(ref.docHash, 8, 6)}
                        <CopyButton
                          value={ref.docHash}
                          variant="minimal"
                          size="xs"
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !hasAny ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          {labels.signers.noNftsYet}
        </p>
      ) : null}
    </div>
  );
}

export function SealStatusText({
  signer,
  labels,
}: {
  signer: AuditSignerSummary;
  labels: AuditLabels;
}) {
  if (signer.hasVerifiedSeal) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)] whitespace-nowrap"
        title={labels.tooltips.colSeal}
      >
        <ShieldCheck className="size-3.5 shrink-0" />
        {signer.hasOwnCollection
          ? labels.signers.sealCollectionReady
          : labels.signers.sealVerified}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap"
      title={labels.tooltips.colSeal}
    >
      <ShieldAlert className="size-3.5 shrink-0" />
      {labels.signers.sealUnverified}
    </span>
  );
}
