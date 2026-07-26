/**
 * Capabilities — RSC
 *
 * The four Radix Seal tools (collection, sign, encrypt, chat): one large card
 * per tool with its guarantees as a checklist and a direct link into the
 * console. Collection comes first: it is where a signer's identity lives, and
 * the other three write into it.
 */
import Link from 'next/link';
import { FileSignature, FileLock2, Layers, MessageSquareLock, Check } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { SEAL_LINKS } from '../../data/links';
import type { SealLocaleSectionProps } from '../../types';

const TOOL_META = [
  {
    key: 'collection',
    icon: <Layers className="size-10 text-[var(--color-secondary)]" />,
    href: SEAL_LINKS.collection,
  },
  {
    key: 'sign',
    icon: <FileSignature className="size-10 text-[var(--color-primary)]" />,
    href: SEAL_LINKS.sign,
  },
  {
    key: 'encrypt',
    icon: <FileLock2 className="size-10 text-[var(--color-secondary)]" />,
    href: SEAL_LINKS.encrypt,
  },
  {
    key: 'chat',
    icon: <MessageSquareLock className="size-10 text-[var(--color-primary)]" />,
    href: SEAL_LINKS.chat,
  },
] as const;

export default function Capabilities({ t, locale }: SealLocaleSectionProps) {
  const cap = t.seal.capabilities;

  return (
    <section id="capabilities" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-[var(--color-secondary)]" />}
          badge={cap.label}
          title={cap.h2a}
          titleAccent={cap.h2b}
          subtitle={cap.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {TOOL_META.map((tool, i) => {
            const card = cap.tools[i];
            return (
              <FadeIn
                key={tool.key}
                delay={i * 0.1}
                className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl relative overflow-hidden group hover:border-[var(--color-secondary)]/40 transition-colors flex flex-col"
              >
                <div className="absolute top-0 right-0 size-32 bg-[var(--color-secondary)]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                <div className="mb-6 relative z-10">{tool.icon}</div>
                <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-3 relative z-10">
                  {card.title}
                </h3>
                <p className="text-[var(--color-text-muted)] leading-relaxed mb-6 relative z-10">
                  {card.desc}
                </p>

                <ul className="space-y-3 mb-8 relative z-10">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-[var(--color-text-main)]">
                      <Check className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/${locale}${tool.href}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center font-bold text-[var(--color-primary)] hover:opacity-80 transition-opacity relative z-10"
                >
                  {card.cta}
                </Link>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
