'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import type { ConsoleCommonDictionary } from '../../types/i18n.types';
import type { ConsoleTxResult } from '../../types/console.types';

interface TxResultBannerProps {
  t: ConsoleCommonDictionary;
  result: ConsoleTxResult | null;
  /** Error key from useConsoleTransaction (or a raw wallet message) */
  error: string | null;
  /** Label for the created entity row (e.g. "Created resource") */
  createdEntityLabel?: string;
  onReset?: () => void;
}

function CopyValue({ value, copyLabel, copiedLabel }: { value: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? copiedLabel : copyLabel}
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded-lg border transition-colors hover:border-[var(--color-primary)] cursor-pointer"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
    >
      {truncateAddress(value, 14, 10)}
      <Copy className="size-3" style={{ color: copied ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
    </button>
  );
}

/** Success / error result panel rendered after a console transaction. */
export function TxResultBanner({ t, result, error, createdEntityLabel, onReset }: TxResultBannerProps) {
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();

  if (!result && !error) return null;

  const errorMessages = t.errors as Record<string, string>;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 flex items-start gap-3">
        <XCircle className="size-5 shrink-0 text-red-500 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-500">{t.txFailedTitle}</p>
          <p className="text-xs mt-1 break-words" style={{ color: 'var(--color-text-muted)' }}>
            {errorMessages[error] ?? error}
          </p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const dashboardHref = `/${language}/dashboard?view=transactions&tx=${encodeURIComponent(result.transactionIntentHash)}&network=${activeNetwork}`;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-500 mt-0.5" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-bold text-emerald-500">{t.txSuccessTitle}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span className="font-semibold">{t.txId}:</span>
            <CopyValue value={result.transactionIntentHash} copyLabel={t.copy} copiedLabel={t.copied} />
            <span className="font-semibold">{t.txStatus}:</span>
            <span style={{ color: 'var(--color-text-main)' }}>{result.status}</span>
          </div>
          {createdEntityLabel && result.createdEntities.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-semibold">{createdEntityLabel}:</span>
              {result.createdEntities.map((address) => (
                <CopyValue key={address} value={address} copyLabel={t.copy} copiedLabel={t.copied} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pl-8">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)]"
          style={{ color: 'var(--color-primary)' }}
        >
          <ExternalLink className="size-3.5" />
          {t.viewInDashboard}
        </Link>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <RotateCcw className="size-3.5" />
            {t.newTransaction}
          </button>
        )}
      </div>
    </div>
  );
}
