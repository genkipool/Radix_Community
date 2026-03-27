import { FileText, BookOpen, Code2, Globe } from 'lucide-react';
import React from 'react';
import Link from 'next/link';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { GlowBlob } from '@/components/ui/GlowBlob';
import type { BaseSectionProps } from '../../types';

const card = 'rounded-2xl bg-[var(--color-bg)] border border-[var(--color-card-border)] p-8 shadow-md hover:shadow-xl transition-all duration-300 group';

const DOC_ICONS = [
    <FileText key={10} className="w-7 h-7 text-[var(--color-primary)]" />,
    <BookOpen key={11} className="w-7 h-7 text-[var(--color-secondary)]" />,
    <Code2 key={12} className="w-7 h-7 text-[var(--color-accent)]" />,
    <Globe key={13} className="w-7 h-7 text-[var(--color-primary)]" />,
];

const DOC_LINKS = [
    [
        { url: 'https://uploads-ssl.webflow.com/6053f7fca5bf627283b582c2/61d5a4583aad156a094c5628_Radix%20DeFi%20White%20Paper%20v2.05.pdf' },
        { url: 'https://escholarship.org/uc/item/6h427354' },
        { url: 'https://assets.website-files.com/6053f7fca5bf627283b582c2/608811e3f5d21f235392fee1_Cerberus-Whitepaper-v1.01.pdf' }
    ],
    [
        { url: 'https://docs.radixdlt.com/' },
        { url: 'https://www.radixdlt.com/developers' }
    ],
    [
        { url: '/academy', internal: true },
        { url: 'https://www.aprendescrypto.com/' }
    ],
    [
        { url: '/blog', internal: true },
        { url: 'https://learn.radixdlt.com/' }
    ],
];

export default function Documentation({ t }: BaseSectionProps) {

    return (
        <section id="doc" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
            <GlowBlob color="var(--color-primary)" position="bottom-left" opacity={0.15} />
            <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                <SectionHeader
                    icon={<FileText className="w-4 h-4 shrink-0" />}
                    badge={t.documentacion.label}
                    badgeClassName="bg-[var(--color-surface)] border-[var(--color-card-border)] text-[var(--color-primary)]"
                    title={t.documentacion.h2a}
                    titleAccent={t.documentacion.h2b}
                    subtitle={t.documentacion.sub}
                    gradient="from-[var(--color-primary)] to-[var(--color-secondary)]"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                    {t.documentacion.cards.map((doc, i: number) => (
                        <FadeIn key={i} delay={i * 0.05} className={card}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center group-hover:border-[var(--color-primary)]/40 transition-colors">
                                    {DOC_ICONS[i]}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">{doc.title}</h3>
                                </div>
                            </div>
                            <p className="text-[var(--color-text-muted)] leading-relaxed mb-6 text-sm">{doc.desc}</p>

                            <div className="flex flex-wrap gap-4 pt-4 border-t border-[var(--color-card-border)]">
                                {doc.links.map((linkText: string, linkIdx: number) => {
                                    const linkData = DOC_LINKS[i]?.[linkIdx];
                                    if (!linkData) return null;
                                    const cls = "text-sm font-bold text-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors";
                                    return (linkData as Record<string, unknown>).internal ? (
                                        <Link key={linkIdx} href={linkData.url} className={cls}>{linkText}</Link>
                                    ) : (
                                        <a key={linkIdx} href={linkData.url} target="_blank" rel="noopener noreferrer" className={cls}>{linkText}</a>
                                    );
                                })}
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
