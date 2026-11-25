'use client';

import { CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { OnChainStatus } from '../../services/signApi';
import type { SignDictionary } from '../../types/dictionary';
import { DomainVerifiedBadge } from '../DomainVerifiedBadge';

export function VerifyOnChainCard({
  t,
  keyInput,
  onKeyInputChange,
  invalidKey,
  requestId,
  onchain,
  isFetching,
  notFound,
  hasFileBytes,
  effectiveDocHash,
  onchainHashMismatch,
  onRefresh,
}: {
  t: SignDictionary;
  keyInput: string;
  onKeyInputChange: (v: string) => void;
  invalidKey: boolean;
  requestId: string | undefined;
  onchain: OnChainStatus | null;
  isFetching: boolean;
  notFound: boolean;
  hasFileBytes: boolean;
  effectiveDocHash: string;
  onchainHashMismatch: boolean;
  onRefresh: () => void;
}) {
  return (
    <ToolSection
      title={t.onchain.statusTitle}
      hint={t.onchain.statusHint}
      action={
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching || !requestId}
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? t.onchain.checking : t.onchain.refresh}
        </button>
      }
    >
      <div className="flex gap-2">
        <input
          value={keyInput}
          onChange={(e) => onKeyInputChange(e.target.value)}
          placeholder={t.onchain.keyPlaceholder}
          className="flex-1 rounded-xl border px-3 py-2 text-xs font-mono outline-none"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {t.onchain.keyLabel}
      </p>
      {invalidKey && (
        <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
          {t.onchain.invalidKey}
        </p>
      )}

      {onchain?.signatures ? (
        <>
          {(onchain.issuer?.orgName || onchain.issuer?.account) && (
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="text-[11px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t.onchain.issuedBy}:{' '}
                {onchain.issuer.orgName && (
                  <span className="font-semibold">
                    {onchain.issuer.orgName} ·{' '}
                  </span>
                )}
                <span className="font-mono break-all">
                  {onchain.issuer.account}
                </span>
              </p>
              <DomainVerifiedBadge
                verification={onchain.issuer.domainVerification}
                label={t.collection.audit.domainVerified.badge}
                titleTemplate={t.collection.audit.domainVerified.tooltip}
              />
            </div>
          )}
          <p
            className="text-sm font-semibold"
            style={{
              color: onchain.complete
                ? 'var(--color-success)'
                : 'var(--color-text-muted)',
            }}
          >
            {onchain.signatures.filter((s) => s.signed).length} {t.onchain.of}{' '}
            {onchain.signatures.length}
            {onchain.complete ? ` · ${t.onchain.complete}` : ''}
          </p>
          <ul className="space-y-1.5 text-sm">
            {onchain.signatures.map((s) => (
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
              </li>
            ))}
          </ul>
          {!hasFileBytes || !effectiveDocHash ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t.onchain.dropFileToCompare}
            </p>
          ) : onchainHashMismatch ? (
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--color-danger, #dc2626)' }}
            >
              {t.onchain.fileMismatch}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {t.onchain.hashMatches}
            </p>
          )}
        </>
      ) : (
        notFound && (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.onchain.notFound}
          </p>
        )
      )}
    </ToolSection>
  );
}
