'use client';

import { CheckCircle2, FlaskConical, Fuel, XCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import type { TransactionPreviewResult } from '../../services/transactionPreview';
import type { ConsoleDictionary } from '../../types/i18n.types';

/* ─── Simulate button ─────────────────────────────────────────────────────── */

interface SimulateButtonProps {
  t: ConsoleDictionary['simulate'];
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

/** Secondary action that dry-runs the manifest before sending it. */
export function SimulateButton({ t, onClick, disabled, loading }: SimulateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={t.buttonHint}
      className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full font-bold text-sm border transition-all hover:-translate-y-px active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-card-border)',
        color: 'var(--color-text-main)',
      }}
    >
      {loading ? (
        <span className="size-4 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      ) : (
        <FlaskConical className="size-4" style={{ color: 'var(--color-primary)' }} />
      )}
      {t.button}
    </button>
  );
}

/* ─── Result card ─────────────────────────────────────────────────────────── */

interface SimulateResultCardProps {
  t: ConsoleDictionary['simulate'];
  preview: TransactionPreviewResult | null;
  error: string | null;
}

/** Outcome of a simulation: status, estimated fee and balance changes. */
export function SimulateResultCard({ t, preview, error }: SimulateResultCardProps) {
  const { language } = useLanguage();

  if (!preview && !error) return null;

  if (error || (preview && preview.status !== 'Succeeded')) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 flex items-start gap-3">
        <XCircle className="size-5 shrink-0 text-red-500 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-500">
            {t.failedTitle}
            {preview?.status && preview.status !== 'Succeeded' && (
              <span className="ml-2 font-mono text-xs opacity-80">{preview.status}</span>
            )}
          </p>
          <p className="text-xs mt-1 break-words font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {error ?? preview?.errorMessage ?? ''}
          </p>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-500">
          <CheckCircle2 className="size-5" />
          {t.successTitle}
        </p>
        <p
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--color-text-muted)' }}
          title={t.feeHint}
        >
          <Fuel className="size-3.5" />
          {t.fee}: <span style={{ color: 'var(--color-text-main)' }}>{formatNumber(preview.feeXrd, 4, language)} XRD</span>
        </p>
      </div>

      {preview.balanceChanges.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            {t.balanceChanges}
          </p>
          <div className="space-y-1">
            {preview.balanceChanges.map((change, index) => {
              const isNegative = change.amount.startsWith('-');
              return (
                <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <code title={change.entityAddress} style={{ color: 'var(--color-text-main)' }}>
                    {truncateAddress(change.entityAddress, 10, 6)}
                  </code>
                  <span
                    className="font-mono font-bold"
                    style={{ color: isNegative ? '#f43f5e' : '#10b981' }}
                  >
                    {isNegative ? '' : '+'}
                    {formatNumber(Number(change.amount), 4, language)}
                  </span>
                  <code title={change.resourceAddress} style={{ color: 'var(--color-text-muted)' }}>
                    {truncateAddress(change.resourceAddress, 10, 6)}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
