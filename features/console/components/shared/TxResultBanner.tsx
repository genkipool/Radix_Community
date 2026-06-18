'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, RotateCcw, XCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress, formatNumber } from '@/utils/formatters';
import type { ConsoleCommonDictionary } from '../../types/i18n.types';
import type { ConsoleTxResult } from '../../types/console.types';
import type { TransactionPreviewResult } from '../../services/transactionPreview';
import { BalanceChangeRow } from './SimulatePanel';

interface TxResultBannerProps {
  t: ConsoleCommonDictionary;
  result: ConsoleTxResult | null;
  /** Error key from useConsoleTransaction (or a raw wallet message) */
  error: string | null;
  /** Label for the created entity row (e.g. "Created resource") */
  createdEntityLabel?: string;
  onReset?: () => void;
  preview?: TransactionPreviewResult | null;
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
      className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
    >
      {truncateAddress(value, 14, 10)}
      <Copy className="size-3.5 opacity-60" />
    </button>
  );
}

/** Success / error result panel rendered after a console transaction. */
export function TxResultBanner({ t, result, error, createdEntityLabel, onReset, preview }: TxResultBannerProps) {
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();

  if (!result && !error) return null;

  const errorMessages = t.errors as Record<string, string>;

  if (error) {
    return (
      <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 flex items-start gap-3 overflow-hidden shadow-sm mt-4">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
        {onReset && (
          <button onClick={onReset} className="absolute right-3 top-3 text-[var(--color-text-muted)] hover:text-red-500 transition-colors">
            <X className="size-4" />
          </button>
        )}
        <XCircle className="size-5 shrink-0 text-red-500 mt-0.5" />
        <div className="min-w-0 pr-6">
          <p className="text-sm font-bold text-[var(--color-text-main)]">{t.txFailedTitle}</p>
          <p className="text-xs mt-1 break-words text-red-400">
            {errorMessages[error] ?? error}
          </p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const dashboardHref = `/${language}/dashboard?view=transactions&tx=${encodeURIComponent(result.transactionIntentHash)}&network=${activeNetwork}`;

  return (
    <div className="relative rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-5 space-y-4 mt-4">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)]"></div>
      {onReset && (
        <button onClick={onReset} className="absolute right-3 top-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
          <X className="size-4" />
        </button>
      )}
      
      <div className="flex items-start gap-3">
        <CheckCircle2 className="size-5 shrink-0 text-[var(--color-primary)] mt-0.5" />
        <div className="min-w-0 space-y-1 pr-6 w-full">
          <p className="text-base font-bold text-[var(--color-text-main)]">{t.txSuccessTitle}</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            La transacción se ha procesado y confirmado en la red correctamente.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-12 gap-y-4 pl-8 mt-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">ID de transacción</span>
          <CopyValue value={result.transactionIntentHash} copyLabel={t.copy} copiedLabel={t.copied} />
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t.txStatus}</span>
          <span className="text-sm font-medium text-[var(--color-text-main)]">{result.status}</span>
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Red</span>
          <span className="text-sm font-medium text-[var(--color-text-main)] capitalize">{activeNetwork}</span>
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Fecha</span>
          <span className="text-sm font-medium text-[var(--color-text-main)]">
            {new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}
          </span>
        </div>

        {preview && preview.feeXrd && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Fee</span>
            <span className="text-sm font-medium text-[var(--color-text-main)]">
              {formatNumber(preview.feeXrd, 4, language)} XRD
            </span>
          </div>
        )}
      </div>

      {preview && preview.balanceChanges && preview.balanceChanges.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--color-primary)]/20 pl-8">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Cambios de balance</span>
          <div className="space-y-1">
            {preview.balanceChanges.map((change, index) => (
              <BalanceChangeRow key={index} change={change} language={language} />
            ))}
          </div>
        </div>
      )}

      {createdEntityLabel && result.createdEntities.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--color-primary)]/20 pl-8">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{createdEntityLabel}</span>
          <div className="flex flex-wrap gap-2">
              {result.createdEntities.map((address) => (
                <CopyValue key={address} value={address} copyLabel={t.copy} copiedLabel={t.copied} />
              ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 pl-8 pt-2">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--color-accent)] text-[var(--color-primary)]"
        >
          <ExternalLink className="size-4" />
          {t.viewInDashboard}
        </Link>
        {onReset && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
          >
            <RotateCcw className="size-4" />
            Nueva transacción
          </button>
        )}
      </div>
    </div>
  );
}
