'use client';

import { useState } from 'react';
import {
  Check,
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
import {
  entityExplorerHref,
  formatUtcTimestamp,
  type AuditLabels,
} from './AuditFormatters';

/**
 * Participating Radix addresses directory for the audited institution.
 * Connects to the browser's local Address Book so auditors can assign human
 * names/roles under GDPR without ever writing PII on-ledger.
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

  if (signers.length === 0) {
    return (
      <div
        className="border-t py-10 text-center text-sm"
        style={{
          borderColor: 'var(--color-card-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        {labels.signers.empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <p>{labels.signers.intro}</p>
        <p className="font-medium" style={{ color: 'var(--color-text-main)' }}>
          {labels.signers.gdprNote}
        </p>
      </div>

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
              <th className="py-2.5 pr-3">{labels.signers.columns.participant}</th>
              <th className="py-2.5 px-3">{labels.signers.columns.seal}</th>
              <th className="py-2.5 px-3 text-right">{labels.signers.columns.invited}</th>
              <th className="py-2.5 px-3 text-right">{labels.signers.columns.signed}</th>
              <th className="py-2.5 px-3 text-right">{labels.signers.columns.pending}</th>
              <th className="py-2.5 px-3">{labels.signers.columns.lastActivity}</th>
              <th className="py-2.5 pl-3 text-right">{labels.signers.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
            {signers.map((s) => {
              const entry = aliasEntry(s.account);
              const isEditing = editingAccount === s.account;
              const last = formatUtcTimestamp(s.lastActivityAt, locale);

              return (
                <tr key={s.account} className="hover:bg-[var(--color-surface)]/70">
                  <td className="py-3 pr-3 align-top">
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
                          className="h-7 w-48 rounded-lg border px-2 text-xs outline-none focus:border-[var(--color-primary)]"
                          style={{
                            background: 'var(--color-card-bg)',
                            borderColor: 'var(--color-card-border)',
                            color: 'var(--color-text-main)',
                          }}
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
                            className="text-xs font-bold"
                            style={{
                              color: entry
                                ? 'var(--color-text-main)'
                                : 'var(--color-text-muted)',
                            }}
                          >
                            {entry?.name || labels.signers.noAlias}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(s.account)}
                            title={labels.signers.editAlias}
                            aria-label={labels.signers.editAlias}
                            className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          >
                            <Pencil className="size-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <code
                            className="font-mono text-[11px]"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {truncateAddress(s.account, 12, 8)}
                          </code>
                          <CopyButton value={s.account} variant="card-inline" size="xs" />
                          <a
                            href={entityExplorerHref(locale, s.account, networkId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--color-primary)' }}
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <SealStatusBadge signer={s} labels={labels} />
                  </td>
                  <td className="py-3 px-3 text-right text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                    {s.invitedCount}
                  </td>
                  <td className="py-3 px-3 text-right text-xs font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>
                    {s.signedCount}
                  </td>
                  <td
                    className="py-3 px-3 text-right text-xs font-semibold tabular-nums"
                    style={{
                      color: s.pendingCount > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    }}
                  >
                    {s.pendingCount}
                  </td>
                  <td className="py-3 px-3 align-top text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {last.utc}
                  </td>
                  <td className="py-3 pl-3 text-right align-top">
                    <button
                      type="button"
                      onClick={() => onFilterBySigner(s.account)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[var(--color-surface)]"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <Filter className="size-3" />
                      {labels.signers.filterBySigner}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked directory */}
      <div className="divide-y border-y md:hidden" style={{ borderColor: 'var(--color-card-border)' }}>
        {signers.map((s) => {
          const entry = aliasEntry(s.account);
          const last = formatUtcTimestamp(s.lastActivityAt, locale);
          return (
            <div key={s.account} className="py-3.5 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>
                      {entry?.name || labels.signers.noAlias}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(s.account)}
                      aria-label={labels.signers.editAlias}
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Pencil className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {truncateAddress(s.account, 10, 6)}
                    </code>
                    <CopyButton value={s.account} variant="card-inline" size="xs" />
                  </div>
                </div>
                <SealStatusBadge signer={s} labels={labels} />
              </div>

              {editingAccount === s.account && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={draftAlias}
                    onChange={(e) => setDraftAlias(e.target.value)}
                    placeholder={labels.signers.aliasPlaceholder}
                    maxLength={80}
                    className="h-8 flex-1 rounded-lg border px-2 text-xs"
                    style={{
                      background: 'var(--color-card-bg)',
                      borderColor: 'var(--color-card-border)',
                      color: 'var(--color-text-main)',
                    }}
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

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-3 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  <span>
                    {labels.signers.columns.signed}:{' '}
                    <strong style={{ color: 'var(--color-success)' }}>{s.signedCount}</strong>
                  </span>
                  <span>
                    {labels.signers.columns.pending}:{' '}
                    <strong style={{ color: s.pendingCount > 0 ? 'var(--color-warning)' : 'var(--color-text-main)' }}>
                      {s.pendingCount}
                    </strong>
                  </span>
                  <span>{last.utc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onFilterBySigner(s.account)}
                  className="font-semibold"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {labels.signers.filterBySigner}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SealStatusBadge({
  signer,
  labels,
}: {
  signer: AuditSignerSummary;
  labels: AuditLabels;
}) {
  if (signer.hasVerifiedSeal) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
        style={{
          background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
          color: 'var(--color-success)',
        }}
      >
        <ShieldCheck className="size-3 shrink-0" />
        {signer.hasOwnCollection
          ? labels.signers.sealCollectionReady
          : labels.signers.sealVerified}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-card-border)',
        color: 'var(--color-text-muted)',
      }}
    >
      <ShieldAlert className="size-3 shrink-0" />
      {labels.signers.sealUnverified}
    </span>
  );
}
