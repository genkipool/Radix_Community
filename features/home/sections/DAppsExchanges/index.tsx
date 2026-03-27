import { Store, ExternalLink, TrendingUp } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import React from 'react';
import type { LanguageSectionProps } from '../../types';

const DAPP_URLS = ['https://ociswap.com', 'https://defiplaza.net', 'https://caviarnine.com'];
const DAPP_COLORS = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)'];

const card = 'rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] p-8 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300';

export default function DAppsExchanges({ t, language: _language }: LanguageSectionProps) {

    return (
        <section id="dapps-exchanges" className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
            <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                <SectionHeader
                    icon={<Store className="w-4 h-4 shrink-0" />}
                    badge={t.dapps.label}
                    badgeClassName="bg-[var(--color-bg)] border-[var(--color-card-border)] text-[var(--color-secondary)]"
                    title={t.dapps.h2a}
                    titleAccent={t.dapps.h2b}
                    subtitle={t.dapps.sub}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 mb-24">
                    {(t.dapps.items as Array<Record<string, string>>).map((dapp, i: number) => (
                        <FadeIn key={i} delay={i * 0.05} className={card}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-bg)] border border-[var(--color-card-border)] flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6" style={{ color: DAPP_COLORS[i] }} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: DAPP_COLORS[i] }}>{dapp.type}</span>
                                    <h3 className="text-xl font-bold text-[var(--color-text-main)]">{dapp.name}</h3>
                                </div>
                            </div>
                            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">{dapp.desc}</p>
                            <a href={DAPP_URLS[i]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold transition-colors" style={{ color: DAPP_COLORS[i] }}>
                                <ExternalLink className="w-4 h-4" />
                                {t.dapps.visit} {dapp.name}
                            </a>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
