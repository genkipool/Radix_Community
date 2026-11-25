'use client';

import { BadgeCheck } from 'lucide-react';
import type { DomainVerificationResult } from '../lib/domain-verify';

/**
 * Compact verified-domain pill rendered next to an issuer's name/website when
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
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
        color: 'var(--color-success)',
      }}
    >
      <BadgeCheck className="size-3.5 shrink-0" />
      <span>
        {label}: {verification.domain}
      </span>
    </span>
  );
}
