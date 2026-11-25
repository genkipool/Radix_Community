'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ExternalLink,
  Filter,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import type { AddressBookEntry } from '@/features/wallet/hooks/useAddressBook';
import { truncateAddress } from '@/utils/formatters';
import type { AuditSignerSummary } from '../../lib/collection-audit';
import { splitNftGlobalId } from '../../lib/network';
import {
  entityExplorerHref,
  formatUtcTimestamp,
  type AuditLabels,
} from './AuditFormatters';

function totalNftCountOf(s: AuditSignerSummary): number {
  return (
    (s.sealNftGlobalId ? 1 : 0) +
    (s.ownCollectionAddresses?.length ?? 0) +
    (s.nftRefs?.length ?? 0)
  );
}

/**
 * Participating Radix accounts & NFT inventory table, styled identically to
 * the dashboard's transactions table (no Actions column, clickable rows that
 * expand into a structured sub-surface with identity grid + aligned NFTs table).
 */
export function AuditSignersDirectory({
  signers,
  networkId,
  locale,
  labels,
  entries,
  onSaveAlias,
  onFilterBySigner,
}: {
  signers: AuditSignerSummary[];
  networkId: number;
  locale: string;
  labels: AuditLabels;
  entries: AddressBookEntry[];
  onSaveAlias: (address: string, alias: string) => void;
  onFilterBySigner: (account: string) => void;
}) {
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [draftAlias, setDraftAlias] = useState('');
  const [expandedNfts, setExpandedNfts] = useState<Set<string>>(new Set());

  const aliasEntry = (account: string) =>
    entries.find(
      (e) => e.address.trim().toLowerCase() === account.trim().toLowerCase(),
    );

  const startEdit = (account: string) => {
    setEditingAccount(account);
    setDraftAlias(aliasEntry(account)?.name ?? '');
  };

  const commitEdit = (account: string) => {
    onSaveAlias(account, draftAlias.trim());
    setEditingAccount(null);
    setDraftAlias('');
  };

  const toggleNfts = (account: string) => {
    setExpandedNfts((prev) => {
      const next = new Set(prev);
      if (next.has(account)) next.delete(account);
      else next.add(account);
      return next;
    });
  };

  if (signers.length === 0) {
    return (
      <div className="border-t border-[var(--color-card-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
        {labels.signers.empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]" title={labels.signers.gdprNote}>
        {labels.signers.intro}
      </p>

      {/* Desktop dashboard-style table (table-fixed locks column widths so expanding never shifts rows) */}
      <div className="hidden md:block w-full">
        <table className="w-full table-fixed text-left border-collapse">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--color-card-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]/40">
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colParticipant}>
                {labels.signers.columns.participant}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colSeal}>
                {labels.signers.columns.seal}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colActivity}>
                {labels.signers.columns.activity}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold" title={labels.tooltips.colLastActivity}>
                {labels.signers.columns.lastActivity}
              </th>
              <th className="py-3 px-2.5 lg:px-3 font-semibold text-right" title={labels.tooltips.colNfts}>
                {labels.signers.columns_nfts}
              </th>
            </tr>
          </thead>
          {signers.map((s) => {
            const entry = aliasEntry(s.account);
            const isEditing = editingAccount === s.account;
            const isOpen = expandedNfts.has(s.account);
            const nftCount = totalNftCountOf(s);
            const last = formatUtcTimestamp(s.lastActivityAt, locale);

            return (
              <tbody
                key={s.account}
                className="border-b border-[var(--color-card-border)] transition-colors text-xs last:border-b-0"
              >
                <tr
                  className="cursor-pointer group transition-colors hover:bg-[var(--color-surface)]"
                  style={{
                    background:
                      'color-mix(in srgb, var(--color-surface) 75%, transparent)',
                  }}
                  onClick={() => toggleNfts(s.account)}
                >
                  <td
                    className="py-3 px-2.5 lg:px-3 align-middle"
                    onClick={(e) => {
                      if (isEditing) e.stopPropagation();
                    }}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={draftAlias}
                          onChange={(e) => setDraftAlias(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(s.account);
                            if (e.key === 'Escape') setEditingAccount(null);
                          }}
                          placeholder={labels.signers.aliasPlaceholder}
                          maxLength={80}
                          autoFocus
                          className="h-7 w-48 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-2 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => commitEdit(s.account)}
                          aria-label={labels.signers.saveAlias}
                          className="rounded-lg p-1 text-[var(--color-success)] hover:bg-[var(--color-surface)]"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAccount(null)}
                          aria-label={labels.signers.cancelAlias}
                          className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-semibold ${
                              entry ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'
                            }`}
                          >
                            {entry?.name || labels.signers.noAlias}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(s.account);
                            }}
                            title={labels.signers.editAlias}
                            aria-label={labels.signers.editAlias}
                            className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          >
                            <Pencil className="size-3" />
                          </button>
                        </div>
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2.5 lg:px-3 align-middle">
                    <SealStatusText signer={s} labels={labels} />
                  </td>
                  <td className="py-3 px-2.5 lg:px-3 align-middle tabular-nums">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-semibold text-[var(--color-success)] whitespace-nowrap" title={labels.signers.columns.signed}>
                        {s.signedCount} {labels.signers.columns.signed.toLowerCase()}
                      </span>
                      {s.pendingCount > 0 && (
                        <>
                          <span className="text-[var(--color-text-muted)]">·</span>
                          <span className="font-semibold text-[var(--color-warning)] whitespace-nowrap" title={labels.signers.columns.pending}>
                            {s.pendingCount} {labels.signers.columns.pending.toLowerCase()}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td
                    className="py-3 px-2.5 lg:px-3 align-middle whitespace-nowrap tabular-nums text-[11px] text-[var(--color-text-muted)]"
                    title={last.local}
                  >
                    {last.utc}
                  </td>
                  <td className="py-3 px-2.5 lg:px-3 align-middle whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNfts(s.account);
                      }}
                      aria-expanded={isOpen}
                      title={labels.tooltips.colNfts}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                        isOpen
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-text-main)] hover:text-[var(--color-primary)]'
                      }`}
                    >
                      <span className="tabular-nums">
                        {nftCount > 0
                          ? labels.signers.nftsToggle.replace('{count}', String(nftCount))
                          : labels.signers.noNftsYet}
                      </span>
                      <ChevronDown
                        className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <SignerNftInventory
                        signer={s}
                        networkId={networkId}
                        locale={locale}
                        labels={labels}
                        onFilterBySigner={() => onFilterBySigner(s.account)}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Mobile stacked directory */}
      <div className="border-y border-[var(--color-card-border)] divide-y divide-[var(--color-card-border)] md:hidden">
        {signers.map((s) => {
          const entry = aliasEntry(s.account);
          const last = formatUtcTimestamp(s.lastActivityAt, locale);
          const isOpen = expandedNfts.has(s.account);
          const nftCount = totalNftCountOf(s);

          return (
            <div key={s.account} className="py-3.5 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[var(--color-text-main)]">
                      {entry?.name || labels.signers.noAlias}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(s.account)}
                      aria-label={labels.signers.editAlias}
                      className="text-[var(--color-text-muted)]"
                    >
                      <Pencil className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
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
                </div>
                <SealStatusText signer={s} labels={labels} />
              </div>

              {editingAccount === s.account && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={draftAlias}
                    onChange={(e) => setDraftAlias(e.target.value)}
                    placeholder={labels.signers.aliasPlaceholder}
                    maxLength={80}
                    className="h-8 flex-1 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-2 text-xs text-[var(--color-text-main)]"
                  />
                  <button
                    type="button"
                    onClick={() => commitEdit(s.account)}
                    className="rounded-lg px-2.5 py-1 text-xs font-bold text-white bg-[var(--color-primary)]"
                  >
                    {labels.signers.saveAlias}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-3 tabular-nums text-[var(--color-text-muted)]">
                  <span>
                    <strong className="text-[var(--color-success)]">{s.signedCount}</strong>{' '}
                    {labels.signers.columns.signed.toLowerCase()}
                  </span>
                  {s.pendingCount > 0 && (
                    <span>
                      <strong className="text-[var(--color-warning)]">{s.pendingCount}</strong>{' '}
                      {labels.signers.columns.pending.toLowerCase()}
                    </span>
                  )}
                  <span>{last.utc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNfts(s.account)}
                  className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)]"
                >
                  <span>
                    {nftCount > 0
                      ? labels.signers.nftsToggle.replace('{count}', String(nftCount))
                      : labels.signers.noNftsYet}
                  </span>
                  <ChevronDown className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isOpen && (
                <SignerNftInventory
                  signer={s}
                  networkId={networkId}
                  locale={locale}
                  labels={labels}
                  onFilterBySigner={() => onFilterBySigner(s.account)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Structured, zero-left-border expanded panel for a participating account:
 *  - Top grid: Radix Seal badge & owned collections + quick filter link
 *  - Bottom sub-table: aligned inventory of Invitation & Signature NFTs
 */
function SignerNftInventory({
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
  const hasAny = totalNftCountOf(signer) > 0;

  return (
    <div
      className="border-t border-[var(--color-card-border)] px-4 py-4 md:px-6 space-y-4 text-xs"
      style={{
        background: 'color-mix(in srgb, var(--color-bg) 60%, var(--color-card-bg))',
      }}
    >
      {/* Top row: Seal NFT & Own Collections + Filter action */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
          <div className="space-y-0.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {labels.signers.sealNftLabel}
            </span>
            {signer.sealNftGlobalId ? (() => {
              const seal = splitNftGlobalId(signer.sealNftGlobalId);
              return (
                <span className="inline-flex items-center gap-1.5 font-mono" title={signer.sealNftGlobalId}>
                  <a
                    href={entityExplorerHref(locale, seal.resource, networkId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                  >
                    {truncateAddress(seal.localId, 10, 6)}
                    <ExternalLink className="size-3" />
                  </a>
                  <CopyButton value={signer.sealNftGlobalId} variant="minimal" size="xs" />
                </span>
              );
            })() : (
              <span className="text-[var(--color-text-muted)]">
                {labels.signers.sealUnverified}
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {labels.signers.ownCollectionLabel}
            </span>
            {signer.ownCollectionAddresses && signer.ownCollectionAddresses.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {signer.ownCollectionAddresses.map((col) => (
                  <span key={col} className="inline-flex items-center gap-1.5 font-mono" title={col}>
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

      {/* Bottom aligned sub-table: Invitation & Signature NFTs (zero horizontal scroll) */}
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
                          color: isSig ? 'var(--color-success)' : 'var(--color-warning)',
                        }}
                      >
                        {isSig ? labels.signers.signatureNftBadge : labels.signers.inviteNftBadge}
                      </span>
                    </td>
                    <td className="py-2 px-3 align-middle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-mono" title={ref.nftGlobalId}>
                        <a
                          href={entityExplorerHref(locale, resource, networkId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                        >
                          {localId}
                          <ExternalLink className="size-3" />
                        </a>
                        <CopyButton value={ref.nftGlobalId} variant="minimal" size="xs" />
                      </span>
                    </td>
                    <td className="py-2 pl-3 align-middle whitespace-nowrap text-right">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)]" title={ref.docHash}>
                        {truncateAddress(ref.docHash, 8, 6)}
                        <CopyButton value={ref.docHash} variant="minimal" size="xs" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !hasAny ? (
        <p className="text-xs text-[var(--color-text-muted)]">{labels.signers.noNftsYet}</p>
      ) : null}
    </div>
  );
}

function SealStatusText({
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
