'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Database,
  ExternalLink,
  HardDrive,
  Lock,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { truncateAddress } from '@/utils/formatters';
import {
  evaluateIntegritySummary,
  type CollectionAuditResponse,
} from '../../lib/collection-audit';
import {
  extractPublicDomain,
  type DomainVerificationResult,
} from '../../lib/domain-verify';
import { DomainStatusButton } from '../collection/DomainVerificationDrawer';
import {
  entityExplorerHref,
  type AuditLabels,
  type DomainVerifyLabels,
} from './AuditFormatters';

/**
 * Integrity & privacy sub-tab: expandable cryptographic integrity checks with
 * exact on-ledger sub-verifications, technical supply counters, institutional
 * metadata, and transparent GDPR / data-provenance guarantees.
 */
export function AuditIntegrityTab({
  audit,
  locale,
  labels,
  domainVerifyLabels,
  domainVerification,
  domainChecking,
  onOpenDomainDrawer,
}: {
  audit: CollectionAuditResponse;
  locale: string;
  labels: AuditLabels;
  domainVerifyLabels: DomainVerifyLabels;
  domainVerification: DomainVerificationResult | null;
  domainChecking: boolean;
  onOpenDomainDrawer: () => void;
}) {
  const [openChecks, setOpenChecks] = useState<Set<string>>(new Set());
  const t = labels.integrityTab;
  const d = t.checkDetails;
  const isTestnet = audit.networkId === RadixNetworkId.Stokenet;
  const domain =
    domainVerification?.domain ?? extractPublicDomain(audit.issuer.orgUrl);
  const domainVerified = !!domainVerification?.verified;

  const toggleCheck = (key: string) => {
    setOpenChecks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const summary = evaluateIntegritySummary(audit.integrity);
  const checks: Array<{
    key: string;
    ok: boolean;
    optional?: boolean;
    statusLabel: string;
    label: string;
    details: Array<{ label: string; ok: boolean; valueText?: string }>;
  }> = [
    {
      key: 'standard',
      ok: summary.standardOk,
      statusLabel: summary.standardOk
        ? labels.pdf.integrityPass
        : labels.pdf.integrityWarn,
      label: summary.standardOk
        ? labels.integrity.standardOk
        : labels.integrity.standardWarn,
      details: [
        { label: d.standardMarker, ok: audit.integrity.hasMarker },
        { label: d.officialBrand, ok: audit.integrity.officialBrand },
      ],
    },
    {
      key: 'custody',
      ok: summary.custodyOk,
      statusLabel: summary.custodyOk
        ? labels.pdf.integrityPass
        : labels.pdf.integrityWarn,
      label: summary.custodyOk
        ? labels.integrity.custodyOk
        : labels.integrity.custodyWarn,
      details: [
        { label: d.ownerLocked, ok: audit.integrity.ownerLocked },
        { label: d.issuerVerified, ok: audit.integrity.issuerVerified },
      ],
    },
    {
      key: 'immutable',
      ok: summary.immutableOk,
      statusLabel: summary.immutableOk
        ? labels.pdf.integrityPass
        : labels.pdf.integrityWarn,
      label: summary.immutableOk
        ? labels.integrity.immutableOk
        : labels.integrity.immutableWarn,
      details: [
        { label: d.burnDenied, ok: audit.integrity.burnDenied },
        { label: d.dataImmutable, ok: audit.integrity.dataImmutable },
        { label: d.zeroBurned, ok: audit.integrity.totalBurned === 0 },
      ],
    },
    {
      key: 'domain',
      ok: domainVerified,
      optional: true,
      statusLabel: domainVerified
        ? d.domainStatusVerified
        : d.domainStatusUnverified,
      label: domainVerified
        ? `${d.domainTitleOk}${domain ? ` (${domain})` : ''}`
        : d.domainTitleUnverified,
      details: [
        {
          label: d.domainUrlConfigured,
          ok: !!domain,
          valueText: domain ?? undefined,
        },
        {
          label: d.domainProofLive,
          ok: domainVerified,
          valueText: domainVerified
            ? domainVerification?.method === 'dns-txt'
              ? 'DNS TXT'
              : '.well-known/radix-seal.json'
            : undefined,
        },
      ],
    },
  ];

  return (
    <div className="divide-y divide-[var(--color-card-border)]">
      {/* 1. Expandable Cryptographic Integrity Checks */}
      <section className="pb-6 space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-[var(--color-text-main)]">
            {t.checksTitle}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t.checksSubtitle}
          </p>
        </div>

        <ul className="border-y border-[var(--color-card-border)] divide-y divide-[var(--color-card-border)]">
          {checks.map((chk) => {
            const isOpen = openChecks.has(chk.key);
            return (
              <li key={chk.key}>
                <button
                  type="button"
                  onClick={() => toggleCheck(chk.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition-colors hover:bg-[var(--color-surface)]/70"
                  style={{
                    background: isOpen
                      ? 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))'
                      : 'color-mix(in srgb, var(--color-surface) 40%, transparent)',
                  }}
                >
                  <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text-main)]">
                    {chk.ok ? (
                      <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />
                    ) : chk.optional ? (
                      <ShieldAlert className="size-4 shrink-0 text-[var(--color-text-muted)]" />
                    ) : (
                      <TriangleAlert className="size-4 shrink-0 text-[var(--color-warning)]" />
                    )}
                    {chk.label}
                  </span>
                  <span className="inline-flex items-center gap-2 shrink-0">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{
                        color: chk.ok
                          ? 'var(--color-success)'
                          : chk.optional
                            ? 'var(--color-text-muted)'
                            : 'var(--color-warning)',
                      }}
                    >
                      {chk.statusLabel}
                    </span>
                    <ChevronDown
                      className={`size-4 text-[var(--color-text-muted)] transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>

                {isOpen && (
                  <div
                    className="border-t border-[var(--color-card-border)]/70 px-4 py-3 space-y-2 text-xs"
                    style={{
                      background: 'color-mix(in srgb, var(--color-bg) 55%, var(--color-card-bg))',
                    }}
                  >
                    {chk.details.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-[var(--color-text-muted)]">{item.label}</span>
                        <span
                          className="font-semibold shrink-0"
                          style={{
                            color: item.ok
                              ? 'var(--color-success)'
                              : chk.optional
                                ? 'var(--color-text-muted)'
                                : 'var(--color-warning)',
                          }}
                        >
                          {item.valueText ?? (item.ok ? d.yes : d.no)}
                        </span>
                      </div>
                    ))}
                    {chk.key === 'domain' && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={onOpenDomainDrawer}
                          className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                        >
                          {d.domainOpenGuide}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {audit.integrity.totalBurned > 0 && (
          <p className="text-xs font-medium text-[var(--color-warning)]">
            {labels.integrity.burnedNotice.replace('{count}', String(audit.integrity.totalBurned))}
          </p>
        )}
      </section>

      {/* 2. Technical Summary & On-Ledger Custom Metadata */}
      <section className="py-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[var(--color-text-main)]">
            {t.collectionSummaryTitle}
          </h3>
          <dl className="border-y border-[var(--color-card-border)] divide-y divide-[var(--color-card-border)] text-xs">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-[var(--color-text-muted)]" title={labels.tooltips.collectionAddress}>
                {labels.header.collectionLabel}
              </dt>
              <dd className="inline-flex items-center gap-1.5 font-mono text-[var(--color-text-main)]">
                <a
                  href={entityExplorerHref(locale, audit.collection, audit.networkId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={audit.collection}
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  {truncateAddress(audit.collection, 10, 6)}
                  <ExternalLink className="size-3" />
                </a>
                <CopyButton value={audit.collection} variant="minimal" size="xs" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-[var(--color-text-muted)]">{t.domainSummaryLabel}</dt>
              <dd className="inline-flex items-center gap-1.5">
                <DomainStatusButton
                  size="xs"
                  verified={domainVerified}
                  checking={domainChecking}
                  verifiedLabel={
                    domain
                      ? `${domainVerifyLabels.verifiedBadge} · ${domain}`
                      : domainVerifyLabels.verifiedBadge
                  }
                  unverifiedLabel={domainVerifyLabels.unverifiedBadge}
                  checkingLabel={domainVerifyLabels.checkingBadge}
                  title={domainVerifyLabels.badgeTooltip}
                  onClick={onOpenDomainDrawer}
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-[var(--color-text-muted)]">{t.networkLabel}</dt>
              <dd
                className="font-semibold"
                style={{ color: isTestnet ? 'var(--color-warning)' : 'var(--color-primary)' }}
              >
                {isTestnet ? labels.network.stokenet : labels.network.mainnet}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-[var(--color-text-muted)]">{t.totalSupplyLabel}</dt>
              <dd className="font-bold tabular-nums text-[var(--color-text-main)]">
                {audit.totalSupply.toLocaleString(locale)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-[var(--color-text-muted)]">{t.burnedLabel}</dt>
              <dd
                className="font-bold tabular-nums"
                style={{
                  color: audit.integrity.totalBurned > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                }}
              >
                {audit.integrity.totalBurned}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3">
          <h3
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-main)] cursor-help"
            title={t.metadataTooltip}
          >
            {t.metadataTitle}
          </h3>
          {audit.integrity.customMetadata.length > 0 ? (
            <dl className="border-y border-[var(--color-card-border)] divide-y divide-[var(--color-card-border)] text-xs">
              {audit.integrity.customMetadata.map((m) => (
                <div key={m.key} className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="font-mono text-[var(--color-text-muted)]">{m.key}</dt>
                  <dd className="font-semibold text-right text-[var(--color-text-main)]">
                    {m.value || '-'}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">{t.noMetadata}</p>
          )}
        </div>
      </section>

      {/* 3. Data Provenance & GDPR Privacy Architecture */}
      <section className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-[var(--color-primary)]" />
          <h3 className="text-sm font-bold text-[var(--color-text-main)]">
            {t.privacyTitle}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 text-xs leading-relaxed">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-bold text-[var(--color-text-main)]">
              <Database className="size-3.5 shrink-0 text-[var(--color-success)]" />
              {t.onchainTitle}
            </p>
            <p className="text-[var(--color-text-muted)]">{t.onchainBody}</p>
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-bold text-[var(--color-text-main)]">
              <HardDrive className="size-3.5 shrink-0 text-[var(--color-primary)]" />
              {t.browserTitle}
            </p>
            <p className="text-[var(--color-text-muted)]">{t.browserBody}</p>
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-bold text-[var(--color-text-main)]">
              <Lock className="size-3.5 shrink-0 text-[var(--color-accent)]" />
              {t.sensitiveTitle}
            </p>
            <p className="text-[var(--color-text-muted)]">{t.sensitiveBody}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
