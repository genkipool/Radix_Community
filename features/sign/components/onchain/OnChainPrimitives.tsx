'use client';

import { Building2 } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { OnChainStatus } from '../../services/signApi';
import type { SignDictionary } from '../../types/dictionary';
import { DomainVerifiedBadge } from '../DomainVerifiedBadge';

export type InviteMode = 'sign' | 'send';

export function OnChainMuted({ text }: { text: string }) {
  return (
    <p
      className="text-xs leading-relaxed"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {text}
    </p>
  );
}

export function OnChainDanger({ text }: { text: string }) {
  return (
    <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
      {text}
    </p>
  );
}

export function OnChainRequestSummary({
  t,
  status,
}: {
  t: SignDictionary;
  status: OnChainStatus;
}) {
  const issuer = status.issuer;
  return (
    <div className="space-y-2">
      {(issuer?.orgName || issuer?.orgWebsite) && (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--color-text-main)' }}
          >
            <Building2 className="size-3.5 shrink-0" />
            {issuer.orgName ?? ''}
            {issuer.orgWebsite && (
              <a
                href={issuer.orgWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--color-primary)' }}
              >
                {issuer.orgWebsite.replace(/^https?:\/\//, '')}
              </a>
            )}
          </span>
          <DomainVerifiedBadge
            verification={issuer.domainVerification}
            label={t.collection.audit.domainVerified.badge}
            titleTemplate={t.collection.audit.domainVerified.tooltip}
          />
        </div>
      )}
      {issuer?.account && (
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {t.onchain.issuedBy}:{' '}
          <span className="font-mono break-all">{issuer.account}</span>
        </p>
      )}
      {status.docHash && (
        <p
          className="font-mono text-[11px] break-all"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {t.onchain.requestHash}: {status.docHash}
        </p>
      )}
    </div>
  );
}

export function OnChainManualKey({
  t,
  value,
  onChange,
  onLoad,
  busy,
}: {
  t: SignDictionary;
  value: string;
  onChange: (v: string) => void;
  onLoad: () => void;
  busy: boolean;
}) {
  return (
    <ToolSection title={t.onchain.keyLabel}>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.onchain.keyPlaceholder}
          disabled={busy}
          className="flex-1 rounded-xl border px-3 py-2 text-xs font-mono outline-none"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        />
        <button
          type="button"
          onClick={onLoad}
          disabled={busy || !value.trim()}
          className="px-4 rounded-xl border font-bold text-xs disabled:opacity-40"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          {t.onchain.load}
        </button>
      </div>
    </ToolSection>
  );
}
