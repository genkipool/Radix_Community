import {
    Code2, BookOpen, Zap, Shield, Layers, GraduationCap,
    CheckCircle2, Rocket, Users, Terminal, Box, Clock
} from 'lucide-react';
import { ContentHero } from '@/components/layout/ContentHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { AcademyClientProps } from './types/components.types';
import { AcademyDictionary } from './types/i18n.types';

/* ─── Shared card class ──────────────────────────────────────────────────── */

/** flex flex-col + h-full makes every card in the same grid row stretch
 *  to the same height — the lesson list fills the remaining space via flex-1. */
const card = 'rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] p-8 shadow-md transition-all duration-300 flex flex-col h-full';

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function Academy({ t }: AcademyClientProps) {
    const { academy } = t as unknown as { academy: AcademyDictionary };

    /* ── Static icon arrays ── */
    const featureIcons = [
        <Shield key={2} className="w-7 h-7 text-green-400" />,
        <Box key={3} className="w-7 h-7 text-[var(--color-secondary)]" />,
        <Layers key={4} className="w-7 h-7 text-[var(--color-primary)]" />,
        <Terminal key={5} className="w-7 h-7 text-[var(--color-accent)]" />,
    ];

    const moduleIcons = [
        <BookOpen key={9} className="w-5 h-5" />,
        <Terminal key={10} className="w-5 h-5" />,
        <Zap key={11} className="w-5 h-5" />,
        <Shield key={12} className="w-5 h-5" />,
        <Layers key={13} className="w-5 h-5" />,
        <Rocket key={14} className="w-5 h-5" />,
    ];

    /* ── Code examples ── */
    const scryptoCode = `${academy.comparison.scryptoComment}
let my_token = ResourceBuilder::new_fungible(OwnerRole::None)
    .metadata(metadata!(
        init { "name" => "MyToken", locked; }
    ))
    .mint_initial_supply(1000);`;

    const solidityCode = `${academy.comparison.solidityComment}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("MyToken", "MTK") {
        _mint(msg.sender, 1000 * 10**decimals());
    }
}
// + deploy script + ABI + testing framework`;

    return (
        <main className="bg-[var(--color-bg)]">

            {/* ═══════ HERO ═══════ */}
            <ContentHero
                brandName={academy.hero.title}
                title={academy.hero.titleAccent}
                gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
                heroPadding="pt-32 pb-24"
                badge={{
                    icon: <GraduationCap className="w-4 h-4 shrink-0" />,
                    text: academy.hero.tag,
                    className: 'bg-[var(--color-secondary)]/10 border-[var(--color-secondary)]/30 text-[var(--color-secondary)]',
                }}
                subtitle={
                    <p className="text-xl md:text-2xl text-[var(--color-text-muted)] max-w-3xl mx-auto leading-8">
                        {academy.hero.description}
                    </p>
                }
                actions={
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="https://academy.radixdlt.com/course/scrypto101"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-4 bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-white font-bold rounded-full text-lg hover:opacity-90 transition-opacity shadow-lg"
                        >
                            {academy.hero.btnStart}
                        </a>
                        <a
                            href="https://discord.com/invite/radixdlt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-4 bg-[var(--color-surface)] border border-[var(--color-card-border)] text-[var(--color-text-main)] font-bold rounded-full text-lg hover:border-[var(--color-primary)]/50 transition-colors"
                        >
                            {academy.hero.btnDiscord}
                        </a>
                    </div>
                }
            />

            {/* ═══════ WHAT IS SCRYPTO ═══════ */}
            <section className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
                <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                    <SectionHeader
                        icon={<Code2 className="w-4 h-4 shrink-0" />}
                        badge={academy.whatIsScrypto.tag}
                        badgeClassName="bg-[var(--color-bg)] border-[var(--color-card-border)] text-green-400"
                        title={academy.whatIsScrypto.title}
                        titleAccent={academy.whatIsScrypto.titleAccent}
                        subtitle={academy.whatIsScrypto.description}
                        gradient="from-green-400 to-[var(--color-secondary)]"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                        {academy.features.map((f, i: number) => (
                            <ScrollReveal key={i} delay={i * 0.05}>
                                <div className={card}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-14 h-14 rounded-xl bg-[var(--color-bg)] border border-[var(--color-card-border)] flex items-center justify-center">
                                            {featureIcons[i]}
                                        </div>
                                        <h3 className="text-xl font-bold text-[var(--color-text-main)]">{f.title}</h3>
                                    </div>
                                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{f.description}</p>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════ CODE COMPARISON ═══════ */}
            <section className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-15">
                    <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-[var(--color-accent)] rounded-full blur-[120px]" />
                </div>
                <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                    <SectionHeader
                        icon={<Zap className="w-4 h-4 shrink-0" />}
                        badge={academy.comparison.tag}
                        badgeClassName="bg-[var(--color-surface)] border-[var(--color-card-border)] text-[var(--color-accent)]"
                        title={academy.comparison.title}
                        titleAccent={academy.comparison.titleAccent}
                        titleEnd={academy.comparison.titleEnd}
                        subtitle={academy.comparison.description}
                        gradient="from-[var(--color-accent)] to-red-400"
                    />

                    <ScrollReveal delay={0.1}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-20">
                            <div className="rounded-2xl bg-[var(--color-surface)] border border-green-500/30 p-6 overflow-hidden">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span className="text-sm font-bold text-green-400">{academy.comparison.scryptoLabel}</span>
                                </div>
                                <pre className="text-sm text-[var(--color-text-muted)] overflow-x-auto leading-6">
                                    <code>{scryptoCode}</code>
                                </pre>
                            </div>
                            <div className="rounded-2xl bg-[var(--color-surface)] border border-red-500/30 p-6 overflow-hidden">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <span className="text-sm font-bold text-red-400">{academy.comparison.solidityLabel}</span>
                                </div>
                                <pre className="text-sm text-[var(--color-text-muted)] overflow-x-auto leading-6">
                                    <code>{solidityCode}</code>
                                </pre>
                            </div>
                        </div>
                    </ScrollReveal>

                    <ScrollReveal delay={0.15}>
                        <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] overflow-hidden shadow-md">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-[var(--color-card-border)]">
                                            {academy.comparison.table.headers.map((header: string, i: number) => (
                                                <th key={i} className={`px-6 py-4 text-sm font-bold uppercase tracking-widest ${i === 1 ? 'text-[var(--color-secondary)]' : 'text-[var(--color-text-muted)]'}`}>
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {academy.comparison.table.rows.map((row: string[], i: number) => (
                                            <tr key={i} className={`border-b border-[var(--color-card-border)] ${i % 2 === 0 ? 'bg-[var(--color-bg)]/30' : ''}`}>
                                                <td className="px-6 py-4 text-sm font-bold text-[var(--color-text-main)]">{row[0]}</td>
                                                <td className="px-6 py-4 text-sm text-green-400 font-medium">{row[1]}</td>
                                                <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">{row[2]}</td>
                                                <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">{row[3]}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* ═══════ COURSE MODULES — always expanded, equal height ═══════ */}
            {/*
             * Design rationale:
             *   - All 6 module cards are always fully expanded (no toggle).
             *   - The grid uses `items-stretch` (CSS default) so every card in
             *     the same row shares the same height.
             *   - Each card is `flex flex-col`: header + description grow
             *     naturally; the lesson list sits in a `flex-1` div that fills
             *     whatever space remains → cards in the same column align perfectly.
             *   - Removing the toggle also eliminates the last useState → this
             *     component can now be a pure RSC (no 'use client' needed).
             */}
            <section className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
                <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                    <SectionHeader
                        icon={<BookOpen className="w-4 h-4 shrink-0" />}
                        badge={academy.content.tag}
                        badgeClassName="bg-[var(--color-bg)] border-[var(--color-card-border)] text-[var(--color-primary)]"
                        title={academy.content.title}
                        titleAccent={academy.content.titleAccent}
                        subtitle={academy.content.description}
                        gradient="from-[var(--color-primary)] to-[var(--color-accent)]"
                    />

                    {/* `items-stretch` (default) + `h-full` on each card = equal height per row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                        {academy.content.modules.map((mod, i: number) => (
                            <ScrollReveal key={i} delay={i * 0.05}>
                                {/* h-full + flex flex-col: card grows to fill grid cell height */}
                                <div className={card}>
                                    {/* ── Card header ── */}
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-secondary)]/20 to-[var(--color-primary)]/20 border border-[var(--color-secondary)]/30 flex items-center justify-center text-[var(--color-secondary)] font-bold text-lg shrink-0">
                                            {mod.num}
                                        </div>
                                        <div className="flex-1 flex items-center gap-2.5">
                                            <div className="flex items-center justify-center text-[var(--color-primary)] shrink-0">
                                                {moduleIcons[i]}
                                            </div>
                                            <h3 className="text-lg font-bold text-[var(--color-text-main)] leading-snug">
                                                {mod.title}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* ── Description ── */}
                                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                                        {mod.description}
                                    </p>

                                    {/* ── Duration badge ── */}
                                    <div className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)] mb-4">
                                        <Clock className="w-4 h-4 shrink-0" />
                                        {mod.duration}
                                    </div>

                                    {/* ── Lesson list — flex-1 pushes this block down so all cards align ── */}
                                    <div className="flex-1 pt-4 border-t border-[var(--color-card-border)] space-y-2">
                                        {mod.lessons.map((lesson, li: number) => (
                                            <div key={li} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                                                <span>{lesson}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════ FAQ ═══════ */}
            <section className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
                <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                    <SectionHeader
                        badge=""
                        title={academy.faq.title}
                        titleAccent={academy.faq.titleAccent}
                        gradient="from-[var(--color-secondary)] to-[var(--color-accent)]"
                    />

                    <div className="space-y-4">
                        {academy.faq.items.map((faq, i: number) => (
                            <ScrollReveal key={i} delay={i * 0.05}>
                                <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] p-6">
                                    <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-3">{faq.q}</h3>
                                    <p className="text-[var(--color-text-muted)] leading-relaxed text-sm">{faq.a}</p>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════ CTA FINAL ═══════ */}
            <section className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-accent)] rounded-full blur-[200px]" />
                </div>
                <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 text-center">
                    <SectionHeader
                        icon={<Rocket className="w-4 h-4 shrink-0" />}
                        badge={academy.cta.tag}
                        badgeClassName="bg-[var(--color-bg)] border-[var(--color-card-border)] text-[var(--color-accent)]"
                        title={academy.cta.title}
                        titleAccent={academy.cta.titleAccent}
                        subtitle={academy.cta.description}
                        gradient="from-[var(--color-accent)] to-[var(--color-primary)]"
                    />

                    <ScrollReveal delay={0.1}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 -mt-8">
                            <a
                                href="https://academy.radixdlt.com/course/scrypto101"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-white font-bold rounded-full text-lg hover:opacity-90 transition-opacity shadow-lg"
                            >
                                <GraduationCap className="w-5 h-5" />
                                {academy.cta.btnRegister}
                            </a>
                            <a
                                href="https://developers.radixdlt.com/devprogram"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--color-bg)] border border-[var(--color-card-border)] text-[var(--color-text-main)] font-bold rounded-full text-lg hover:border-[var(--color-secondary)]/50 transition-colors"
                            >
                                <Users className="w-5 h-5" />
                                {academy.cta.btnProgram}
                            </a>
                        </div>
                    </ScrollReveal>

                    <ScrollReveal delay={0.2}>
                        <div className="mt-16 flex flex-wrap justify-center gap-6 text-sm text-[var(--color-text-muted)]">
                            <a href="https://discord.com/invite/radixdlt" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)] transition-colors">Discord</a>
                            <a href="https://github.com/radixdlt" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)] transition-colors">GitHub</a>
                            <a href="https://twitter.com/RadixDLT" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)] transition-colors">Twitter</a>
                            <a href="https://www.youtube.com/c/radixdlt" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)] transition-colors">YouTube</a>
                            <a href="https://www.aprendescrypto.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)] transition-colors">{academy.cta.hispanicAcademy}</a>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

        </main>
    );
}
