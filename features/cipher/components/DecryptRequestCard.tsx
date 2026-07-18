'use client';

import { BadgeCheck, KeyRound, X } from 'lucide-react';
import type { CipherDictionary } from '../types/dictionary';
import { fillTemplate, shortFingerprint } from '../lib/format';

/**
 * The sender's explicit consent step: who is asking, for which file (with a
 * human-checkable fingerprint), approve-and-sign or reject. ROLA + Ledger
 * requests also show the requester's PROVEN account and the on-ledger
 * invitation check result.
 */
export function DecryptRequestCard({
  t,
  requesterName,
  requesterAccount,
  ledgerVerified,
  fileName,
  headerHash,
  busy,
  onApprove,
  onDeny,
}: {
  t: CipherDictionary;
  requesterName: string;
  requesterAccount?: string;
  ledgerVerified?: boolean;
  fileName: string;
  headerHash: string;
  busy?: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const body = fillTemplate(t.request.body, {
    name: requesterName || t.request.anonymous,
    file: fileName,
  });

  return (
    <div
      className="rounded-3xl border p-6 space-y-4"
      style={{
        background: 'var(--color-card-bg)',
        borderColor: 'var(--color-primary)',
      }}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
          {t.request.title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
          {body}
        </p>
        <p className="font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {t.file.fingerprint}: {shortFingerprint(headerHash)}
        </p>
        {requesterAccount && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {t.ledger.requesterAccount}:{' '}
            <span className="font-mono break-all" style={{ color: 'var(--color-text-main)' }}>
              {requesterAccount}
            </span>
          </p>
        )}
        {ledgerVerified && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
            <BadgeCheck className="size-3.5 shrink-0" />
            {t.ledger.authorizedBadge}
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          {busy ? (
            <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          {t.request.approve}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDeny}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          <X className="size-4" />
          {t.request.deny}
        </button>
      </div>
    </div>
  );
}
