/**
 * OpenVerification — RSC
 *
 * "Verifiable by anyone, forever" banner: the three artifacts that make a
 * Radix Seal signature independently checkable (self-contained PDF, public
 * request key, on-ledger chain of custody), with API, official brand, and
 * custody-free domain verification reference panels.
 */
import Link from 'next/link';
import {
  ArrowUpRight,
  FileCheck2,
  KeySquare,
  Link2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { CopyButton } from '@/components/ui/CopyButton';
import { FadeIn } from '@/components/ui/FadeIn';
import { DomainVerificationPanel } from '../../components/DomainVerificationPanel';
import { FeatureCard } from '../../components/FeatureCard';
import { SealResourceAddresses } from '../../components/SealResourceAddresses';
import { SEAL_LINKS } from '../../data/links';
import type { SealLocaleSectionProps } from '../../types';

const SEAL_DOCS_URL =
  'https://github.com/genkipool/Radix_Community/tree/main/doc/radix-seal#81-verification-api';

const VERIFY_CURL = `jq '{envelope: .}' document.radixsig.json \\
  | curl -X POST https://radix-community.genkipool.com/api/sign/verify \\
      -H 'Content-Type: application/json' --data-binary @-`;

const CARD_ICONS = [
  <FileCheck2 key="pdf" className="size-10 text-[var(--color-primary)]" />,
  <KeySquare key="key" className="size-10 text-[var(--color-secondary)]" />,
  <Link2 key="custody" className="size-10 text-[var(--color-primary)]" />,
];

export default function OpenVerification({ t, locale }: SealLocaleSectionProps) {
  const verify = t.seal.verifyOpen;

  return (
    <section
      id="open-verification"
      className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden"
    >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<ShieldCheck className="size-3.5 text-[var(--color-primary)]" />}
          badge={verify.label}
          title={verify.h2a}
          titleAccent={verify.h2b}
          subtitle={verify.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {verify.cards.map((card: { title: string; desc: string }, i: number) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        <FadeIn delay={0.2} className="flex justify-center">
          <Link
            href={`/${locale}${SEAL_LINKS.sign}?tab=verify`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)]"
          >
            {verify.cta}
          </Link>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
          <FadeIn delay={0.3} className="h-full">
            <div
              className="flex h-full flex-col gap-5 rounded-3xl border p-6 sm:p-8"
              style={{
                background: 'var(--color-card-bg)',
                borderColor: 'var(--color-card-border)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <Terminal className="size-5 text-[var(--color-primary)]" />
                </span>
                <h3
                  className="text-base font-bold sm:text-lg"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  {verify.apiTitle}
                </h3>
              </div>

              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {verify.apiHint}
              </p>

              <div className="min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-[11px] font-black uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {verify.apiCurlLabel}
                  </span>
                  <CopyButton value={VERIFY_CURL} variant="minimal" size="sm" />
                </div>
                <pre
                  className="overflow-x-auto rounded-2xl border p-4 text-[11px] leading-relaxed"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-card-border)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <code className="font-mono whitespace-pre">{VERIFY_CURL}</code>
                </pre>
              </div>

              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {verify.apiNote}
              </p>

              <a
                href={SEAL_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] transition-opacity hover:opacity-80"
              >
                {verify.apiDocs}
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.4} className="h-full">
            <SealResourceAddresses
              locale={locale}
              className="h-full"
              title={verify.officialTitle}
              hint={verify.officialHint}
              explorerLabel={verify.officialExplorer}
            />
          </FadeIn>
        </div>

        <DomainVerificationPanel
          locale={locale}
          title={verify.domainTitle}
          badge={verify.domainBadge}
          hint={verify.domainHint}
          wellKnownLabel={verify.domainWellKnownLabel}
          dnsLabel={verify.domainDnsLabel}
          note={verify.domainNote}
          cta={verify.domainCta}
        />
      </div>
    </section>
  );
}
