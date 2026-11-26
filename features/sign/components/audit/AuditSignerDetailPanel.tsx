'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ExternalLink,
  Filter,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { useLanguage } from '@/context/LanguageContext';
import { NftCollectionPanel } from '@/features/dashboard/explorador/components/NftCollectionPanel';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import {
  apiFetchEntityDetails,
  apiFetchNonFungibleData,
} from '@/features/dashboard/services/apiClient';
import { truncateAddress } from '@/utils/formatters';
import type { AuditNftRef, AuditSignerSummary } from '../../lib/collection-audit';
import { splitNftGlobalId } from '../../lib/network';
import {
  entityExplorerHref,
  explorerNetworkForId,
  type AuditLabels,
} from './AuditFormatters';

export function totalSignerNftCount(s: AuditSignerSummary): number {
  return (
    (s.sealNftGlobalId ? 1 : 0) +
    (s.ownCollectionAddresses?.length ?? 0) +
    (s.nftRefs?.length ?? 0)
  );
}

function InlineAuditNftRow({
  nftRef,
  collectionAddress,
  networkId,
  locale,
  labels,
  canRecall,
  recalling,
  recallError,
  onRecall,
}: {
  nftRef: AuditNftRef;
  collectionAddress?: string;
  networkId: number;
  locale: string;
  labels: AuditLabels;
  canRecall: boolean;
  recalling: boolean;
  recallError?: string | null;
  onRecall?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { t } = useLanguage();
  const network = explorerNetworkForId(networkId) ?? 'mainnet';
  const tt = t?.dashboard?.transactions;
  const isSig = nftRef.kind === 'signature';
  const { resource, localId } = splitNftGlobalId(nftRef.nftGlobalId);
  const showRecall =
    canRecall && !isSig && (!collectionAddress || resource === collectionAddress);

  const { data: entityDetails, isLoading: detailsLoading } = useQuery({
    queryKey: entityKeys.full(resource, network),
    queryFn: () => apiFetchEntityDetails(resource, network),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    enabled: open,
  });

  const { data: nftData, isLoading: nftLoading } = useQuery({
    queryKey: ['nft-raw-data', network, resource, localId],
    queryFn: () => apiFetchNonFungibleData(resource, [localId], network),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    enabled: open,
  });

  const handleCopy = (addr: string) => {
    navigator.clipboard?.writeText(addr).catch(() => {});
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress((cur) => (cur === addr ? null : cur)), 2000);
  };

  return (
    <>
      <tr
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer transition-colors hover:bg-[var(--color-surface)]/50"
      >
        <td className="py-2 pr-4 align-middle whitespace-nowrap">
          <span
            className="font-semibold"
            style={{
              color: isSig ? 'var(--color-success)' : 'var(--color-warning)',
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
            title={nftRef.nftGlobalId}
            onClick={(e) => e.stopPropagation()}
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
              value={nftRef.nftGlobalId}
              variant="minimal"
              size="xs"
            />
          </span>
        </td>
        <td className="py-2 px-3 align-middle whitespace-nowrap text-right">
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)]"
            title={nftRef.docHash}
            onClick={(e) => e.stopPropagation()}
          >
            {truncateAddress(nftRef.docHash, 8, 6)}
            <CopyButton value={nftRef.docHash} variant="minimal" size="xs" />
          </span>
        </td>
        <td
          className="py-2 pl-3 align-middle whitespace-nowrap text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inline-flex items-center justify-end gap-2">
            {showRecall && onRecall && (
              <button
                type="button"
                disabled={recalling}
                onClick={onRecall}
                title={labels.signers.recallInviteTooltip}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/20 disabled:opacity-50 cursor-pointer"
              >
                {recalling ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Undo2 className="size-3" />
                )}
                <span>
                  {recalling
                    ? labels.signers.recallingInvite
                    : labels.signers.recallInvite}
                </span>
              </button>
            )}
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)] cursor-pointer"
            >
              <span>{labels.signers.nftDetails}</span>
              <ChevronDown
                className={`size-3.5 transition-transform ${
                  open ? 'rotate-180 text-[var(--color-primary)]' : ''
                }`}
              />
            </button>
          </div>
          {recallError && (
            <p className="mt-1 text-[11px] text-[var(--color-danger)]">
              {recallError}
            </p>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} className="pb-3 pt-1">
            <NftCollectionPanel
              resourceAddress={resource}
              meta={entityDetails ?? null}
              nftData={(nftData ?? []) as unknown as Record<string, unknown>[]}
              nftLoading={detailsLoading || nftLoading}
              ids={[localId]}
              type="neutral"
              onCopy={handleCopy}
              copiedAddress={copiedAddress}
              tt={tt}
              network={network}
              locale={locale}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Expanded panel for a participating account: Radix Seal badge, owned
 * collections (collapsible when > 1), quick filter link, and aligned
 * inventory of Invitation & Signature NFTs with inline details & optional recall.
 */
export function AuditSignerDetailPanel({
  signer,
  collectionAddress,
  networkId,
  locale,
  labels,
  canRecall = false,
  recallingNftId = null,
  recallErrorByNftId,
  onRecallInvite,
  onFilterBySigner,
}: {
  signer: AuditSignerSummary;
  collectionAddress?: string;
  networkId: number;
  locale: string;
  labels: AuditLabels;
  canRecall?: boolean;
  recallingNftId?: string | null;
  recallErrorByNftId?: Record<string, string>;
  onRecallInvite?: (signerAccount: string, nftGlobalId: string) => void;
  onFilterBySigner: () => void;
}) {
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const hasAny = totalSignerNftCount(signer) > 0;
  const ownCollections = signer.ownCollectionAddresses ?? [];

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
            {ownCollections.length === 1 ? (
              <span
                className="inline-flex items-center gap-1.5 font-mono"
                title={ownCollections[0]}
              >
                <a
                  href={entityExplorerHref(locale, ownCollections[0], networkId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  {truncateAddress(ownCollections[0], 10, 6)}
                  <ExternalLink className="size-3" />
                </a>
                <CopyButton
                  value={ownCollections[0]}
                  variant="minimal"
                  size="xs"
                />
              </span>
            ) : ownCollections.length > 1 ? (
              <div className="space-y-1.5">
                <button
                  type="button"
                  aria-expanded={collectionsOpen}
                  onClick={() => setCollectionsOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  <span>
                    {labels.signers.ownCollectionsToggle.replace(
                      '{count}',
                      String(ownCollections.length),
                    )}
                  </span>
                  <ChevronDown
                    className={`size-3.5 transition-transform ${
                      collectionsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {collectionsOpen && (
                  <div className="flex flex-col gap-1 pt-0.5">
                    {ownCollections.map((col) => (
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
                )}
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
                <th className="py-2 px-3 font-semibold whitespace-nowrap text-right">
                  {labels.records.columns.document}
                </th>
                <th className="py-2 pl-3 font-semibold whitespace-nowrap text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-card-border)]/50">
              {signer.nftRefs.map((ref) => (
                <InlineAuditNftRow
                  key={`${ref.kind}:${ref.nftGlobalId}`}
                  nftRef={ref}
                  collectionAddress={collectionAddress}
                  networkId={networkId}
                  locale={locale}
                  labels={labels}
                  canRecall={canRecall}
                  recalling={recallingNftId === ref.nftGlobalId}
                  recallError={recallErrorByNftId?.[ref.nftGlobalId]}
                  onRecall={
                    onRecallInvite
                      ? () => onRecallInvite(signer.account, ref.nftGlobalId)
                      : undefined
                  }
                />
              ))}
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
