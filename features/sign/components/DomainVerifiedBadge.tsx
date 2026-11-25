'use client';

import { BadgeCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { DomainVerificationResult } from '../lib/domain-verify';

const VERIFIED_STYLE: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--color-success) 45%, transparent)',
  background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
  color: 'var(--color-success)',
};

const UNVERIFIED_STYLE: CSSProperties = {
  borderColor: 'var(--color-card-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-muted)',
};

/**
 * Read-only verified-domain pill rendered next to an issuer's name/website when
 * live DNS TXT or `/.well-known/radix-seal.json` proves domain control.
 */
export function DomainVerifiedBadge({
  verification,
  label,
  titleTemplate,
}: {
  verification?: DomainVerificationResult | null;
  /** Short badge prefix, e.g. "Dominio verificado" / "Verified domain". */
  label: string;
  /** Tooltip template accepting `{domain}` and `{method}`. */
  titleTemplate: string;
}) {
  if (!verification?.verified || !verification.domain) return null;
  const methodLabel =
    verification.method === 'dns-txt'
      ? `DNS TXT (_radix-seal.${verification.domain})`
      : `https://${verification.domain}/.well-known/radix-seal.json`;
  const title = titleTemplate
    .replace('{domain}', verification.domain)
    .replace('{method}', methodLabel);

  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={VERIFIED_STYLE}
    >
      <BadgeCheck className="size-3.5 shrink-0" />
      <span>
        {label}: {verification.domain}
      </span>
    </span>
  );
}

/**
 * Interactive verified/unverified domain pill used in Collection & Audit views
 * to open the custody-free domain verification side drawer.
 */
export function DomainStatusButton({
  verified,
  checking = false,
  verifiedLabel,
  unverifiedLabel,
  checkingLabel,
  title,
  size = 'sm',
  onClick,
}: {
  verified: boolean;
  checking?: boolean;
  verifiedLabel: string;
  unverifiedLabel: string;
  checkingLabel: string;
  title?: string;
  size?: 'xs' | 'sm';
  onClick: () => void;
}) {
  const isXs = size === 'xs';
  const iconCls = isXs ? 'size-3' : 'size-3.5';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold transition-colors hover:border-[var(--color-primary)] cursor-pointer ${
        isXs ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
      }`}
      style={verified ? VERIFIED_STYLE : UNVERIFIED_STYLE}
    >
      {checking ? (
        <>
          <RefreshCw
            className={`${isXs ? 'size-2.5' : 'size-3'} animate-spin`}
          />
          {checkingLabel}
        </>
      ) : verified ? (
        <>
          <BadgeCheck className={iconCls} />
          {verifiedLabel}
        </>
      ) : (
        <>
          <ShieldAlert className={iconCls} />
          {unverifiedLabel}
        </>
      )}
    </button>
  );
}
