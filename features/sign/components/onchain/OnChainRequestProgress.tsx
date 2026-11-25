'use client';

import { BadgeCheck, CheckCircle2, Circle, Download, RefreshCw } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { OnChainStatus } from '../../services/signApi';
import type { OutputFormat } from '../../types/sign.types';
import type { SignDictionary } from '../../types/dictionary';
import { RequestTransactionLinks } from '../RequestTransactionLinks';
import { OnChainMuted } from './OnChainPrimitives';

export function OnChainSignerProgressSection({
  t,
  status,
  walletAddresses,
  loading,
  onRefresh,
}: {
  t: SignDictionary;
  status: OnChainStatus | null;
  walletAddresses: Set<string>;
  loading: boolean;
  onRefresh: () => void;
}) {
  const signatures = status?.signatures ?? [];
  return (
    <ToolSection
      title={t.onchain.statusTitle}
      action={
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? t.onchain.checking : t.onchain.refresh}
        </button>
      }
    >
      {status?.signatures && (
        <>
          <p
            className="text-sm font-semibold"
            style={{
              color: status.complete
                ? 'var(--color-success)'
                : 'var(--color-text-muted)',
            }}
          >
            {signatures.filter((s) => s.signed).length} {t.onchain.of}{' '}
            {signatures.length}
            {status.complete ? ` · ${t.onchain.complete}` : ''}
          </p>
          <ul className="space-y-1.5 text-sm">
            {signatures.map((s) => (
              <li key={s.account} className="flex items-center gap-2">
                {s.signed ? (
                  <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
                ) : (
                  <Circle
                    className="size-4 shrink-0"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                )}
                <span
                  className="font-mono text-[12px] break-all"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  {s.account}
                </span>
                {walletAddresses.has(s.account) && (
                  <span
                    className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{
                      background: 'var(--color-surface)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-card-border)',
                    }}
                  >
                    {t.onchain.youBadge}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!status.complete && <OnChainMuted text={t.onchain.autoRefreshNote} />}
        </>
      )}
    </ToolSection>
  );
}

export function OnChainCompletedSection({
  t,
  status,
  statusNetworkId,
  outputs,
  isPdf,
  downloadsBlocked,
  onDownloadCert,
  onDownloadPdf,
}: {
  t: SignDictionary;
  status: OnChainStatus;
  statusNetworkId: number | null;
  outputs: OutputFormat[];
  isPdf: boolean;
  downloadsBlocked: boolean;
  onDownloadCert: () => void;
  onDownloadPdf: () => void;
}) {
  return (
    <ToolSection>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)]">
          <BadgeCheck className="size-5 text-[var(--color-success)]" />
        </div>
        <div>
          <p
            className="text-sm font-bold"
            style={{ color: 'var(--color-text-main)' }}
          >
            {t.onchain.completeTitle}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.onchain.completeBody}
          </p>
        </div>
      </div>
      {status.createdTxId && (
        <RequestTransactionLinks
          t={t}
          txId={status.createdTxId}
          networkId={statusNetworkId ?? undefined}
        />
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        {(outputs.includes('detached') ||
          !(outputs.includes('embedded') && isPdf)) && (
          <button
            type="button"
            disabled={downloadsBlocked}
            onClick={onDownloadCert}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download className="size-4" />
            {t.actions.downloadCert}
          </button>
        )}
        {outputs.includes('embedded') && isPdf && (
          <button
            type="button"
            disabled={downloadsBlocked}
            onClick={onDownloadPdf}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            style={{
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          >
            <Download className="size-4" />
            {t.actions.downloadPdf}
          </button>
        )}
      </div>
    </ToolSection>
  );
}
