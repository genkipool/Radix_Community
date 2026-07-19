/**
 * Anatomy — RSC
 *
 * "How the seal, the collection and its NFTs work": the two base NFTs (Seal +
 * signing collection) explained as foundation cards, then the four NFT types
 * minted inside the collection (signature invitation, signature, encryption
 * invitation, decryption receipt) as a labeled grid, each with who mints it
 * and what it proves. Closes with the public-verifiability note.
 */
import {
  BadgeCheck,
  FileLock,
  FileSignature,
  FolderLock,
  KeyRound,
  Layers,
  Mail,
  ReceiptText,
  Stamp,
} from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import type { SealSectionProps } from '../../types';

const FOUNDATION_ICONS = [
  <Stamp key="seal" className="size-10 text-[var(--color-primary)]" />,
  <FolderLock key="collection" className="size-10 text-[var(--color-secondary)]" />,
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  invite: <Mail className="size-6 text-[var(--color-primary)]" />,
  signature: <FileSignature className="size-6 text-[var(--color-secondary)]" />,
  'cipher-signature': <FileLock className="size-6 text-[var(--color-secondary)]" />,
  'cipher-invite': <KeyRound className="size-6 text-[var(--color-primary)]" />,
  'cipher-receipt': <ReceiptText className="size-6 text-[var(--color-secondary)]" />,
};

export default function Anatomy({ t }: SealSectionProps) {
  const a = t.seal.anatomy;

  return (
    <section id="anatomy" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Layers className="size-3.5 text-[var(--color-primary)]" />}
          badge={a.label}
          title={a.h2a}
          titleAccent={a.h2b}
          subtitle={a.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        {/* Two base NFTs */}
        <p className="text-[12px] font-bold text-[var(--color-text-muted)] tracking-[0.3em] uppercase text-center mb-6">
          {a.foundationsTitle}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {a.foundations.map(
            (
              card: { name: string; tag: string; role: string; props: string[] },
              i: number,
            ) => (
              <FadeIn
                key={card.name}
                delay={i * 0.1}
                className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl relative overflow-hidden group hover:border-[var(--color-secondary)]/40 transition-colors"
              >
                <div className="absolute top-0 right-0 size-32 bg-[var(--color-secondary)]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                <div className="mb-5 relative z-10">{FOUNDATION_ICONS[i]}</div>
                <span className="inline-block px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-card-border)] text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 relative z-10">
                  {card.tag}
                </span>
                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-3 relative z-10">
                  {card.name}
                </h3>
                <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mb-5 relative z-10">
                  {card.role}
                </p>
                <ul className="space-y-2.5 relative z-10">
                  {card.props.map((prop) => (
                    <li key={prop} className="flex items-start gap-2.5">
                      <BadgeCheck className="size-4 text-[var(--color-secondary)] shrink-0 mt-0.5" />
                      <span className="text-sm text-[var(--color-text-main)] leading-snug">
                        {prop}
                      </span>
                    </li>
                  ))}
                </ul>
              </FadeIn>
            ),
          )}
        </div>

        {/* Four NFT types minted inside the collection */}
        <FadeIn className="text-center max-w-3xl mx-auto mb-8">
          <p className="text-[12px] font-bold text-[var(--color-text-muted)] tracking-[0.3em] uppercase mb-3">
            {a.typesTitle}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{a.typesSub}</p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {a.types.map(
            (
              type: {
                kind: string;
                name: string;
                mintedBy: string;
                proves: string;
                desc: string;
              },
              i: number,
            ) => (
              <FadeIn
                key={type.kind}
                delay={i * 0.08}
                className={`bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl p-6 hover:border-[var(--color-secondary)]/40 transition-colors ${
                  type.kind === 'cipher-receipt' ? 'md:col-span-2' : ''
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-11 shrink-0 rounded-xl flex items-center justify-center bg-[var(--color-card-bg)] border border-[var(--color-card-border)]">
                    {TYPE_ICONS[type.kind]}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-[var(--color-text-main)] leading-tight">
                      {type.name}
                    </h4>
                    <code className="text-[11px] font-mono text-[var(--color-text-muted)]">
                      kind: {type.kind}
                    </code>
                  </div>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                  {type.desc}
                </p>
                <dl className="space-y-2 border-t border-[var(--color-card-border)] pt-4">
                  <div className="flex gap-2 text-xs">
                    <dt className="font-bold text-[var(--color-text-main)] shrink-0">
                      {'▸'}
                    </dt>
                    <dd className="text-[var(--color-text-muted)] leading-snug">{type.mintedBy}</dd>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <dt className="font-bold text-[var(--color-secondary)] shrink-0">
                      <BadgeCheck className="size-4" />
                    </dt>
                    <dd className="text-[var(--color-text-main)] leading-snug font-medium">
                      {type.proves}
                    </dd>
                  </div>
                </dl>
              </FadeIn>
            ),
          )}
        </div>

        {/* Public-verifiability note */}
        <FadeIn
          delay={0.1}
          className="flex items-start gap-3 max-w-4xl mx-auto p-6 rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30"
        >
          <Layers className="size-5 text-[var(--color-primary)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{a.note}</p>
        </FadeIn>
      </div>
    </section>
  );
}
