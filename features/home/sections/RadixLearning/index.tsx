import { GraduationCap, Coins, Droplets, Gamepad2, Sparkles, ExternalLink } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { GlowBlob } from '@/components/ui/GlowBlob';
import Link from 'next/link';
import React from 'react';
import type { LanguageSectionProps } from '../../types';

const card = 'rounded-2xl bg-[var(--color-bg)] border border-[var(--color-card-border)] p-8 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300';

export default function RadixLearning({ t, language }: LanguageSectionProps) {

    const items = [
        {
            icon: <Coins className="size-6 text-[var(--color-primary)]" />,
            badge: t.aprendizaje?.cards?.staking?.badge,
            title: t.aprendizaje?.cards?.staking?.title,
            desc: t.aprendizaje?.cards?.staking?.desc,
            link: `/${language}/dashboard`,
            linkText: t.aprendizaje?.cards?.staking?.linkText,
            isInternal: true,
        },
        {
            icon: <Droplets className="size-6 text-[var(--color-secondary)]" />,
            badge: t.aprendizaje?.cards?.liquidez?.badge,
            title: t.aprendizaje?.cards?.liquidez?.title,
            desc: t.aprendizaje?.cards?.liquidez?.desc,
            link: 'https://ociswap.com',
            linkText: t.aprendizaje?.cards?.liquidez?.linkText,
        },
        {
            icon: <Gamepad2 className="size-6 text-[var(--color-accent)]" />,
            badge: t.aprendizaje?.cards?.playground?.badge,
            title: t.aprendizaje?.cards?.playground?.title,
            desc: t.aprendizaje?.cards?.playground?.desc,
            link: 'https://gumball-club.radixdlt.com/',
            linkText: t.aprendizaje?.cards?.playground?.linkText,
        },
        {
            icon: <Sparkles className="size-6 text-[var(--color-primary)]" />,
            badge: t.aprendizaje?.cards?.onboarding?.badge,
            title: t.aprendizaje?.cards?.onboarding?.title,
            desc: t.aprendizaje?.cards?.onboarding?.desc,
            link: 'https://radquest.io/home/basic',
            linkText: t.aprendizaje?.cards?.onboarding?.linkText,
        },
    ];

    return (
        <section id="aprendizaje" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
            <GlowBlob color="var(--color-secondary)" position="top-right" opacity={0.15} />
            <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                <SectionHeader
                    icon={<GraduationCap className="size-4 shrink-0" />}
                    badge={t.aprendizaje?.label}
                    badgeClassName="bg-[var(--color-surface)] border-[var(--color-card-border)] text-[var(--color-primary)]"
                    title={t.aprendizaje?.h2}
                    subtitle={t.aprendizaje?.sub}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                    {items.map((item, i) => (
                        <FadeIn key={item.title} delay={i * 0.05} className={card}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="size-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center">
                                    {item.icon}
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-primary)]">{item.badge}</span>
                                    <h3 className="text-lg font-bold text-[var(--color-text-main)] leading-tight">{item.title}</h3>
                                </div>
                            </div>
                            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-5">{item.desc}</p>

                            {item.isInternal ? (
                                <Link
                                    href={item.link}
                                    className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors"
                                >
                                    <ExternalLink className="size-4" />
                                    {item.linkText}
                                </Link>
                            ) : (
                                <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)] hover:text-[var(--color-secondary)] transition-colors"
                                >
                                    <ExternalLink className="size-4" />
                                    {item.linkText}
                                </a>
                            )}
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
