import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, Globe } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { FadeIn } from '@/components/ui/FadeIn';
import { SEAL_LINKS } from '../data/links';

const WELL_KNOWN_EXAMPLE = `{
  "v": 1,
  "collections": ["resource_rdx1..."]
}`;

const DNS_TXT_EXAMPLE = `_radix-seal.example.org  TXT  "v=radix-seal1 collection=resource_rdx1..."`;

/**
 * Custody-free domain verification reference panel (`.well-known/radix-seal.json`
 * and DNS TXT `_radix-seal.<domain>`) shown inside the Radix Seal landing page.
 */
export function DomainVerificationPanel({
  locale,
  title,
  badge,
  hint,
  wellKnownLabel,
  dnsLabel,
  note,
  cta,
}: {
  locale: string;
  title: string;
  badge: string;
  hint: string;
  wellKnownLabel: string;
  dnsLabel: string;
  note: string;
  cta: string;
}) {
  return (
    <FadeIn delay={0.45} className="mt-8">
      <div
        className="flex flex-col gap-6 rounded-3xl border p-6 sm:p-8"
        style={{
          background: 'var(--color-card-bg)',
          borderColor: 'var(--color-card-border)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-surface)' }}
            >
              <Globe className="size-5 text-[var(--color-primary)]" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className="text-base font-bold sm:text-lg"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  {title}
                </h3>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    background:
                      'color-mix(in srgb, var(--color-success) 14%, transparent)',
                    color: 'var(--color-success)',
                  }}
                >
                  <BadgeCheck className="size-3.5" />
                  {badge}
                </span>
              </div>
            </div>
          </div>

          <Link
            href={`/${locale}${SEAL_LINKS.collection}?tab=identity`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] transition-opacity hover:opacity-80"
          >
            {cta}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {hint}
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[11px] font-black uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {wellKnownLabel}
              </span>
              <CopyButton
                value={WELL_KNOWN_EXAMPLE}
                variant="minimal"
                size="sm"
              />
            </div>
            <pre
              className="overflow-x-auto rounded-2xl border p-4 text-[11px] leading-relaxed"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            >
              <code className="font-mono whitespace-pre">
                {WELL_KNOWN_EXAMPLE}
              </code>
            </pre>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[11px] font-black uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {dnsLabel}
              </span>
              <CopyButton value={DNS_TXT_EXAMPLE} variant="minimal" size="sm" />
            </div>
            <pre
              className="overflow-x-auto rounded-2xl border p-4 text-[11px] leading-relaxed"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            >
              <code className="font-mono whitespace-pre">{DNS_TXT_EXAMPLE}</code>
            </pre>
            <p
              className="pt-1 text-xs leading-relaxed"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {note}
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
