import { ExternalLink, Mail, MessageCircle } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { GlowBlob } from '@/components/ui/GlowBlob';
import { CopyButton } from '@/components/ui/CopyButton';
import { DAO_EXTERNAL_LINKS, DAO_LEGAL_FACTS } from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';

interface DaoContactSectionProps {
  contact: DaoCopy['contact'];
}

/**
 * Closing call-to-action & official channels, mirroring Hyperscale's CTAFinal:
 * centered gradient headline over a soft GlowBlob, pill buttons, and open editorial notes.
 */
export function DaoContactSection({ contact }: DaoContactSectionProps) {
  return (
    <section
      id="contact"
      className="dao-section py-28 sm:py-32 bg-[var(--color-bg)] relative overflow-hidden"
    >
      <GlowBlob
        color="var(--color-primary)"
        position="center"
        size={800}
        opacity={0.18}
        blur={120}
      />

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        {/* Centered CTA Final Header */}
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[var(--color-text-main)] mb-6 tracking-tight leading-tight">
            <h2>
              {contact.title}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]">
                {contact.titleAccent}
              </span>
            </h2>
          </FadeIn>

          <FadeIn
            delay={0.1}
            className="text-lg sm:text-xl text-[var(--color-text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            <p>{contact.subtitle}</p>
          </FadeIn>

          {/* Official Mailbox Pills + Vote Portal */}
          <FadeIn
            delay={0.15}
            className="flex flex-wrap items-center justify-center gap-4 mb-6"
          >
            {DAO_LEGAL_FACTS.emails.map((email, idx) => (
              <div
                key={email}
                className="inline-flex items-center gap-2 pl-6 pr-3 py-3 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-card-border)] hover:border-[var(--color-secondary)]/50 transition-colors"
              >
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 font-mono text-sm sm:text-base font-bold text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <Mail
                    className={`size-4 ${idx === 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)]'}`}
                    aria-hidden="true"
                  />
                  <span>{email}</span>
                </a>
                <CopyButton value={email} variant="ghost" size="xs" />
              </div>
            ))}

            <a
              href={DAO_EXTERNAL_LINKS.councilTelegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center gap-2 px-6 py-3.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-card-border)] text-[var(--color-text-main)] font-bold text-sm sm:text-base hover:border-[var(--color-secondary)]/50 transition-colors"
            >
              <MessageCircle className="size-4 text-[var(--color-secondary)]" aria-hidden="true" />
              <span>{contact.councilTelegramCta}</span>
              <ExternalLink className="size-3.5 text-[var(--color-secondary)]" aria-hidden="true" />
            </a>

            <a
              href={DAO_EXTERNAL_LINKS.portal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold text-sm sm:text-base hover:opacity-90 transition-opacity shadow-lg"
            >
              <span>radixdao.org</span>
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </FadeIn>

          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-2xl mx-auto">
            {contact.mailboxNote}
          </p>
        </div>

        {/* Open editorial notes — zero heavy boxes */}
        <div className="mt-20 pt-12 border-t border-[var(--color-card-border)] grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text-main)] mb-2">
              {contact.challengeTitle}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {contact.challengeDesc}
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-[var(--color-text-main)] mb-2">
              {contact.knownGapTitle}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {contact.knownGapDesc}
            </p>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-[var(--color-card-border)] text-center space-y-3">
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-3xl mx-auto leading-relaxed">
            {contact.legalDisclaimer}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm">
            <a
              href={DAO_EXTERNAL_LINKS.midaoPortal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-secondary)] hover:underline"
            >
              <span>{contact.midaoLinkLabel}</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <a
              href={DAO_EXTERNAL_LINKS.formationRecord}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-secondary)] hover:underline"
            >
              <span>{contact.formationRecordLinkLabel}</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
