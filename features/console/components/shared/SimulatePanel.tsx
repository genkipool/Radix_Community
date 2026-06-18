'use client';

import { CheckCircle2, FlaskConical, XCircle, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import type { TransactionPreviewResult, PreviewBalanceChange } from '../../services/transactionPreview';
import type { ConsoleDictionary } from '../../types/i18n.types';
import type { MetadataItem } from '@/features/dashboard/types';
import { useQuery } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useAddressBook } from '@/features/wallet/hooks/useAddressBook';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { SafeImage } from '@/components/ui/SafeImage';
import { CopyButton } from '@/components/ui/CopyButton';

function getMetadataValue(items: MetadataItem[] | undefined, key: string): string | undefined {
  return items?.find((m: MetadataItem) => m.key === key)?.value?.typed?.value;
}

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
      className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer w-full flex-1"
      style={{
        background: 'var(--color-primary)',
        color: '#ffffff',
      }}
    >
      {loading ? (
        <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        <FlaskConical className="size-4 text-white" />
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
  onClose?: () => void;
}

/** Outcome of a simulation: status, estimated fee and balance changes. */
export function SimulateResultCard({ t, preview, error, onClose }: SimulateResultCardProps) {
  const { language } = useLanguage();

  if (!preview && !error) return null;

  if (error || (preview && preview.status !== 'Succeeded')) {
    return (
      <div className="relative rounded-2xl border border-red-500/30 border-l-[4px] border-l-red-500 bg-red-500/5 p-5 flex items-start gap-3 mt-4">
        {onClose && (
          <button onClick={onClose} className="absolute right-3 top-3 text-[var(--color-text-muted)] hover:text-red-500 transition-colors">
            <X className="size-4" />
          </button>
        )}
        <XCircle className="size-5 shrink-0 text-red-500 mt-0.5" />
        <div className="min-w-0 pr-6">
          <p className="text-sm font-bold text-[var(--color-text-main)]">
            {t.failedTitle}
            {preview?.status && preview.status !== 'Succeeded' && (
              <span className="ml-2 font-mono text-xs opacity-80 text-red-400">{preview.status}</span>
            )}
          </p>
          <p className="text-xs mt-1 break-words font-mono text-red-400">
            {(() => {
              const msg = error ?? preview?.errorMessage ?? '';
              return msg.includes('One or more errors occurred') ? t.genericError : msg;
            })()}
          </p>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="relative rounded-2xl border border-[var(--color-primary)]/30 border-l-[4px] border-l-[var(--color-primary)] bg-[var(--color-primary)]/5 p-5 space-y-4 mt-4">
      {onClose && (
        <button onClick={onClose} className="absolute right-3 top-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
          <X className="size-4" />
        </button>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pr-6">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
          <CheckCircle2 className="size-5 text-[var(--color-primary)]" />
          {t.successTitle}
        </p>
      </div>

      {(preview.balanceChanges.length > 0 || preview.feeXrd) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              {t.balanceChanges}
            </p>
            {preview.feeXrd && (
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                Fee: <span className="text-[var(--color-text-main)]">{formatNumber(preview.feeXrd, 4, language)} XRD</span>
              </span>
            )}
          </div>
          {preview.balanceChanges.length > 0 && (
            <div className="space-y-1">
              {preview.balanceChanges.map((change, index) => (
                <BalanceChangeRow key={index} change={change} language={language} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BalanceChangeRow({ change, language }: { change: PreviewBalanceChange; language: string }) {
  const { accounts, activeNetwork } = useRadixWallet();
  const { entries: addressBookEntries } = useAddressBook();

  const account = accounts.find(a => a.address === change.entityAddress);
  const addressBookEntry = addressBookEntries.find(e => e.address === change.entityAddress);
  const localName = account?.label || addressBookEntry?.name;

  const { data: entityData } = useQuery({
    queryKey: ['entityDetails', change.entityAddress, activeNetwork],
    queryFn: () => apiFetchEntityDetails(change.entityAddress, activeNetwork || 'mainnet'),
    enabled: !localName,
    staleTime: 1000 * 60 * 5,
  });

  const entityName = localName || getMetadataValue(entityData?.explicit_metadata?.items, 'name');

  const { data: resourceData } = useQuery({
    queryKey: ['entityDetails', change.resourceAddress, activeNetwork],
    queryFn: () => apiFetchEntityDetails(change.resourceAddress, activeNetwork || 'mainnet'),
    staleTime: 1000 * 60 * 60,
  });

  const symbol = getMetadataValue(resourceData?.explicit_metadata?.items, 'symbol') || 
                 getMetadataValue(resourceData?.explicit_metadata?.items, 'name') || 'Token';
  const iconUrl = getMetadataValue(resourceData?.explicit_metadata?.items, 'icon_url');

  const isNegative = change.amount.startsWith('-');
  const amountStr = isNegative ? '' : '+';
  
  return (
    <div className="flex flex-col gap-1 mb-3">
      {entityName && (
         <div className="text-[10px] font-semibold text-[var(--color-text-main)]">{entityName}</div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
         <code title={change.entityAddress} style={{ color: 'var(--color-text-main)' }}>
            {truncateAddress(change.entityAddress, 10, 6)}
         </code>
         <span className={`font-mono font-bold ${isNegative ? 'text-[var(--color-text-main)]' : 'text-[var(--color-primary)]'}`}>
            {amountStr}{formatNumber(Number(change.amount), 4, language)}
         </span>
         
         <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>{symbol}</span>
         
         {iconUrl && (
             <SafeImage src={iconUrl} alt={symbol} fallbackName={symbol} className="size-5 rounded-full object-cover" />
         )}

         <div className="flex items-center gap-1">
             <code title={change.resourceAddress} style={{ color: 'var(--color-text-muted)' }}>
                {truncateAddress(change.resourceAddress, 10, 6)}
             </code>
             <CopyButton value={change.resourceAddress} size="xs" variant="ghost" />
         </div>
      </div>
    </div>
  );
}
